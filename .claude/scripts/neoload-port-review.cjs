// Cross-check a finished NeoLoad → k6 port against its recording — the evidence half of the
// neoload-port-review skill. Zero traffic: it reads the NeoLoad tree, the project's variables/ and
// populations, and the k6 source, and prints one compact report of OK / FLAG / INFO lines per area
// (steps, spine coverage, correlation, token-literal leaks, variables/pools, seed, SLA, wiring). The
// reviewer judges only the FLAG lines — it never re-derives what this already checked.
//
// Usage:
//   node .claude/scripts/neoload-port-review.cjs "<VU tree dir>" source/flows/<journey>.flow.ts
//
// Deterministic and read-only. Zip extraction shells out to `unzip` (git-bash / any *nix).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { findProjectRoot, loadDefs, resolveDef, refsInTree, poolValues, commonPrefix } = require('./neoload-vars.cjs');
const { readTree, recordedRequest, alignTokens, attr, openTag, vuXmlPath } = require('./neoload-tree.cjs');

const [treeArg, flowArg] = process.argv.slice(2);
if (!treeArg || !flowArg || !fs.existsSync(flowArg)) {
  console.error(
    'usage: node .claude/scripts/neoload-port-review.cjs "<VU tree dir | NeoLoad project root>" source/flows/<journey>.flow.ts',
  );
  process.exit(1);
}
// Given the project root instead of a VU, pick the VU from the flow's step prefix (T001_AccountCreation →
// uid "T01_AccountCreation (x.y)"), preferring the version its pool modules were generated from.
const resolveVu = (projectRoot) => {
  const flow = fs.readFileSync(flowArg, 'utf8');
  // the step name can run to several segments and differ from the VU uid (T003_ViewContact_ServiceOrders_01 →
  // uid "T03_ViewContact_ServiceOrder (26.3)"), so match on the number plus the name's leading segment
  const m = flow.match(/'T0*(\d+)_([A-Za-z_]+?)_\d+_[^']+'/);
  if (!m) return null;
  const vus = path.join(projectRoot, 'team', 'vus');
  const uidRe = new RegExp(`uid="T0*${m[1]}_(${m[2].split('_')[0]}[^"]*?) \\(([\\d.]+)\\)"`, 'i');
  const candidates = fs
    .readdirSync(vus)
    .filter((f) => f.endsWith('.xml'))
    .map((f) => ({ f, v: (fs.readFileSync(path.join(vus, f), 'utf8').slice(0, 600).match(uidRe) || [])[2] }))
    .filter((c) => c.v);
  if (!candidates.length) return null;
  const pools = fs.existsSync('source/data/pools')
    ? fs.readdirSync('source/data/pools').map((f) => fs.readFileSync(path.join('source/data/pools', f), 'utf8'))
    : [];
  const used = pools.filter((p) => new RegExp(`\\b${(p.match(/export const (\w+)/) || [])[1]}\\b`).test(flow));
  const portedVer = (used.map((p) => (p.match(/NeoLoad P_(\d+)_(\d+)_/) || []).slice(1).join('.')).find(Boolean) || '').trim();
  const byVer = (a, b) => b.v.localeCompare(a.v, undefined, { numeric: true });
  const pick = candidates.find((c) => c.v === portedVer) || candidates.sort(byVer)[0];
  console.log(
    `(VU resolved from the flow: ${pick.f}; versions available: ${candidates
      .map((c) => c.v)
      .sort()
      .join(', ')})`,
  );
  return path.join(vus, pick.f.replace(/\.xml$/, ''));
};
const treeDir = fs.existsSync(path.join(treeArg, 'team', 'vus')) ? resolveVu(treeArg) : treeArg.replace(/[\\/]+$/, '');
if (!treeDir) {
  console.error(`could not resolve a VU for ${flowArg} under ${treeArg}/team/vus — pass the VU tree dir`);
  process.exit(1);
}
for (const p of [treeDir, vuXmlPath(treeDir), flowArg]) {
  if (!fs.existsSync(p)) {
    console.error(`not found: ${p}`);
    process.exit(1);
  }
}
const root = findProjectRoot(treeDir);
if (!root) {
  console.error(`no NeoLoad project root (team/variables) above ${treeDir}`);
  process.exit(1);
}

let flags = 0;
const ok = (s) => console.log(`  OK    ${s}`);
const flag = (s) => {
  flags++;
  console.log(`  FLAG  ${s}`);
};
const info = (s) => console.log(`  INFO  ${s}`);
const section = (s) => console.log(`\n${s}`);
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(process.cwd(), p).replace(/\\/g, '/');
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
const md5 = (s) => crypto.createHash('md5').update(norm(s)).digest('hex').slice(0, 8);
const listTs = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? listTs(p) : e.name.endsWith('.ts') ? [p] : [];
      })
    : [];

// ---- k6 source index: function bodies + a regex call graph ------------------------------------
const bodyFrom = (text, start) => {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
};
const index = new Map();
const srcFiles = ['source/apis', 'source/flows', 'source/utils/helpers', 'source/data/payloads'].flatMap(listTs);
for (const file of srcFiles) {
  const text = read(file);
  for (const m of text.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g)) {
    let i = m.index + m[0].length;
    for (let depth = 1; depth && i < text.length; i++) depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0;
    const open = text.indexOf('{', i);
    index.set(m[1], { file, body: bodyFrom(text, open), line: text.slice(0, m.index).split('\n').length });
  }
  for (const m of text.matchAll(/export const (\w+)(?:\s*:\s*[^=]+)?\s*=\s*/g)) {
    if (index.has(m[1])) continue;
    const rest = text.slice(m.index + m[0].length);
    const end = rest.search(/\n(?:export |const |function )/);
    index.set(m[1], { file, body: end < 0 ? rest : rest.slice(0, end), line: text.slice(0, m.index).split('\n').length });
  }
}
const ENDPOINT = /['"`](?:\$\{[^}]+\}\/api\/|\/?api\/)?([A-Z][A-Za-z0-9]+\/[A-Z][A-Za-z0-9_]+)(?=['"`?])/g;
// every call site counts, so a wrapper called twice (or two wrappers sharing one post helper) reaches its
// endpoint twice; `stack` guards recursion only, `seen` collects every function reached for the later sections
const reach = (text, seen = new Set(), stack = new Set()) => {
  const endpoints = [...text.matchAll(ENDPOINT)].map((m) => m[1]);
  if (stack.size > 5) return { endpoints, seen };
  for (const m of text.matchAll(/\b([a-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const fn = m[1];
    if (stack.has(fn) || !index.has(fn)) continue;
    seen.add(fn);
    endpoints.push(...reach(index.get(fn).body, seen, new Set([...stack, fn])).endpoints);
  }
  return { endpoints, seen };
};
const count = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());

// ---- NeoLoad side -------------------------------------------------------------------------------
const tree = readTree(treeDir);
const vuHead = openTag(tree.vuXml, 'virtual-user');
const vuUid = attr(vuHead, 'uid');
const flowText = read(flowArg);
const journeyFn = (flowText.match(/export function (\w+_journey)\s*\(/) || [])[1];
const scenario = journeyFn ? journeyFn.replace(/_journey$/, '') : null;
console.log(`=== NEOLOAD PORT REVIEW: ${vuUid} → ${rel(flowArg)} (${journeyFn || 'no *_journey export'}) ===`);

// ---- 1. steps ↔ groups --------------------------------------------------------------------------
section('1. STEPS ↔ k6 GROUPS  (NeoLoad container order vs step-name strings in the flow)');
const stepPos = tree.steps.map((s) => ({ ...s, pos: flowText.indexOf(`'${s.name}'`) }));
for (const s of stepPos) (s.pos >= 0 ? ok : flag)(`${s.name}${s.pos >= 0 ? '' : '  — no group/step string in the flow'}`);
const found = stepPos.filter((s) => s.pos >= 0);
if (found.some((s, i) => i && s.pos < found[i - 1].pos)) flag('step strings appear in the flow out of NeoLoad order');
const extraGroups = [...flowText.matchAll(/'(T\d+_[A-Za-z]+_\d+_\w+)'/g)]
  .map((m) => m[1])
  .filter((n) => !tree.steps.some((s) => s.name === n));
for (const g of new Set(extraGroups)) flag(`flow names step '${g}', not in the NeoLoad VU`);
for (const o of tree.other) info(`non-step element in actions-container: ${o.root} ${o.name || o.file}`);

// ---- 2. spine coverage --------------------------------------------------------------------------
section('2. SPINE COVERAGE  (per step: NeoLoad SPINE endpoints vs endpoints the flow reaches)');
const ordered = [...found].sort((a, b) => a.pos - b.pos);
const chromeFile = path.join('source/data/chrome', path.basename(flowArg).replace(/\.flow\.ts$/, '.chrome.ts'));
const generatorText = fs.existsSync('.claude/scripts/gen-fidelity-lists.cjs') ? read('.claude/scripts/gen-fidelity-lists.cjs') : '';
const DEAD = [...((generatorText.match(/const DEAD = \[([^\]]*)\]/) || [])[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
const uiTier = new Map();
if (fs.existsSync(chromeFile)) {
  const text = read(chromeFile);
  // either quote style: the generator emits JSON (double quotes) and the pre-commit prettier pass rewrites it
  const marks = [...text.matchAll(/^\s{2}['"](\d+)['"]:\s*\[/gm)];
  marks.forEach((m, i) => {
    const chunk = text.slice(m.index, marks[i + 1] ? marks[i + 1].index : text.length);
    uiTier.set(m[1], count([...chunk.matchAll(/['"]?path['"]?:\s*['"]\/api\/([^'"?]+)/g)].map((x) => x[1])));
  });
}
const allReached = new Set();
for (const s of stepPos) {
  const nl = count(s.requests.filter((r) => r.cls === 'SPINE').map((r) => r.endpoint));
  const chrome = count(s.requests.filter((r) => r.cls === 'CHROME').map((r) => r.endpoint));
  const drops = s.requests.filter((r) => r.cls === 'DROP').length;
  let k6 = new Map();
  if (s.pos >= 0) {
    const lineStart = flowText.lastIndexOf('\n', s.pos) + 1;
    const next = ordered.find((o) => o.pos > s.pos);
    const slice = flowText.slice(lineStart, next ? flowText.lastIndexOf('\n', next.pos) + 1 : flowText.length);
    const r = reach(slice);
    r.seen.forEach((f) => allReached.add(f));
    k6 = count(r.endpoints);
  }
  console.log(
    `  [${s.name}]  spine ${[...nl.values()].reduce((a, b) => a + b, 0)} · chrome ${[...chrome.values()].reduce((a, b) => a + b, 0)} · static/telemetry ${drops}`,
  );
  const tier = uiTier.get((s.name.match(/_(\d+)_/) || [])[1]) || new Map();
  for (const [ep, n] of nl) {
    const got = k6.get(ep) || 0;
    const viaUi = Math.max(0, Math.min(tier.get(ep) || 0, n - got));
    if (got === n) ok(`${ep} ×${n}`);
    else if (got > n)
      info(`${ep} ×${n}  k6 reaches ${got} call sites — confirm the extras are conditional (fallback/retry), not double-fired`);
    else if (got + viaUi === n)
      info(`${ep} ×${n}  ${got ? `lean ×${got}, ` : ''}ui fidelity tier ×${viaUi} — confirm no write consumes its result`);
    else flag(`${ep}  NeoLoad ×${n}, k6 ×${got}${viaUi ? ` (+${viaUi} ui tier)` : ''}`);
  }
  for (const [ep, n] of k6) {
    if (nl.has(ep)) continue;
    if (chrome.has(ep)) info(`${ep} ×${n}  classed CHROME but reproduced — confirm it is load-bearing or deliberate`);
    else flag(`${ep} ×${n}  in k6, not recorded in this step`);
  }
  const chromeOnly = [...chrome.keys()].filter((ep) => !k6.has(ep));
  if (chromeOnly.length) info(`dropped as chrome: ${chromeOnly.join(', ')}`);
  // tier coverage: a recorded /api request is either reached by a wrapper or emitted to the ui tier — never
  // neither (the generator's exclusions can swallow an unscripted one) and never both (a double-fire at ui)
  if (fs.existsSync(chromeFile)) {
    const isApi = (ep) => /^[A-Z][A-Za-z0-9]+\/[A-Za-z]/.test(ep);
    for (const [ep, n] of chrome) {
      if (!isApi(ep) || DEAD.some((d) => d.endsWith(`/${ep}`))) continue;
      const got = k6.get(ep) || 0;
      const t = tier.get(ep) || 0;
      if (got + t < n)
        flag(`${ep}  recorded ×${n} (chrome), fired ×${got + t} (lean ×${got}, ui tier ×${t}) — ${n - got - t} fire at no tier`);
    }
    for (const [ep, n] of new Map([...nl, ...chrome].map(([ep]) => [ep, (nl.get(ep) || 0) + (chrome.get(ep) || 0)]))) {
      const got = k6.get(ep) || 0;
      const t = tier.get(ep) || 0;
      if (isApi(ep) && t > 0 && got + t > n) flag(`${ep}  recorded ×${n}, lean ×${got} + ui tier ×${t} — double-fired at -e FIDELITY=ui`);
    }
  }
  for (const n of s.nonHttp) if (!/think/i.test(n.file)) info(`non-HTTP action in step: ${n.root} (${n.file})`);
}
reach(flowText).seen.forEach((f) => allReached.add(f));
const scripts = path.join(treeDir, '%resources%', 'scripts');
if (fs.existsSync(scripts)) {
  for (const f of fs.readdirSync(scripts)) {
    const js = read(path.join(scripts, f));
    const sets = [...js.matchAll(/setValue\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const fns = [...js.matchAll(/function\s+(\w+)/g)].map((m) => m[1]);
    info(`jsAction ${f}: functions [${fns.join(', ')}] sets [${sets.join(', ')}] — confirm translated`);
  }
}

// ---- 3. correlation -----------------------------------------------------------------------------
section('3. CORRELATION  (each <variable-extractor> → where NeoLoad consumes it)');
const spineReqs = tree.steps.flatMap((s) => s.requests.map((r) => ({ ...r, step: s.name })));
const tokenText = (r) => `${r.rawPath}\n${r.template || ''}`;
const extracted = new Set();
const unconsumed = [];
for (const [i, r] of spineReqs.entries()) {
  for (const e of r.extractors) {
    extracted.add(e.name);
    const users = spineReqs.slice(i + 1).filter((u) => tokenText(u).includes(`\${${e.name}}`));
    const label = `${e.name} ← ${r.endpoint} [${r.step.replace(/^T\d+_[A-Za-z]+_/, '')}]`;
    if (!users.length) unconsumed.push(e.name);
    else {
      const byCls = users.map((u) => `${u.endpoint}${u.cls === 'SPINE' ? '' : `(${u.cls.toLowerCase()})`}`);
      ok(`${label} → ${[...new Set(byCls)].join(', ')}`);
    }
  }
}
if (unconsumed.length)
  info(`${unconsumed.length} extract(s) no later request consumes (safe to drop unless a jsAction reads them): ${unconsumed.join(', ')}`);
const consumedC = new Set(spineReqs.flatMap((r) => [...tokenText(r).matchAll(/\$\{(C_[A-Za-z0-9_]+)/g)].map((m) => m[1])));
for (const c of consumedC) {
  if (extracted.has(c) || extracted.has(c.replace(/_\d+$/, ''))) continue;
  if (c.endsWith('_')) info(`${c}… is a dynamically composed variable name — confirm its k6 source by hand`);
  else flag(`${c} consumed but extracted nowhere in this VU (jsAction or init-container?)`);
}

// ---- 4. token-literal leaks ---------------------------------------------------------------------
section('4. TOKEN-LITERAL LEAKS  (a recorded ${…} value still hardcoded in the k6 files the flow reaches)');
const scope = new Set([path.resolve(flowArg)]);
for (const fn of allReached) scope.add(path.resolve(index.get(fn).file));
const scopedText = [...scope].map((f) => ({ f, lines: read(f).split('\n') }));
const identifiers = new Set(scopedText.flatMap(({ lines }) => lines.join('\n').match(/\b\w+\b/g) || []));
for (const [name, e] of index)
  if (identifiers.has(name) && /payloads/.test(e.file) && !scope.has(path.resolve(e.file)))
    scopedText.push({ f: path.resolve(e.file), lines: read(e.file).split('\n') });
let aligned = 0;
let unaligned = [];
let leaks = 0;
const checked = new Set();
for (const r of spineReqs.filter((x) => x.cls === 'SPINE' && x.template && x.template.includes('${'))) {
  const rec = recordedRequest(treeDir, r);
  if (rec.err) {
    unaligned.push(`${r.endpoint} (${rec.err})`);
    continue;
  }
  const a = alignTokens(r.template, rec.body);
  if (!a.aligned) {
    unaligned.push(r.endpoint);
    continue;
  }
  aligned++;
  for (const { token, value } of a.values) {
    if (value == null || /^P_Performance_/.test(token)) continue;
    const numeric = /^\d+$/.test(value);
    if (value.length < (numeric ? 3 : 4) || /^(true|false|null)$/.test(value) || checked.has(value)) continue;
    checked.add(value);
    const bounded = new RegExp(`(^|[^\\w.])${value}([^\\w.]|$)`);
    const shown = /password|credential/i.test(token) ? '(masked)' : `"${value.slice(0, 40)}"`;
    for (const { f, lines } of scopedText) {
      const hit = lines.findIndex((l) => (numeric ? bounded.test(l) : l.includes(value)));
      if (hit < 0) continue;
      leaks++;
      flag(`\${${token}} recorded ${shown} hardcoded at ${rel(f)}:${hit + 1}`);
    }
  }
}
if (!leaks) ok(`no recorded token value found in ${scopedText.length} reached k6 files (${aligned} templated bodies aligned)`);
const handWritten = scopedText.filter(({ f }) => !/[\\/]data[\\/]payloads[\\/]/.test(f));
const LITERALS = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'GUID'],
  [/\b\d+\|[A-Za-z0-9+/=]{16,}/, 'bearer-token'],
];
let literals = 0;
for (const { f, lines } of handWritten)
  lines.forEach((l, i) => {
    for (const [re, what] of LITERALS)
      if (re.test(l)) {
        literals++;
        flag(`${what} literal at ${rel(f)}:${i + 1}`);
      }
  });
if (!literals) ok(`no GUID or bearer-token literal in the ${handWritten.length} hand-written k6 files`);
if (unaligned.length) info(`could not align ${unaligned.length} templated bodies to their recording: ${unaligned.join(', ')}`);

// ---- 5. variables / data pools ------------------------------------------------------------------
section('5. VARIABLES  (every ${P_…} the VU and its <VU>.xml reference, against variables/ and the k6 port)');
const defs = loadDefs(root);
const refs = refsInTree(treeDir);
const reachedText = [flowText, ...[...allReached].map((f) => index.get(f).body)].join('\n');
const poolModules = listTs('source/data/pools').map((f) => {
  const text = read(f);
  const listStart = text.indexOf('=');
  return {
    f,
    pool: (text.match(/NeoLoad (P_[A-Za-z0-9_]+) pool/) || [])[1],
    exportName: (text.match(/export const (\w+)/) || [])[1],
    values: [...text.slice(listStart).matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g)].map((m) =>
      (m[1] ?? m[2]).replace(/\\(.)/g, '$1'),
    ),
  };
});
const usedFiles = new Set();
const seedPrefixed = [];
const translation = (name, r) => {
  const has = (re) => re.test(reachedText);
  if (/thinkTime/i.test(name)) return ['think()', has(/\bthink\(/)];
  if (/Pacing/i.test(name)) {
    const neo = fs.existsSync('source/tests/neoload.spec.ts') ? read('source/tests/neoload.spec.ts') : '';
    const def = (neo.match(/PACING\s*=\s*Number\([^)]*\)\s*\|\|\s*(\d+)/) || [])[1];
    return [`pace(PACING) in neoload.spec.ts (default ${def ?? '?'}s)`, journeyFn ? neo.includes(journeyFn) : false];
  }
  if (r.tag === 'variable-counter' || /Iteration/i.test(name)) return ['iterationInTest / __ITER', has(/iterationInTest|__ITER/)];
  if (r.tag === 'variable-currentdate' || /Epoch|Timestamp|Date/i.test(name))
    return ['Date.now() / new Date()', has(/Date\.now\(\)|new Date\(/)];
  if (r.tag === 'variable-random-number') {
    const min = String(r.detail).match(/random (\d+)/)?.[1];
    return [`Math.random within ${r.detail.replace('random ', '')}`, has(/Math\.random/) && (!min || reachedText.includes(min))];
  }
  if (/Host|Site|Server|Version/i.test(name) || r.kind === 'lookup') return ['env.config.ts (baseUrl / version)', true];
  return [null, false];
};
for (const name of [...refs.keys()].sort()) {
  const def = defs.get(name);
  if (!def) {
    flag(`${name}: no definition in team/variables (VU-local or jsAction-set?) — confirm its k6 source`);
    continue;
  }
  const r = resolveDef(def, root);
  if (def.filename) usedFiles.add(path.resolve(root, def.filename));
  if (r.kind === 'pool' && !r.error && r.rows.length <= 1) r.kind = 'lookup';
  if (r.kind !== 'pool') {
    const [how, seen] = translation(name, r);
    const line = `${name} [${def.tag}] ${r.detail ?? ''} → ${how ?? '?'}`;
    if (!how) flag(`${line}: no known k6 translation — confirm by hand`);
    else if (seen) ok(line);
    else flag(`${line}: no evidence in the flow or the code it reaches`);
    continue;
  }
  if (r.error) {
    flag(`${name}: pool unresolved — ${r.error} (${r.source})`);
    continue;
  }
  const cols = [...refs.get(name)];
  const col = cols[0] || (r.columns[0] || {}).name;
  const values = poolValues(r, col);
  const pre = commonPrefix(values);
  if (pre.length >= 8) seedPrefixed.push(`${name} (prefix "${pre}")`);
  if (/UserCredentials/i.test(name)) {
    const users = [...read('source/data/creds/users.data.ts').matchAll(/username:\s*'([^']+)'/g)].map((m) => m[1]);
    const ucol = r.columns.find((c) => /user/i.test(c.name));
    const pool = new Set(poolValues(r, ucol ? ucol.name : 0));
    const missing = [...pool].filter((u) => !users.includes(u));
    (missing.length ? flag : ok)(
      `${name}: ${pool.size} NeoLoad users vs ${users.length} in users.data.ts${missing.length ? `, ${missing.length} missing (e.g. ${missing[0]})` : ', none missing'}`,
    );
    continue;
  }
  const base = (n) => (n || '').replace(/^P_\d+_\d+_/, '');
  const mod = poolModules.find((m) => m.pool === name) || poolModules.find((m) => m.pool && base(m.pool) === base(name));
  if (mod && mod.pool !== name)
    info(
      `${name}: pool module was generated from ${mod.pool} (another version's file) — the row check below compares against this VU's file`,
    );
  if (!mod) {
    flag(`${name}.${col}: ${values.length} rows, no source/data/pools module generated from it`);
  } else {
    const same = mod.values.length === values.length && mod.values.every((v, i) => v === values[i]);
    const missing = values.filter((v) => !mod.values.includes(v)).length;
    const extra = mod.values.filter((v) => !values.includes(v)).length;
    if (same) ok(`${name}.${col}: ${values.length}/${values.length} rows, same order → ${rel(mod.f)} (${mod.exportName})`);
    else {
      const noted = (read(mod.f).match(/^\/\*[\s\S]*?\*\//) || [''])[0].split('\n').length > 3;
      flag(
        `${name}.${col}: NeoLoad ${values.length} rows vs ${mod.values.length} in ${rel(mod.f)} (missing ${missing}, extra ${extra}${!missing && !extra ? ', order differs' : ''})${noted ? ' — its header documents a deviation; judge it' : ''}`,
      );
    }
    const picked = new RegExp(`pick_pool_value\\(\\s*${mod.exportName}\\b`).test(reachedText);
    (picked ? ok : flag)(`${mod.exportName} ${picked ? 'is' : 'is not'} selected with pick_pool_value in the flow`);
  }
  if (cols.length > 1) info(`${name} referenced by ${cols.length} columns (${cols.join(', ')}) — check each is carried`);
  const vm = (def.filename || '').replace(/\\/g, '/').match(/variables\/version_([\d_]+)\/P_\1_(.+)$/);
  if (vm) {
    const src = read(path.resolve(root, def.filename));
    const variants = fs
      .readdirSync(path.join(root, 'variables'))
      .filter((d) => /^version_/.test(d))
      .map((d) => {
        const v = d.replace('version_', '');
        const f = path.join(root, 'variables', d, `P_${v}_${vm[2]}`);
        return { d, state: !fs.existsSync(f) ? 'missing' : md5(read(f)) === md5(src) ? 'same' : 'DIFFERS' };
      });
    const summary = variants.map((x) => `${x.d.replace('version_', '')}:${x.state}`).join(' ');
    (variants.some((x) => x.state === 'DIFFERS') ? flag : info)(`${name} across versions → ${summary}`);
  }
}
const versionDirs = new Set([...usedFiles].map((f) => path.dirname(f)));
versionDirs.add(path.join(root, 'variables', 'common'));
for (const d of versionDirs) {
  if (!fs.existsSync(d)) continue;
  const unused = fs.readdirSync(d).filter((f) => !usedFiles.has(path.join(d, f)));
  if (unused.length)
    info(
      `${unused.length} file(s) in ${path.basename(d)}/ not referenced by this VU: ${unused.map((f) => f.replace(/^P_\d+_\d+_/, '').replace(/\.txt$/, '')).join(', ')}`,
    );
}

// ---- 6. seed / data-script ---------------------------------------------------------------------
section('6. SEED  (paired data-script VU via test-data population, DataWrite file chaining, seed-prefixed pools)');
const tNum = Number((vuUid.match(/^T0*(\d+)/i) || [])[1]);
const popsDir = path.join(root, 'team', 'populations');
const pops = fs.readdirSync(popsDir).map((f) => {
  const xml = read(path.join(popsDir, f));
  return {
    f,
    xml,
    splits: [...xml.matchAll(/virtualUserUid="([^"]+)"/g)].map((m) => m[1]),
    desc: (xml.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '',
  };
});
const inPops = pops.filter((p) => p.splits.includes(vuUid)).map((p) => p.f);
info(`${vuUid} runs in ${inPops.length} population(s): ${inPops.join(', ') || '(none)'}`);
const tdPops = pops.filter(
  (p) => /test@data/i.test(p.f) && (new RegExp(`@t0*${tNum}(?!\\d)`, 'i').test(p.f) || new RegExp(`\\bT0*${tNum}(?!\\d)`).test(p.desc)),
);
const dataScripts = [...new Set(tdPops.flatMap((p) => p.splits))];
const writers = [];
const vusDir = path.join(root, 'team', 'vus');
for (const v of fs.readdirSync(vusDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const sd = path.join(vusDir, v.name, '%resources%', 'scripts');
  if (!fs.existsSync(sd)) continue;
  for (const f of fs.readdirSync(sd)) {
    for (const m of read(path.join(sd, f)).matchAll(/writeVariableToFile\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g))
      writers.push({ vu: v.name, variable: m[1], file: m[2] });
  }
}
const key = (f) =>
  path
    .basename(f)
    .replace(/\.txt$/i, '')
    .replace(/^P_\d+_\d+_/, '')
    .replace(/^Data_/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
const chained = [];
for (const f of usedFiles)
  for (const w of writers)
    if (key(w.file) && key(w.file) === key(f)) chained.push(`${path.basename(f)} ← written by ${w.vu} (${w.variable} → ${w.file})`);
tdPops.forEach((p) => info(`test-data population ${p.f} → ${p.splits.join(', ')}`));
chained.forEach((c) => info(`DataWrite chain: ${c}`));
seedPrefixed.forEach((s) => info(`seed-prefixed pool: ${s}`));
if (!dataScripts.length && !chained.length && !seedPrefixed.length) {
  ok('no seed needed — no test-data population names this VU, no DataWrite writes a file it reads, no pool shares a generated prefix');
} else {
  flag('seed expected — review the data-script VU(s) below against source/seeds/');
  const heads = fs.readdirSync(vusDir).filter((f) => f.endsWith('.xml'));
  for (const uid of dataScripts) {
    const x = heads.find((f) => attr(openTag(read(path.join(vusDir, f)), 'virtual-user'), 'uid') === uid);
    if (!x) {
      flag(`data-script VU ${uid}: tree not found under team/vus`);
      continue;
    }
    const dt = readTree(path.join(vusDir, x.replace(/\.xml$/, '')));
    const loops =
      (read(path.join(vusDir, x)) + dt.steps.map((s) => s.nonHttp.map((n) => n.root).join(' ')).join(' ')).match(/loop/gi) || [];
    info(
      `${uid}: ${dt.steps.length} steps [${dt.steps.map((s) => s.name).join(', ')}]${loops.length ? `, ${loops.length} loop element(s)` : ''}`,
    );
  }
  for (const f of listTs('source/seeds'))
    info(`k6 seed ${rel(f)}: exports ${[...read(f).matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]).join(', ')}`);
  const smoke = fs.existsSync('source/tests/smoke.spec.ts') ? read('source/tests/smoke.spec.ts') : '';
  info(`smoke setup() discovery calls: ${[...smoke.matchAll(/\b(discover_\w+)\(/g)].map((m) => m[1]).join(', ') || '(none)'}`);
}

// ---- 7. SLA → thresholds ----------------------------------------------------------------------
section('7. SLA  (sla_profiles thresholds vs the journey thresholds object)');
const slaNames = new Set(tree.steps.map((s) => s.slaProfile).filter(Boolean));
if (attr(vuHead, 'slaProfileEnabled') === 'true') slaNames.add(attr(vuHead, 'slaProfileName'));
const slaDir = path.join(root, 'sla_profiles');
let avgLimitMs = null;
for (const n of slaNames) {
  const f =
    fs.existsSync(slaDir) && fs.readdirSync(slaDir).find((x) => attr(openTag(read(path.join(slaDir, x)), 'sla-profile'), 'name') === n);
  if (!f) {
    flag(`SLA profile ${n}: not found in sla_profiles/`);
    continue;
  }
  const xml = read(path.join(slaDir, f));
  for (const m of xml.matchAll(
    /<sla-threshold enabled="true"[^>]*identifier="([^"]+)"[^>]*>\s*<threshold-condition[^>]*operator="([^"]+)"[^>]*valueMin="([^"]+)"/g,
  )) {
    info(`${n}: ${m[1]} ${m[2]} ${m[3]}`);
    if (m[1] === 'AVERAGE_REQUEST_RESPONSE_TIME') avgLimitMs = Number(m[3]) * 1000;
  }
}
const thrName = (flowText.match(/export const (\w+Thresholds)\s*=/) || [])[1];
const thrBlock = thrName ? bodyFrom(flowText, flowText.indexOf('{', flowText.indexOf(thrName))) : '';
const thr = new Map([...thrBlock.matchAll(/\{name:([^}]+)\}'\s*:\s*\[([^\]]*)\]/g)].map((m) => [m[1], m[2]]));
const otherThr = new Set(
  listTs('source/flows')
    .filter((f) => path.resolve(f) !== path.resolve(flowArg))
    .flatMap((f) => [...read(f).matchAll(/\{name:([^}]+)\}/g)].map((m) => m[1])),
);
const tags = new Set();
for (const fn of allReached) for (const m of index.get(fn).body.matchAll(/\bname\s*[=:]\s*'([A-Z]\w+)'/g)) tags.add(m[1]);
for (const [fn, e] of index)
  if (allReached.has(fn))
    for (const m of (read(e.file).match(new RegExp(`function ${fn}\\([^)]*\\bname\\s*=\\s*'([A-Z]\\w+)'`)) || []).slice(1)) tags.add(m);
for (const m of flowText.matchAll(/,\s*'([A-Z][A-Za-z0-9]+)'\s*\)/g)) tags.add(m[1]);
if (!thrName) flag('no exported *Thresholds object in the flow');
else {
  const helperTags = new Set(
    [...index.values()]
      .filter((e) => path.normalize(e.file).split(path.sep).includes('helpers'))
      .flatMap((e) => [...read(e.file).matchAll(/\bname\s*[=:]\s*'([A-Z]\w+)'/g)].map((m) => m[1])),
  );
  for (const t of tags) {
    if (thr.has(t) || otherThr.has(t)) continue;
    if (helperTags.has(t)) info(`request tag ${t} (shared helper) has no threshold — matches the other journeys unless the SLA needs it`);
    else flag(`request tag ${t} has no threshold in ${thrName}`);
  }
  for (const [t, v] of thr) {
    if (!tags.has(t)) flag(`${thrName} has '${t}', which no reached request is tagged with`);
    else if (avgLimitMs != null && !v.includes(`avg<${avgLimitMs}`)) flag(`${t}: ${v.trim()} — SLA says avg<${avgLimitMs}`);
  }
  if (avgLimitMs != null && [...thr.values()].every((v) => v.includes(`avg<${avgLimitMs}`)))
    ok(`${thr.size} thresholds, all avg<${avgLimitMs} per the SLA`);
}

// ---- 8. wiring --------------------------------------------------------------------------------
section('8. WIRING');
const has = (f, s) => fs.existsSync(f) && read(f).includes(s);
if (scenario) {
  const smoke = 'source/tests/smoke.spec.ts';
  (has(smoke, `${scenario}: once(`) ? ok : flag)(`smoke.spec.ts scenario ${scenario}`);
  (thrName && has(smoke, `${scenario}: ${thrName}`) ? ok : flag)(`smoke.spec.ts threshold map ${scenario}: ${thrName}`);
  (has(smoke, `export function ${scenario}(`) ? ok : flag)(`smoke.spec.ts exec wrapper ${scenario}()`);
  (has('source/tests/neoload.spec.ts', journeyFn) ? ok : info)(
    `neoload.spec.ts ${has('source/tests/neoload.spec.ts', journeyFn) ? 'registers' : 'does not register'} ${journeyFn} (pacing / load run)`,
  );
}
(has('source/utils/exports/flows.exp.ts', path.basename(flowArg)) ? ok : flag)(`flows.exp.ts exports ${path.basename(flowArg)}`);
for (const m of poolModules.filter((p) => p.exportName && new RegExp(`\\b${p.exportName}\\b`).test(flowText)))
  (has('source/utils/exports/data.exp.ts', path.basename(m.f)) ? ok : flag)(`data.exp.ts exports ${path.basename(m.f)}`);

console.log(`\n=== ${flags} FLAG(s) ===`);
