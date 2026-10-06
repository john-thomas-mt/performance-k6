// Cross-check a finished NeoLoad → k6 port against its recording — the evidence half of the
// neoload-port-review skill. Zero traffic: it reads the NeoLoad tree, the project's variables/ and
// populations, and the k6 source, and prints one compact report of OK / FLAG / INFO lines per area
// (steps, spine coverage and lean-path order, fidelity tiers, correlation, token-literal leaks and transport
// tables column by column, test-data names, variables/pools, the seed against its data-script VU, SLA, wiring). The
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
  // uid "T03_ViewContact_ServiceOrder (26.3)"; single-step T006_Badge_Report → uid "T06_BadgeReport (26.3)"),
  // so match on the number plus the name's leading segment
  const m = flow.match(/'T0*(\d+)_([A-Za-z]+)[A-Za-z0-9_]*'/);
  if (!m) return null;
  const vus = path.join(projectRoot, 'team', 'vus');
  const uidRe = new RegExp(`uid="T0*${m[1]}_(${m[2]}[^"]*?) \\(([\\d.]+)\\)"`, 'i');
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
// source/seeds too: section 6 follows a seed's default function through the same wrappers and builders. k6's
// lifecycle names (setup, options) are left out: every seed and spec has its own, and a comment's "setup()" would
// otherwise reach one
const LIFECYCLE = new Set(['setup', 'teardown', 'handleSummary', 'options']);
const srcFiles = ['source/apis', 'source/flows', 'source/utils/helpers', 'source/data/payloads', 'source/seeds'].flatMap(listTs);
for (const file of srcFiles) {
  const text = read(file);
  // line-anchored, so a comment's "the function Save2 (window EM9685)" is not a declaration
  for (const m of text.matchAll(/^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm)) {
    let i = m.index + m[0].length;
    for (let depth = 1; depth && i < text.length; i++) depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0;
    const open = text.indexOf('{', i);
    const line = (at) => text.slice(0, at).split('\n').length;
    if (LIFECYCLE.has(m[1])) continue;
    index.set(m[1], { file, body: bodyFrom(text, open), line: line(m.index), bodyLine: line(open) });
  }
  // top-level consts, exported or not: a builder often keeps its table in a module-local const (eventCopyTable)
  for (const m of text.matchAll(/^(?:export )?const (\w+)(?:\s*:\s*[^=]+)?\s*=\s*/gm)) {
    if (index.has(m[1]) || LIFECYCLE.has(m[1])) continue;
    const rest = text.slice(m.index + m[0].length);
    const end = rest.search(/\n(?:export |const |function )/);
    const line = text.slice(0, m.index).split('\n').length;
    index.set(m[1], {
      file,
      body: end < 0 ? rest : rest.slice(0, end),
      line,
      bodyLine: text.slice(0, m.index + m[0].length).split('\n').length,
    });
  }
}
// the method segment can be lowercase (USIMultiSelectSuperBoxPageServer/save)
const ENDPOINT = /['"`](?:\$\{[^}]+\}\/api\/|\/?api\/)?([A-Z][A-Za-z0-9]+\/[A-Za-z][A-Za-z0-9_]+)(?=['"`?])/g;
// the public REST API (/api/v1/Reports/10/204/RunReport) has more than two segments; key it the way the NeoLoad side does
const PUBLIC_API_ENDPOINT = /\/api\/(v\d+(?:\/[A-Za-z0-9_]+)+)(?=['"`?])/g;
// every call site counts, so a wrapper called twice (or two wrappers sharing one post helper) reaches its
// endpoint twice; `stack` guards recursion only, `seen` collects every function reached for the later sections
// `xf` rewrites the text at every level (stripGuarded gives the lean path)
const reach = (text, seen = new Set(), stack = new Set(), xf = (t) => t) => {
  text = xf(text);
  const endpoints = [...text.matchAll(ENDPOINT), ...text.matchAll(PUBLIC_API_ENDPOINT)].map((m) => m[1]);
  if (stack.size > 5) return { endpoints, seen };
  for (const m of text.matchAll(/\b([a-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const fn = m[1];
    if (stack.has(fn) || !index.has(fn)) continue;
    seen.add(fn);
    endpoints.push(...reach(index.get(fn).body, seen, new Set([...stack, fn]), xf).endpoints);
  }
  return { endpoints, seen };
};
// the end of the statement starting at i: a { … } block, or up to the `;` at depth 0
const statementEnd = (text, i) => {
  while (/\s/.test(text[i])) i++;
  if (text[i] === '{') return i + bodyFrom(text, i).length;
  for (let depth = 0; i < text.length; i++) {
    if ('([{'.includes(text[i])) depth++;
    else if (')]}'.includes(text[i])) depth--;
    else if (text[i] === ';' && depth === 0) return i + 1;
  }
  return i;
};
// drop what a fidelity guard gates (`if (include_ui(level)) stmt;` / `if (include_static(level)) { … }`), leaving
// the lean path: the requests a -e FIDELITY=lean run sends
const GUARD = /\bif\s*\(\s*include_(?:ui|static)\s*\(/g;
const stripGuarded = (text) => {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(GUARD)) {
    if (m.index < last) continue;
    let i = m.index + m[0].length;
    for (let depth = 2; depth && i < text.length; i++) depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0;
    out += text.slice(last, m.index);
    last = statementEnd(text, i);
  }
  return out + text.slice(last);
};
// endpoints in call order, following wrappers depth-first: the sequence a run sends them in
const reachSeq = (text, stack = new Set(), xf = (t) => t) => {
  text = xf(text);
  const hits = [
    ...[...text.matchAll(ENDPOINT), ...text.matchAll(PUBLIC_API_ENDPOINT)].map((m) => ({ i: m.index, ep: m[1] })),
    ...[...text.matchAll(/\b([a-z_][A-Za-z0-9_]*)\s*\(/g)]
      .filter((m) => index.has(m[1]) && !stack.has(m[1]) && stack.size <= 5)
      .map((m) => ({ i: m.index, fn: m[1] })),
  ].sort((a, b) => a.i - b.i);
  return hits.flatMap((h) => (h.ep ? [h.ep] : reachSeq(index.get(h.fn).body, new Set([...stack, h.fn]), xf)));
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
// a step inside a logic action runs as that action decides: a loop repeats it, an if-action runs one branch
for (const s of stepPos.filter((x) => x.within.length))
  info(
    `${s.name} runs inside ${s.within.join(' > ')}${s.loop > 1 ? ` — the flow must repeat it ${s.loop} times per iteration` : ' — confirm the flow takes the branch(es) the recording does'}`,
  );
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
const stepSeen = new Map();
const stepLean = new Map();
let recordedTierRequests = 0;
for (const s of stepPos) {
  const nl = count(s.requests.filter((r) => r.cls === 'SPINE').map((r) => r.endpoint));
  const chrome = count(s.requests.filter((r) => r.cls === 'CHROME').map((r) => r.endpoint));
  const drops = s.requests.filter((r) => r.cls === 'DROP').length;
  recordedTierRequests += [...chrome.values()].reduce((a, b) => a + b, 0) + drops;
  let k6 = new Map();
  let lean = new Map();
  let leanSeq = [];
  if (s.pos >= 0) {
    const lineStart = flowText.lastIndexOf('\n', s.pos) + 1;
    const next = ordered.find((o) => o.pos > s.pos);
    const slice = flowText.slice(lineStart, next ? flowText.lastIndexOf('\n', next.pos) + 1 : flowText.length);
    const r = reach(slice);
    r.seen.forEach((f) => allReached.add(f));
    stepSeen.set(s.name, r.seen);
    k6 = count(r.endpoints);
    lean = count(reach(slice, new Set(), new Set(), stripGuarded).endpoints);
    leanSeq = reachSeq(slice, new Set(), stripGuarded);
    stepLean.set(s.name, lean);
  }
  console.log(
    `  [${s.name}]  spine ${[...nl.values()].reduce((a, b) => a + b, 0)} · chrome ${[...chrome.values()].reduce((a, b) => a + b, 0)} · static/telemetry ${drops}`,
  );
  const tier = uiTier.get((s.name.match(/_(\d+)_/) || [])[1]) || new Map();
  for (const [ep, n] of nl) {
    const got = k6.get(ep) || 0;
    const viaUi = Math.max(0, Math.min(tier.get(ep) || 0, n - got));
    const leanGot = lean.get(ep) || 0;
    if (got === n && leanGot < n)
      flag(
        `${ep} ×${n}  lean ×${leanGot}: ${n - leanGot} reached only behind include_ui/include_static, so a -e FIDELITY=lean run skips a recorded spine request`,
      );
    else if (got === n) ok(`${ep} ×${n}`);
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
  // the lean spine in call order against the recorded order, when both send the same requests (a fallback or a
  // count mismatch is reported above instead)
  // Requests in one page fire in parallel, so only the page order counts: the n-th k6 call to an endpoint is the
  // n-th recorded one, and its page may not come before the previous call's page
  const spineRecs = s.requests.filter((r) => r.cls === 'SPINE');
  const recSeq = spineRecs.map((r) => r.endpoint);
  const k6Seq = leanSeq.filter((ep) => nl.has(ep));
  if ([...recSeq].sort().join() === [...k6Seq].sort().join()) {
    const pageNo = new Map(s.pages.map((p, i) => [p.uid, i]));
    const seen = new Map();
    const pages = k6Seq.map((ep) => {
      const nth = seen.get(ep) || 0;
      seen.set(ep, nth + 1);
      return pageNo.get(spineRecs.filter((r) => r.endpoint === ep)[nth].uid);
    });
    const at = pages.findIndex((p, i) => i && p < pages[i - 1]);
    if (at > 0)
      flag(
        `spine order differs from the recording: k6 sends ${k6Seq[at - 1]} → ${k6Seq[at]}, the recording sends ${k6Seq[at]} on an earlier page`,
      );
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
const reachedText = [flowText, ...[...allReached].map((f) => index.get(f).body)].join('\n');
const JS_TRANSLATIONS = {
  P_jwtToken: ['mint_api_jwt() (auth.helper.ts)', /\bmint_api_jwt\(/],
};
const jsTranslated = (name) => {
  const t = JS_TRANSLATIONS[name];
  return t ? [t[0], t[1].test(reachedText)] : [null, false];
};
const jsSets = new Map();
// a jsAction that composes the name (setValue(varName + suffix) over a { 'C_CUST_NBR': 'EV200_CUST_NBR', … } map)
// sets <key>_1…<key>_n; the map's keys are the bases
const jsDynamic = new Map();
// a jsAction that loops a map and passes the loop key straight to setValue (for (var v in map) setValue(v, …)) sets
// the map's keys exactly, typically one variable per column of a row it picked
const jsKeyMapped = new Map();
// the variables each jsAction reads, to tell which extract feeds it
const jsReads = new Map();
const scripts = path.join(treeDir, '%resources%', 'scripts');
if (fs.existsSync(scripts)) {
  for (const f of fs.readdirSync(scripts)) {
    const js = read(path.join(scripts, f));
    const sets = [...new Set([...js.matchAll(/setValue\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
    const keyMapped = [];
    for (const m of js.matchAll(/for\s*\(\s*(?:var|let|const)\s+(\w+)\s+in\s+(\w+)\s*\)/g)) {
      if (!new RegExp(`setValue\\s*\\(\\s*${m[1]}\\s*,`).test(js)) continue;
      const map = js.match(new RegExp(`\\b${m[2]}\\s*=\\s*\\{([\\s\\S]*?)\\}`));
      if (map) keyMapped.push(...[...map[1].matchAll(/['"]([CP]_[A-Za-z0-9_]+)['"]\s*:/g)].map((k) => k[1]));
    }
    const bases = /setValue\s*\(\s*[A-Za-z_]/.test(js)
      ? [...js.matchAll(/['"]([CP]_[A-Za-z0-9_]+)['"]\s*:/g)].map((m) => m[1]).filter((b) => !keyMapped.includes(b))
      : [];
    const fns = [...js.matchAll(/function\s+(\w+)/g)].map((m) => m[1]);
    jsReads.set(f, [...new Set([...js.matchAll(/getValue\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))]);
    sets.forEach((v) => jsSets.set(v, f));
    keyMapped.forEach((v) => {
      jsSets.set(v, f);
      jsKeyMapped.set(v, f);
    });
    bases.forEach((b) => jsDynamic.set(b, f));
    const done = sets.length > 0 && !keyMapped.length && sets.every((v) => jsTranslated(v)[1]);
    const composed = bases.length ? ` + composed [${bases.map((b) => `${b}_<n>`).join(', ')}]` : '';
    const mapped = keyMapped.length ? ` + key map [${keyMapped.join(', ')}]` : '';
    (done ? ok : info)(
      `jsAction ${f}: functions [${fns.join(', ')}] sets [${sets.join(', ')}]${mapped}${composed} — ${done ? `translated (${sets.map((v) => jsTranslated(v)[0]).join(', ')})` : 'confirm translated'}`,
    );
  }
}

// ---- 2b. fidelity tiers, page by page -----------------------------------------------------------
// NeoLoad fires a step's pages in sequence and each page's actions in parallel; the generator emits one array
// per page per tier so the fire helpers send one http.batch per page. Check every generated page against the
// recording: it holds requests from exactly one recorded page, pages come in recorded order, and every enabled
// non-api request a page recorded lands in a tier (api requests are covered per endpoint in section 2).
section('2b. FIDELITY TIERS  (page by page: one batch per recorded page, recorded order, every request placed)');
const tierFile = (dir, ext) => path.join(dir, path.basename(flowArg).replace(/\.flow\.ts$/, ext));
const tierFiles = {
  chrome: tierFile('source/data/chrome', '.chrome.ts'),
  static: tierFile('source/data/static', '.static.ts'),
  transport: tierFile('source/data/transport', '.transport.ts'),
};
const loadTier = (f) => {
  const text = read(f);
  const start = text.indexOf('=', text.indexOf('export const'));
  return new Function(
    `return (${text
      .slice(start + 1)
      .trim()
      .replace(/;\s*$/, '')});`,
  )();
};
const listIn = (name) =>
  [...((generatorText.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`)) || [])[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
const GLOBAL_SPINE = listIn('SPINE');
const firesTiers = /\bfire_(?:ui_chrome|static_assets|transport)\s*\(/.test(flowText);
if (!Object.values(tierFiles).every((f) => fs.existsSync(f))) {
  // tiers are mandatory for every port: a recording with chrome/static requests and no tier set means a
  // -e FIDELITY=ui/full run sends only the spine
  (recordedTierRequests ? flag : info)(
    `no complete tier set for this journey (${Object.values(tierFiles).map(rel).join(', ')})${recordedTierRequests ? ` though the recording has ${recordedTierRequests} chrome/static/telemetry requests — generate them with gen-fidelity-lists.cjs` : ' — skipped'}`,
  );
  if (recordedTierRequests && !firesTiers) flag('the flow calls none of fire_ui_chrome / fire_static_assets / fire_transport');
} else {
  if (!firesTiers) flag('tier files exist but the flow calls none of fire_ui_chrome / fire_static_assets / fire_transport');
  const tiers = Object.fromEntries(Object.entries(tierFiles).map(([t, f]) => [t, loadTier(f)]));
  // a pool variable carries its version (${P_26_2_CopyServiceOrders.eventName}); a tier generated from another
  // version's VU of the same journey differs only in that prefix, so match on the unversioned name
  const unver = (s) => s.replace(/\$\{P_\d+_\d+_/g, '${P_v_');
  const vuVer = (vuUid.match(/\((\d+)\.(\d+)\)/) || []).slice(1).join('_');
  const tierVers = new Set(Object.values(tierFiles).flatMap((f) => [...read(f).matchAll(/\$\{P_(\d+_\d+)_/g)].map((m) => m[1])));
  const otherVers = [...tierVers].filter((v) => v !== vuVer);
  if (otherVers.length)
    info(
      `tier files reference version ${otherVers.join(', ')} variables (\${P_${otherVers[0]}_…}) while this VU is ${vuVer}: generated from that version's VU; prefixes ignored for the page match`,
    );
  const recKey = (tier, a) =>
    unver(tier === 'static' ? a.tier.bare : `${a.method} ${a.tier.url} ${a.method !== 'GET' && a.body !== undefined ? a.body : ''}`);
  const genKey = (tier, r) => unver(tier === 'static' ? r.path : `${r.method} ${r.path} ${r.body ?? ''}`);
  const label = (p) => (p.name || p.file).replace(/^\/[^/]+\//, '/');
  const numbered = tree.steps.some((s) => /_(\d+)(?:_|$)/.test(path.basename(s.dir)));
  let pagesChecked = 0;
  tree.steps.forEach((s, i) => {
    const stepNo = (path.basename(s.dir).match(/_(\d+)(?:_|$)/) || [])[1] || (numbered ? null : String(i + 1).padStart(2, '0'));
    if (!stepNo) return;
    const rec = s.pages.map((p) => ({ ...p, actions: p.actions.filter((a) => a.enabled) }));
    const used = rec.map((p) => p.actions.map(() => false));
    const take = (k, tier, keys, commit) => {
      const picked = [];
      for (const key of keys) {
        const idx = rec[k].actions.findIndex((a, j) => !used[k][j] && !picked.includes(j) && recKey(tier, a) === key);
        if (idx < 0) return false;
        picked.push(idx);
      }
      if (commit) picked.forEach((j) => (used[k][j] = true));
      return true;
    };
    const counts = [];
    let bad = 0;
    for (const tier of Object.keys(tiers)) {
      const gen = tiers[tier][stepNo] || [];
      counts.push(`${tier} ${gen.length}`);
      let prev = 0;
      const breaks = [];
      gen.forEach((page, j) => {
        const keys = page.map((r) => genKey(tier, r));
        let k = rec.findIndex((_, x) => x >= prev && take(x, tier, keys, false));
        if (k < 0) {
          k = rec.findIndex((_, x) => take(x, tier, keys, false));
          if (k >= 0) breaks.push(`page ${j + 1} (${label(rec[k])}) fires after ${label(rec[prev - 1])}`);
        }
        if (k < 0) {
          bad++;
          flag(`[${stepNo}] ${tier} page ${j + 1} (${page.length} requests, first ${page[0].path}) matches no single recorded page`);
          return;
        }
        take(k, tier, keys, true);
        prev = k + 1;
      });
      pagesChecked += gen.length;
      bad += breaks.length ? 1 : 0;
      if (breaks.length) flag(`[${stepNo}] ${tier}: ${breaks.length} of ${gen.length} pages out of recorded order — first: ${breaks[0]}`);
    }
    const unplaced = [];
    rec.forEach((p, k) =>
      p.actions.forEach((a, j) => {
        const bare = a.tier.bare;
        if (used[k][j] || bare.startsWith('/api/')) return;
        if ([...GLOBAL_SPINE, ...DEAD].some((x) => bare.startsWith(x))) return;
        if (bare.endsWith('app85.cshtml') && !a.tier.params.length) return;
        unplaced.push(`${bare} (${label(p)})`);
      }),
    );
    if (unplaced.length)
      flag(`[${stepNo}] ${unplaced.length} recorded non-api request(s) fire at no tier — first: ${unplaced.slice(0, 3).join(', ')}`);
    const sequential = rec.filter((p, k) => p.sequential && used[k].filter(Boolean).length > 1);
    if (sequential.length)
      flag(
        `[${stepNo}] ${sequential.length} page(s) set playRequestsSequentially but replayed as one parallel batch — first: ${label(sequential[0])}`,
      );
    if (!bad && !unplaced.length && !sequential.length)
      ok(`[${stepNo}] ${rec.length} recorded pages → ${counts.join(' · ')} tier pages; every non-api request placed`);
  });
  info(`${pagesChecked} generated tier pages checked against the recording (order breaks and unmatched pages FLAG above)`);
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
const keyMappedUse = new Map();
for (const c of consumedC) {
  const base = c.replace(/_\d+$/, '');
  if (extracted.has(c) || extracted.has(base)) continue;
  if (jsKeyMapped.has(c)) {
    const f = jsKeyMapped.get(c);
    keyMappedUse.set(f, [...(keyMappedUse.get(f) || []), c]);
  } else if (base !== c && jsDynamic.has(base)) {
    const inK6 = new RegExp(`\\b${c}\\b`).test(reachedText);
    (inK6 ? ok : flag)(
      `${c} set by jsAction ${jsDynamic.get(base)} (composed name ${base}_<n>)${inK6 ? ' → the flow sets it' : ': nothing in k6 sets it'}`,
    );
  } else if (c.endsWith('_')) info(`${c}… is a dynamically composed variable name — confirm its k6 source by hand`);
  else {
    // a name one suffix short of what a jsAction sets is a NeoLoad typo: the token goes out unresolved
    const near = [...jsSets.keys()].find((n) => n.startsWith(`${c}_`));
    if (near)
      info(
        `${c} is set nowhere, but jsAction ${jsSets.get(near)} sets ${near}: a NeoLoad typo, so it sends the token unresolved; k6 should send the real value`,
      );
    else flag(`${c} consumed but extracted nowhere in this VU (jsAction or init-container?)`);
  }
}
for (const [f, names] of keyMappedUse) {
  const from = (jsReads.get(f) || []).join(', ') || 'no getValue';
  info(
    `${names.length} variable(s) set by jsAction ${f} from its key map over ${from}: ${names.join(', ')}. Confirm k6 takes them from the same row (a parsed grid row, not a captured value)`,
  );
}

// ---- 4. token-literal leaks ---------------------------------------------------------------------
section('4. TOKEN-LITERAL LEAKS  (a recorded ${…} value still hardcoded in the k6 files the flow reaches)');
// scan what the journey itself sends: the flow file plus the bodies of the functions its journey reaches, and the
// payload consts those bodies name. A whole wrapper or builder file would drag in code only other journeys or the
// seed run (a shared events.api.ts imports copy-event's savePayload)
const journeyEntry = journeyFn && index.get(journeyFn);
const journeyReached = journeyEntry ? reach(journeyEntry.body).seen : new Set(allReached);
const scopedText = [{ f: path.resolve(flowArg), lines: read(flowArg).split('\n'), offset: 0 }];
const unitNames = new Set();
const addUnit = (name) => {
  const e = index.get(name);
  if (!e || unitNames.has(name) || path.resolve(e.file) === path.resolve(flowArg)) return;
  unitNames.add(name);
  scopedText.push({ f: path.resolve(e.file), lines: e.body.split('\n'), offset: e.bodyLine - 1, name });
};
journeyReached.forEach(addUnit);
const unitText = scopedText.map((u) => u.lines.join('\n')).join('\n');
for (const [name, e] of index) if (/payloads/.test(e.file) && new RegExp(`\\b${name}\\b`).test(unitText)) addUnit(name);
const isComment = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);
// the TransportDataColumns + TransportDataRows tables in a recorded body template, first row keyed by ColumnID
const nlTables = (tpl) => {
  const body = tpl.startsWith('Encoded(Base64):') ? Buffer.from(tpl.slice(16), 'base64').toString('utf8') : tpl;
  let j;
  try {
    j = JSON.parse(body.replace(/([:[,]\s*)(\$\{[^}]+\})(?=\s*[,}\]])/g, '$1"$2"'));
  } catch {
    return [];
  }
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v.TransportDataColumns) && Array.isArray(v.TransportDataRows) && v.TransportDataRows.length)
      out.push({
        names: new Map(v.TransportDataColumns.map((c) => [String(c.ColumnID), c.ColumnName])),
        row: v.TransportDataRows[0].Values || {},
      });
    Object.values(v).forEach(walk);
  };
  walk(j);
  return out;
};
// an extracted value the extracting request's own template already sends as a plain literal is the recorder's
// typed input, echoed back by the server (HandleDependentFields2 sends "1": "Performance" and C_LeadFirstName reads
// Values.1 from its response; CreateNewRows sends {"Key": "EV700_ALT_FUNC_DESC", "Value": "Planning - alt 1"}).
// The template, not the resolved recording: a value NeoLoad generates (DemoFile_${…}.rpt) is never a literal there.
const decoded = (tpl) => (tpl.startsWith('Encoded(Base64):') ? Buffer.from(tpl.slice(16), 'base64').toString('utf8') : tpl);
const echoed = (token, value, reqs = spineReqs) =>
  reqs.some((r) => {
    const e = r.extractors.find((x) => x.name === token);
    if (!e || !r.template) return false;
    const col = ((e.jsonpath || '').match(/\.(\d+)$/) || [])[1];
    if (col !== undefined && nlTables(r.template).some((t) => String(t.row[col]) === value)) return true;
    return decoded(r.template).includes(`"${value}"`);
  });
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
    // a bare number matches any width or count (Width: 100), so a numeric value counts only as a quoted literal
    const quoted = new RegExp(`['"\`]${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
    const shown = /password|credential/i.test(token) ? '(masked)' : `"${value.slice(0, 40)}"`;
    for (const { f, lines, offset } of scopedText) {
      const hit = lines.findIndex((l) => !isComment(l) && (numeric ? quoted.test(l) : l.includes(value)));
      if (hit < 0) continue;
      const where = `${rel(f)}:${offset + hit + 1}`;
      if (echoed(token, value)) {
        info(
          `\${${token}} recorded ${shown} hardcoded at ${where}: the request that extracts it sent the same value (typed input echoed back)`,
        );
        continue;
      }
      leaks++;
      flag(`\${${token}} recorded ${shown} hardcoded at ${where}`);
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
for (const { f, lines, offset } of handWritten)
  lines.forEach((l, i) => {
    for (const [re, what] of LITERALS)
      if (re.test(l)) {
        literals++;
        flag(`${what} literal at ${rel(f)}:${offset + i + 1}`);
      }
  });
if (!literals) ok(`no GUID or bearer-token literal in the ${handWritten.length} hand-written k6 units the journey reaches`);
if (unaligned.length) info(`could not align ${unaligned.length} templated bodies to their recording: ${unaligned.join(', ')}`);

// 4b. transport tables column by column. A Save2 / HandleDependentFields2 body is a TransportDataColumns +
// TransportDataRows table, often too large or reshaped for the token alignment above, so compare the recorded
// first row to the k6 builder's by ColumnName: a column NeoLoad fills from a token that k6 sends as a literal, or a
// literal option (Y/N, *ALL, a code) that differs from the recording.
const defs = loadDefs(root);
const constantVar = (name) => {
  const def = defs.get(name);
  if (!def) return false;
  const r = resolveDef(def, root);
  return r.kind === 'constant' || (r.kind === 'pool' && !r.error && r.rows.length <= 1);
};
const blockFrom = (text, start) => {
  const close = { '{': '}', '[': ']' }[text[start]];
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === text[start]) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
};
// the TransportDataColumns tables the payload builders in `units` declare, first row keyed by ColumnName
// the entries of a { … } block split at its top-level commas, each with its offset in the block
const topLevelEntries = (block) => {
  const out = [];
  let depth = 0;
  let from = 1;
  for (let i = 1; i < block.length - 1; i++) {
    const c = block[i];
    // a why-comment at a cell can hold an apostrophe or a comma
    if (c === '/' && block[i + 1] === '/') i = block.indexOf('\n', i) < 0 ? block.length : block.indexOf('\n', i);
    else if (c === '/' && block[i + 1] === '*') i = block.indexOf('*/', i + 2) < 0 ? block.length : block.indexOf('*/', i + 2) + 1;
    else if (c === "'" || c === '"' || c === '`') {
      for (i++; i < block.length && block[i] !== c; i++) if (block[i] === '\\') i++;
    } else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      out.push({ text: block.slice(from, i), at: from });
      from = i + 1;
    }
  }
  out.push({ text: block.slice(from, block.length - 1), at: from });
  return out.filter((e) => e.text.trim());
};
// A table is a literal `TransportDataColumns: [ … ]` or one naming a module const (`TransportDataColumns:
// reportListColumns`), with its first row's Values one cell per line or all on one line. A builder that echoes a live
// table instead (`set_cell(header, 'EV200_CUST_NBR', account)` on a TransportTable it was passed) yields an `echo`
// table holding only the cells it sets.
const tablesOf = (units) => {
  const out = [];
  for (const { f, lines, offset, name: unit } of units.filter((u) => /[\\/]payloads[\\/]/.test(u.f))) {
    const text = lines.join('\n');
    const lineAt = (i) => offset + text.slice(0, i).split('\n').length;
    for (const m of text.matchAll(/TransportDataColumns\s*:\s*(\[|([A-Za-z_]\w*))/g)) {
      const colsText = m[2] ? (index.get(m[2])?.body ?? '') : blockFrom(text, m.index + m[0].length - 1);
      const names = new Map();
      for (const entry of colsText.match(/\{[^{}]*\}/g) || []) {
        const name = (entry.match(/ColumnName:\s*'([^']*)'/) || [])[1];
        const id = (entry.match(/ColumnID:\s*(\d+)/) || [])[1];
        if (name && id) names.set(id, name);
      }
      const rowsAt = text.indexOf('Values', m.index + m[0].length);
      const brace = rowsAt < 0 ? -1 : text.indexOf('{', rowsAt);
      if (brace < 0) continue;
      const byName = new Map();
      for (const e of topLevelEntries(blockFrom(text, brace))) {
        const lead = e.text.match(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/)[0].length;
        const cell = e.text.slice(lead).replace(/\s*\/\/[^\n]*$/gm, '');
        const v = cell.match(/^'(\d+)'\s*:\s*([\s\S]*?)\s*$/);
        if (v && names.has(v[1])) byName.set(names.get(v[1]), { expr: v[2], line: lineAt(brace + e.at + lead) });
      }
      if (byName.size) out.push({ f, byName, unit });
    }
    const echo = new Map();
    for (const m of text.matchAll(/\bset_cell\(\s*\w+\s*,\s*'([^']+)'\s*,\s*([^;]*?)\)\s*;/g))
      echo.set(m[1], { expr: m[2].trim(), line: lineAt(m.index) });
    if (echo.size) out.push({ f, byName: echo, unit, echo: true });
  }
  return out;
};
const k6Tables = tablesOf(scopedText);
const literalOf = (expr) => {
  const s = expr.match(/^'((?:\\.|[^'\\])*)'$/);
  if (s) return { v: s[1].replace(/\\(.)/g, '$1') };
  if (/^-?\d+(\.\d+)?$|^null$|^true$|^false$/.test(expr)) return { v: expr === 'null' ? null : expr };
  return null;
};
// the builders a step's wrappers post to each endpoint: a wrapper of the step that names an endpoint, and every
// function or const its body names, transitively (save wrapper → savePayload → eventCopyTable). A recorded request
// is compared only with the builders of a wrapper that posts the same endpoint, never a sibling call's builder
const unitEndpointMap = (fns) => {
  const map = new Map();
  for (const fn of fns) {
    const eps = [...index.get(fn).body.matchAll(ENDPOINT)].map((m) => m[1]);
    if (!eps.length) continue;
    const stack = [fn];
    const seen = new Set();
    while (stack.length) {
      const u = stack.pop();
      if (seen.has(u) || !index.has(u)) continue;
      seen.add(u);
      if (!map.has(u)) map.set(u, new Set());
      eps.forEach((ep) => map.get(u).add(ep));
      stack.push(...new Set(index.get(u).body.match(/\b\w+\b/g) || []));
    }
  }
  return map;
};
const unitEndpoints = new Map();
const endpointsOfUnits = (step) => {
  if (!unitEndpoints.has(step)) unitEndpoints.set(step, unitEndpointMap(stepSeen.get(step) || []));
  return unitEndpoints.get(step);
};
// Compare every recorded Save2/HDF2 table in `reqs` with the builder tables of the wrappers that post the same
// endpoint (`unitsOf(step)` → unit → endpoints). A recorded table no builder declares at all (a child table the
// save carries, such as a service order's item lines) FLAGs too, when a wrapper of that step posts the endpoint.
// `echoReqs` are the requests a typed-input echo is looked up in (all of them when `reqs` is a subset). Returns how
// many recorded tables were compared.
const compareTables = (reqs, tables, unitsOf, stepLabel, echoReqs = reqs) => {
  const reportedTables = new Set();
  let tablesCompared = 0;
  for (const r of reqs.filter((x) => x.cls === 'SPINE' && x.template)) {
    for (const t of nlTables(r.template)) {
      const nlNames = [...t.names.values()];
      if (nlNames.length < 5) continue;
      const compare = (table) => {
        const fromToken = [];
        const differs = [];
        for (const [id, name] of t.names) {
          const k = table.byName.get(name);
          if (!k || !(id in t.row)) continue;
          const nl = t.row[id];
          const lit = literalOf(k.expr);
          const tokens = typeof nl === 'string' ? [...nl.matchAll(/\$\{([^}.]+)/g)].map((x) => x[1]) : [];
          if (tokens.length) {
            const varying = tokens.filter((tk) => !/^P_Performance_/.test(tk) && !constantVar(tk));
            const echo = tokens.length === 1 && nl === `\${${tokens[0]}}` && lit && echoed(tokens[0], lit.v, echoReqs);
            if (varying.length && !echo && lit && lit.v !== null && lit.v !== '')
              fromToken.push(`${name} ${nl.slice(0, 50)} → '${lit.v}' (:${k.line})`);
          } else if (lit && String(nl ?? null) !== String(lit.v ?? null)) differs.push(`${name} '${nl}' → '${lit.v}' (:${k.line})`);
        }
        return { fromToken, differs };
      };
      // the builder table sharing the most column names; between builders of one table shape (an HDF2 and the Save2
      // that follows it), the one closest to this recording
      const units = unitsOf(r.step);
      const rank = (a, b) => b.hit - a.hit || a.fromToken.length + a.differs.length - (b.fromToken.length + b.differs.length);
      const posted = tables
        .filter((k) => units.get(k.unit)?.has(r.endpoint))
        .map((k) => ({ k, hit: nlNames.filter((n) => k.byName.has(n)).length }));
      // a declared table must carry most of the recorded columns; an echoed one only the cells the builder sets
      const best =
        posted
          .filter((c) => !c.k.echo && c.hit >= nlNames.length * 0.8)
          .map((c) => ({ ...c, ...compare(c.k) }))
          .sort(rank)[0] ||
        posted
          .filter((c) => c.k.echo && c.hit > 0)
          .map((c) => ({ ...c, ...compare(c.k) }))
          .sort(rank)[0];
      if (!best) {
        const posting = [...units].filter(([, eps]) => eps.has(r.endpoint)).map(([u]) => u);
        const key = `missing ${r.endpoint} ${nlNames.slice(0, 3).join()}`;
        if (posting.length && !reportedTables.has(key)) {
          reportedTables.add(key);
          // a payload builder taking a TransportTable parameter posts a table it was handed from a live response
          const echoer = posting.find(
            (u) => /[\\/]payloads[\\/]/.test(index.get(u)?.file) && /\w+\s*:\s*TransportTable\b/.test(index.get(u).body),
          );
          const what = `${r.endpoint} [${stepLabel(r.step)}]: a recorded table (${nlNames.length} columns: ${nlNames.slice(0, 3).join(', ')}, …)`;
          if (echoer) info(`${what} is not declared in k6; ${echoer} takes a TransportTable, so it likely posts the live one — confirm`);
          else flag(`${what} matches no builder table the step's wrappers post — the k6 body leaves it out`);
        }
        continue;
      }
      const { fromToken, differs } = best;
      const key = `${rel(best.k.f)} ${best.k.unit} ${fromToken.join()} ${differs.join()}`;
      if (reportedTables.has(key)) continue;
      reportedTables.add(key);
      tablesCompared++;
      const at = `${r.endpoint} [${stepLabel(r.step)}] vs ${rel(best.k.f)}${best.k.echo ? ' (echoes a live table)' : ''}`;
      if (fromToken.length)
        flag(`${at}: ${fromToken.length} column(s) NeoLoad fills from a token, k6 sends a literal — ${fromToken.slice(0, 4).join('; ')}`);
      if (differs.length) flag(`${at}: ${differs.length} literal column(s) differ from the recording — ${differs.slice(0, 6).join('; ')}`);
      if (!fromToken.length && !differs.length)
        ok(`${at}: ${best.k.echo ? `the ${best.hit} cells it sets match` : 'first row matches'} by column name (${best.hit} columns)`);
    }
  }
  return tablesCompared;
};
const tablesCompared = compareTables(spineReqs, k6Tables, endpointsOfUnits, (s) => s.replace(/^T\d+_[A-Za-z]+_/, ''));
if (!tablesCompared) info('no recorded transport table matched a k6 builder table by column name');

// ---- 4c. test-data names ------------------------------------------------------------------------
// Every record a journey or seed creates is named k6-t<id>-<what>-<vu><iter><epoch> (rules/scripting.md): the test
// id unpadded, the consuming journey's id for a seed. A per-iteration template literal with a word in it is a
// record name; a log line, a check label, a URL, a digits-only value (a phone number), a client window id (AA90310)
// and the helpers' request headers (wsid) are not.
section('4c. TEST-DATA NAMES  (record names the journey writes vs k6-t<id>-<what>-<vu><iter><epoch>)');
const configText = fs.existsSync('source/config/env.config.ts') ? read('source/config/env.config.ts') : '';
const configValue = (key) => (configText.match(new RegExp(`\\b${key}\\s*:\\s*'([^']*)'`)) || [])[1];
const tNum = Number((vuUid.match(/^T0*(\d+)/i) || [])[1]);
const PER_ITERATION = /\$\{[^}]*\b(?:runToken|epoch|__VU|iter|iterationInTest|Date\.now|randomUUID)\b[^}]*\}/;
const NAME = /^k6-t(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*-$/;
const checkNames = (units, label) => {
  let named = 0;
  for (const { f, lines, offset } of units.filter((u) => !/[\\/]utils[\\/]helpers[\\/]/.test(u.f)))
    lines.forEach((l, i) => {
      if (isComment(l) || /console\.|Error\(|\bfail\(|\bcheck\(|\btags\s*:/.test(l)) return;
      for (const m of l.matchAll(/`((?:\\.|[^`\\])*)`/g)) {
        const tpl = m[1];
        const literal = tpl.replace(/\$\{[^}]*\}/g, '');
        if (!PER_ITERATION.test(tpl) || !/[A-Za-z]{3}/.test(literal) || /[/?=&[\]]/.test(literal)) continue;
        named++;
        const where = `${rel(f)}:${offset + i + 1}`;
        const head = tpl.replace(/^\$\{config\.(\w+)\}/, (x, k) => configValue(k) ?? x).split('${')[0];
        const id = (head.match(NAME) || [])[1];
        const capped = /^\s*(?:\.toUpperCase\(\)|\.toLowerCase\(\))?\.(?:slice|substring|substr)\(/.test(l.slice(m.index + m[0].length));
        if (id && Number(id) === tNum && !id.startsWith('0')) ok(`${where} \`${tpl}\``);
        else if (id) flag(`${where} \`${tpl}\` carries test id t${id}, expected t${tNum} (unpadded)`);
        else if (capped) info(`${where} \`${tpl}\` is cut to length: a tight-limit field, exempt from the pattern — confirm the limit`);
        else flag(`${where} \`${tpl}\` does not follow k6-t${tNum}-<what>-<vu><iter><epoch>`);
      }
    });
  if (!named) info(`no per-iteration record name in ${label}`);
};
checkNames(scopedText, 'the code the journey reaches');

// ---- 5. variables / data pools ------------------------------------------------------------------
section('5. VARIABLES  (every ${P_…} the VU and its <VU>.xml reference, against variables/ and the k6 port)');
const refs = refsInTree(treeDir);
const poolModules = listTs('source/data/pools').map((f) => {
  const text = read(f);
  const listStart = text.indexOf('=');
  return {
    f,
    pool: (text.match(/NeoLoad (P_[A-Za-z0-9_]+) pool/) || [])[1],
    exportName: (text.match(/export const (\w+)/) || [])[1],
    list: text.slice(listStart),
    values: [...text.slice(listStart).matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g)].map((m) =>
      (m[1] ?? m[2]).replace(/\\(.)/g, '$1'),
    ),
  };
});
// object-row pools ({ organization: '10', badgeType: '2', … }) are read per column; a flat string list as-is
const columnValues = (mod, col) => {
  const key = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[\\s{,])['"]?${key}['"]?\\s*:\\s*(?:'((?:\\\\.|[^'\\\\])*)'|"((?:\\\\.|[^"\\\\])*)")`, 'gm');
  const keyed = [...mod.list.matchAll(re)].map((m) => (m[1] ?? m[2]).replace(/\\(.)/g, '$1'));
  return keyed.length ? keyed : null;
};
const usedFiles = new Set();
// a seed-prefixed pool the journey discovers at runtime (a discover_* the flow defines, called from smoke setup())
// is replaced by the seed, not ported row for row
const smokeText = fs.existsSync('source/tests/smoke.spec.ts') ? read('source/tests/smoke.spec.ts') : '';
const discovery = [...new Set([...smokeText.matchAll(/\b(discover_\w+)\(/g)].map((m) => m[1]))].filter((fn) =>
  new RegExp(`function ${fn}\\s*\\(`).test(flowText),
);
const seedPrefixed = [];
const seedPrefixedVars = [];
const API_CREDENTIAL_FIELDS = { P_API_UserId: 'userId', P_API_Key: 'key', P_API_Secret: 'secret' };
const translation = (name, r, tag) => {
  const has = (re) => re.test(reachedText);
  if (/thinkTime/i.test(name)) return ['think()', has(/\bthink\(/)];
  if (/Pacing/i.test(name)) {
    const neo = fs.existsSync('source/tests/neoload.spec.ts') ? read('source/tests/neoload.spec.ts') : '';
    const def = (neo.match(/PACING\s*=\s*Number\([^)]*\)\s*\|\|\s*(\d+)/) || [])[1];
    return [`pace(PACING) in neoload.spec.ts (default ${def ?? '?'}s)`, journeyFn ? neo.includes(journeyFn) : false, 'load-spec'];
  }
  if (tag === 'variable-password' && API_CREDENTIAL_FIELDS[name]) {
    const field = API_CREDENTIAL_FIELDS[name];
    const creds = fs.existsSync('source/data/creds/api.data.ts') ? read('source/data/creds/api.data.ts') : '';
    return [
      `source/data/creds/api.data.ts ${field} (encrypted, decrypted in setup())`,
      new RegExp(`\\b${field}\\s*:`).test(creds) && has(/\bapiCredentials\b/),
    ];
  }
  if (r.tag === 'variable-counter' || /Iteration/i.test(name)) return ['iterationInTest / __ITER', has(/iterationInTest|__ITER/)];
  if (r.tag === 'variable-currentdate' || /Epoch|Timestamp|Date/i.test(name))
    return ['Date.now() / new Date()', has(/Date\.now\(\)|new Date\(/)];
  if (r.tag === 'variable-random-number') {
    const min = String(r.detail).match(/random (\d+)/)?.[1];
    return [`Math.random within ${r.detail.replace('random ', '')}`, has(/Math\.random/) && (!min || reachedText.includes(min))];
  }
  if (tag === 'variable-random-string')
    return ['a per-iteration random string (Math.random / randomUUID / a run token)', has(/Math\.random|randomUUID|runToken|random_\w*\(/)];
  if (/Host|Site|Server|Version/i.test(name) || r.kind === 'lookup') return ['env.config.ts (baseUrl / version)', true];
  return [null, false];
};
for (const name of [...refs.keys()].sort()) {
  const def = defs.get(name);
  if (!def) {
    const js = jsSets.get(name);
    const [how, seen] = jsTranslated(name);
    // the flow regenerates it when its subs map sets that key from a computed value (not a quoted literal)
    const subsKey = new RegExp(
      `\\bsubs\\.${name}\\s*=(?!=)|\\bsubs\\[['"]${name}['"]\\]\\s*=(?!=)|['"]?\\b${name}['"]?\\s*:\\s*(?!['"\\d-]|null\\b|true\\b|false\\b)`,
    ).test(reachedText);
    const spineUse = [
      ...new Set(spineReqs.filter((r) => r.cls === 'SPINE' && tokenText(r).includes(`\${${name}}`)).map((r) => r.endpoint)),
    ];
    if (extracted.has(name)) info(`${name}: a <variable-extractor>, not a variable (see 3. CORRELATION)`);
    else if (js && seen) ok(`${name} [set by jsAction ${js}] → ${how}`);
    else if (js && subsKey && !spineUse.length) ok(`${name} [set by jsAction ${js}] → computed subs-map key (only the tiers consume it)`);
    else if (js && subsKey)
      info(
        `${name} [set by jsAction ${js}] → computed subs-map key; the spine also consumes it (${spineUse.join(', ')}) — confirm the builder takes the same value`,
      );
    else if (js)
      flag(
        `${name}: set by jsAction ${js}${how ? ` → ${how}: no evidence in the flow or the code it reaches` : ' — no known k6 translation, confirm by hand'}`,
      );
    else flag(`${name}: no definition in team/variables and no jsAction sets it (VU-local?) — confirm its k6 source`);
    continue;
  }
  const r = resolveDef(def, root);
  if (def.filename) usedFiles.add(path.resolve(root, def.filename));
  if (r.kind === 'pool' && !r.error && r.rows.length <= 1) r.kind = 'lookup';
  if (r.kind !== 'pool') {
    const [how, seen, where] = translation(name, r, def.tag);
    const line = `${name} [${def.tag}] ${r.detail ?? ''} → ${how ?? '?'}`;
    if (!how) flag(`${line}: no known k6 translation — confirm by hand`);
    else if (seen) ok(line);
    else if (where === 'load-spec') info(`${line}: ${journeyFn} is not registered there yet, so pacing applies once it is (see 8. WIRING)`);
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
  if (pre.length >= 8) {
    seedPrefixed.push(`${name} (prefix "${pre}")`);
    seedPrefixedVars.push({ name, file: def.filename });
  }
  const seedPool = pre.length >= 8 && discovery.length > 0;
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
    (seedPool ? info : flag)(
      `${name}.${col}: ${values.length} rows, no source/data/pools module${seedPool ? `: seed-prefixed ("${pre}") and discovered at runtime by ${discovery.join(', ')} (see 6. SEED)` : ' generated from it'}`,
    );
  } else {
    const keyed = columnValues(mod, col) !== null;
    const checkCols = keyed ? cols.filter((c) => columnValues(mod, c) !== null) : [col];
    const noted = (read(mod.f).match(/^\/\*[\s\S]*?\*\//) || [''])[0].split('\n').length > 3;
    const diffs = checkCols
      .map((c) => {
        const want = c === col ? values : poolValues(r, c);
        const got = keyed ? columnValues(mod, c) : mod.values;
        const same = got.length === want.length && got.every((v, i) => v === want[i]);
        return same
          ? null
          : { c, want, got, missing: want.filter((v) => !got.includes(v)).length, extra: got.filter((v) => !want.includes(v)).length };
      })
      .filter(Boolean);
    if (!diffs.length)
      ok(
        `${name}.${checkCols.length > 1 ? `[${checkCols.join(', ')}]` : col}: ${values.length}/${values.length} rows, same order → ${rel(mod.f)} (${mod.exportName})`,
      );
    for (const d of diffs)
      flag(
        `${name}.${d.c}: NeoLoad ${d.want.length} rows vs ${d.got.length} in ${rel(mod.f)} (missing ${d.missing}, extra ${d.extra}${!d.missing && !d.extra ? ', order differs' : ''})${noted ? ' — its header documents a deviation; judge it' : ''}`,
      );
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
    (variants.some((x) => x.state === 'DIFFERS') && !seedPool ? flag : info)(
      `${name} across versions → ${summary}${seedPool ? ' (rows discovered at runtime, not ported)' : ''}`,
    );
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
  const heads = fs.readdirSync(vusDir).filter((f) => f.endsWith('.xml'));
  const treeOf = (uid) => {
    const x = heads.find((f) => attr(openTag(read(path.join(vusDir, f)), 'virtual-user'), 'uid') === uid);
    return x ? path.join(vusDir, x.replace(/\.xml$/, '')) : null;
  };
  // a population can name another version's data script (@population_@test@data_@t34_26#2E1 → U13 (26.1)); the
  // same data script at this VU's version is the one the seed is checked against
  const ver = (vuUid.match(/\(([\d.]+)\)$/) || [])[1];
  const dsUids = [
    ...new Set(
      dataScripts.map((uid) => {
        const same = ver && uid.replace(/\([\d.]+\)$/, `(${ver})`);
        return same && treeOf(same) ? same : uid;
      }),
    ),
  ];
  dsUids.filter((uid) => !treeOf(uid)).forEach((uid) => flag(`data-script VU ${uid}: tree not found under team/vus`));

  // where NeoLoad's own data run left its records: one variables/ file per version, mapped to an env by
  // P_Performance_Sites. An env with no file has none of them, so the k6 seed is its only source
  const sitesDef = defs.get('P_Performance_Sites');
  const sites = sitesDef ? resolveDef(sitesDef, root) : null;
  const envOf = (v) => {
    const c = (sites?.columns || []).find((x) => x.name === `version_${v}`);
    return c ? sites.rows?.[0]?.[c.number] : undefined;
  };
  const versions = fs
    .readdirSync(path.join(root, 'variables'))
    .filter((d) => /^version_/.test(d))
    .map((d) => d.replace('version_', ''));
  for (const { name, file } of seedPrefixedVars) {
    const vm = (file || '').replace(/\\/g, '/').match(/variables\/version_([\d_]+)\/P_\1_(.+)$/);
    if (!vm) continue;
    const has = versions.filter((v) => fs.existsSync(path.join(root, 'variables', `version_${v}`, `P_${v}_${vm[2]}`)));
    const label = (v) => `${v} → ${envOf(v) ?? '?'}`;
    info(
      `${name}: NeoLoad's data run left records on ${has.map(label).join(', ') || 'no env'}; none on ${
        versions
          .filter((v) => !has.includes(v))
          .map(label)
          .join(', ') || 'no env'
      }. Seed those; on the others, search one exact name from the file before reseeding`,
    );
  }

  // how many records NeoLoad sizes a data script's output at (team/data-distribution), and how many rows its
  // per-version variables/ files hold now. /seed reads this line to size a `neoload` count
  const distribution = (() => {
    const f = path.join(root, 'team', 'data-distribution', 'data_distribution_config.csv');
    if (!fs.existsSync(f)) return [];
    const [head, ...rows] = read(f).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    const cols = head.split(',');
    return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
  })();
  const seedTarget = (dataFile) => {
    const rows = distribution.filter((d) => d.SourceScript === dataFile);
    if (rows.length === 0) return null;
    const stems = [...new Set(rows.map((d) => d.FileName.replace(/^P_[\d_]+?_(?=[A-Z])/, '').replace(/\.txt$/, '')))];
    const left = versions
      .map((v) => {
        const n = stems
          .map((stem) => path.join(root, 'variables', `version_${v}`, `P_${v}_${stem}.txt`))
          .filter((p) => fs.existsSync(p))
          .reduce((sum, p) => sum + Math.max(0, read(p).split(/\r?\n/).filter(Boolean).length - 1), 0);
        return n ? `${v} ${n}` : null;
      })
      .filter(Boolean);
    return `${dataFile} is sized at ${rows[0].ExpectedTotalCount} in data_distribution_config.csv (${stems.join(', ')}); rows in variables/ now: ${left.join(', ') || 'none'}`;
  };

  // the journey finds the seeded records by a config prefix, and a seed must name its records with that prefix
  // the recording may pick its record in-flow instead: a random row (matchNumber 0) of a grid read, handed to a
  // jsAction that splits it into variables. The same read in the same k6 step is then the discovery
  const inFlowPicks = spineReqs.flatMap((r) =>
    r.extractors
      .filter((e) => e.matchNumber === '0' && /TransportDataRows/.test(e.jsonpath || ''))
      .map((e) => ({ e, r, js: [...jsReads].filter(([, reads]) => reads.includes(e.name)).map(([f]) => f) }))
      .filter((p) => p.js.length),
  );
  for (const { e, r, js } of inFlowPicks) {
    const got = (stepLean.get(r.step) || new Map()).get(r.endpoint) || 0;
    (got ? ok : flag)(
      `the recording picks its record in-flow: ${e.name} ← a random row of ${r.endpoint} [${r.step.replace(/^T\d+_[A-Za-z]+_/, '')}], split by jsAction ${js.join(', ')}; ${got ? 'the lean flow reads it in the same step, so no setup discovery is needed' : 'the lean flow does not read it in that step, so nothing picks the record'}`,
    );
  }
  if (!discovery.length && !inFlowPicks.length)
    flag("the journey reads a data script's records, but no discover_* the flow defines is called from smoke setup()");
  const keys = [
    ...new Set(discovery.flatMap((fn) => [...(index.get(fn)?.body || '').matchAll(/\bconfig\.(\w+)/g)].map((m) => m[1]))),
  ].filter((k) => configValue(k) !== undefined);
  if (discovery.length && !keys.length)
    flag(`${discovery.join(', ')} searches no config prefix, so no seed can share its name prefix with the journey`);
  const seeds = listTs('source/seeds').map((f) => ({ f, text: read(f) }));
  const seedFiles = new Set();
  for (const k of keys) {
    const v = configValue(k);
    const by = seeds.filter((s) => s.text.includes(`\${config.${k}}`));
    by.forEach((s) => seedFiles.add(s));
    (by.length ? ok : flag)(
      `discovery searches config.${k} = '${v}'${by.length ? `, the prefix ${by.map((s) => rel(s.f)).join(', ')} names its records with` : ': no source/seeds script names its records with it, so the journey discovers records nothing creates'}`,
    );
    const id = (`${v}-`.match(NAME) || [])[1];
    (id && Number(id) === tNum && !id.startsWith('0') ? ok : flag)(
      `seed prefix '${v}' ${id && Number(id) === tNum ? 'carries' : 'does not carry'} the consuming journey's id (k6-t${tNum}-<what>)`,
    );
  }
  // with no discovery prefix to follow, the seed is the one whose config prefix carries this journey's test id
  if (!keys.length) {
    for (const s of seeds) {
      const own = [...new Set([...s.text.matchAll(/\bconfig\.(\w+)/g)].map((m) => m[1]))].filter((k) =>
        (configValue(k) || '').startsWith(`k6-t${tNum}-`),
      );
      if (!own.length) continue;
      seedFiles.add(s);
      info(
        `no discovery prefix names a seed; ${rel(s.f)} names its records with config.${own[0]} = '${configValue(own[0])}', so it is the seed compared below`,
      );
    }
    if (!seedFiles.size)
      flag(`no source/seeds script names its records with a k6-t${tNum}- config prefix, so no seed is compared with ${dsUids.join(', ')}`);
  }
  // the requests are compared below; only a seed probe reads the resulting records back beside NeoLoad's
  for (const s of seedFiles) {
    const probe = path.join('source', 'probes', path.basename(s.f).replace(/\.seed\.ts$/, '-seed.probe.ts'));
    const has = fs.existsSync(probe);
    (has ? ok : flag)(
      `${rel(s.f)} ${has ? `has its seed probe ${rel(probe)}` : `has no seed probe (${rel(probe)}), so nothing reads its records back beside NeoLoad's`}`,
    );
  }

  // the seed must leave the data the data script leaves: the same writes, loop volume, saved cells and pools.
  // Navigation is irrelevant, so a read only matters when a saved value comes from it, and a recently-used list
  // write is the user's UI state, not a seeded record
  const WRITE = /\/(?:Save(?!RecentlyUsed)\w*|save|Create\w*|CacheFiles|Delete\w*|Update\w*|Insert\w*)$/;
  for (const s of seedFiles) {
    const entry = (s.text.match(/export default (?:async )?function (\w+)/) || [])[1];
    if (!entry || !index.has(entry)) {
      flag(`${rel(s.f)}: no named default function to follow`);
      continue;
    }
    const seedReach = reach(index.get(entry).body);
    const fns = new Set([entry, ...seedReach.seen]);
    const seedUnits = [{ f: path.resolve(s.f), lines: s.text.split('\n'), offset: 0 }];
    const added = new Set();
    const add = (n) => {
      const e = index.get(n);
      if (!e || added.has(n) || path.resolve(e.file) === path.resolve(s.f)) return;
      added.add(n);
      seedUnits.push({ f: path.resolve(e.file), lines: e.body.split('\n'), offset: e.bodyLine - 1, name: n });
    };
    fns.forEach(add);
    const named = seedUnits.map((u) => u.lines.join('\n')).join('\n');
    for (const [n, e] of index) if (/payloads/.test(e.file) && new RegExp(`\\b${n}\\b`).test(named)) add(n);
    const seedText = seedUnits.map((u) => u.lines.join('\n')).join('\n');
    checkNames(seedUnits, rel(s.f));
    const k6 = count(seedReach.endpoints);
    const unitMap = unitEndpointMap(fns);
    for (const uid of dsUids) {
      const dsTree = treeOf(uid);
      if (!dsTree) continue;
      const dt = readTree(dsTree);
      const dsReqs = dt.steps.flatMap((st) => st.requests.map((r) => ({ ...r, step: st.name })));
      const short = uid.replace(/_.*/, '');
      info(
        `${uid}: ${dt.steps.length} steps [${dt.steps.map((st) => `${st.name}${st.loop > 1 ? ` ×${st.loop}` : ''}`).join(', ')}] vs ${rel(s.f)} (${entry})`,
      );
      writers
        .filter((w) => w.vu === path.basename(dsTree))
        .forEach((w) => {
          info(`${short} hands ${w.variable} to the journey through ${w.file}; the seed's name prefix replaces that file`);
          const target = seedTarget(w.file);
          if (target) info(`seed target ${rel(s.f)}: ${target}`);
        });
      const nl = count(dsReqs.filter((r) => r.cls === 'SPINE').map((r) => r.endpoint));
      for (const [ep, n] of nl) {
        const got = k6.get(ep) || 0;
        if (got === n) ok(`${short} ${ep} ×${n}, seed ×${got}`);
        else if (WRITE.test(ep)) flag(`${short} ${ep} ×${n} per pass, seed ×${got}: the seed ${got < n ? 'leaves out' : 'adds'} a write`);
        else
          info(`${short} ${ep} ×${n}, seed ×${got}: not a write to the seeded records, so it matters only if a saved value comes from it`);
      }
      for (const [ep, n] of k6) if (!nl.has(ep) && WRITE.test(ep)) flag(`${ep} ×${n} in the seed is not a write ${short} makes`);
      // a loop-action repeats its steps; the seed must repeat the same calls as often
      const bounds = [...seedText.matchAll(/for\s*\([^;]*;\s*\w+\s*<\s*(\w+)\s*;/g)].map((m) =>
        /^\d+$/.test(m[1])
          ? Number(m[1])
          : Number((seedText.match(new RegExp(`const ${m[1]}\\s*=\\s*(?:Number\\([^)]*\\|\\|\\s*)?(\\d+)`)) || [])[1]),
      );
      const loops = new Map(dt.steps.filter((st) => st.loop > 1).map((st) => [st.within.join(' > '), st.loop]));
      for (const [where, n] of loops)
        (bounds.includes(n) ? ok : flag)(
          `${short} runs ${where} — ${bounds.includes(n) ? `the seed repeats it ${n} times` : `the seed has no loop of ${n}`}`,
        );
      const writes = dsReqs.filter((r) => WRITE.test(r.endpoint));
      const compared = compareTables(
        writes,
        tablesOf(seedUnits),
        () => unitMap,
        (st) => `${short} ${st}`,
        dsReqs,
      );
      if (!compared) info(`no ${short} transport table matched a seed builder table by column name`);
      // a pool the data script picks per iteration is picked the same way, never pinned to one value
      const unversioned = (n) => (n || '').replace(/^P_\d+_\d+_/, '');
      for (const name of refsInTree(dsTree).keys()) {
        const def = defs.get(name);
        if (!def || /UserCredentials/i.test(name)) continue;
        const r = resolveDef(def, root);
        if (r.kind !== 'pool' || r.error || r.rows.length <= 1) continue;
        const mod =
          poolModules.find((m) => m.pool === name) || poolModules.find((m) => m.pool && unversioned(m.pool) === unversioned(name));
        const picked = mod && new RegExp(`pick_pool_value\\(\\s*${mod.exportName}\\b`).test(seedText);
        (picked ? ok : flag)(
          `${short} picks ${name} per iteration (${r.rows.length} rows)${mod ? `: ${mod.exportName} ${picked ? 'is' : 'is not'} picked with pick_pool_value in the seed` : ': no source/data/pools module'}`,
        );
      }
    }
  }
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
// a request's tag is `tags: { name: 'X' }` in a body, or the literal a call site passes in a wrapper's `name`/`tag`
// parameter (that parameter's default when the call passes none). Resolving it per call site keeps a column map's
// `name:` key, a window id in another argument position, or a default every caller overrides out of the set
// `generics` counts <…> as nesting, for a parameter list (ReturnType<typeof post_contact>), never call arguments
const splitArgs = (s, generics = false) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      for (; j < s.length && s[j] !== c; j++) if (s[j] === '\\') j++;
      cur += s.slice(i, j + 1);
      i = j;
      continue;
    }
    if ('([{'.includes(c) || (generics && c === '<')) depth++;
    else if (')]}'.includes(c) || (generics && c === '>' && s[i - 1] !== '=')) depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const parenFrom = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
};
const params = new Map();
const paramsOf = (fn) => {
  if (!params.has(fn)) {
    const text = read(index.get(fn).file);
    const m = text.match(new RegExp(`function ${fn}\\s*\\(`));
    params.set(
      fn,
      m
        ? splitArgs(parenFrom(text, m.index + m[0].length - 1), true).map((p) => ({
            name: (p.match(/^\s*(?:\.\.\.)?(\w+)/) || [])[1],
            def: (p.match(/=\s*'([^']*)'\s*$/) || [])[1],
          }))
        : [],
    );
  }
  return params.get(fn);
};
// a `name`/`tag` parameter is a request tag only if the function sends it as one: `tags: { name }` in its body, or
// passed on to such a parameter (set_cell's `name` only labels a log line)
const tagParam = new Map();
const tagParamAt = (fn, depth = 0) => {
  if (tagParam.has(fn)) return tagParam.get(fn);
  tagParam.set(fn, -1);
  const ps = paramsOf(fn);
  const at = ps.findIndex((p) => p.name === 'name' || p.name === 'tag');
  if (at < 0 || depth > 5) return -1;
  const id = ps[at].name;
  const body = index.get(fn).body;
  let sends = new RegExp(`\\btags\\s*:\\s*\\{[^}]*\\b(?:name\\s*:\\s*${id}|${id})\\b`).test(body);
  for (const m of body.matchAll(/\b([a-z_][A-Za-z0-9_]*)\s*\(/g)) {
    if (sends) break;
    if (!index.has(m[1]) || m[1] === fn) continue;
    const callee = tagParamAt(m[1], depth + 1);
    sends = callee >= 0 && splitArgs(parenFrom(body, m.index + m[0].length - 1))[callee] === id;
  }
  tagParam.set(fn, sends ? at : -1);
  return tagParam.get(fn);
};
const tagsIn = (text, xf, stack = new Set(), out = new Set()) => {
  text = xf(text);
  for (const m of text.matchAll(/\btags\s*:\s*\{[^}]*?\bname\s*:\s*'([A-Z]\w*)'/g)) out.add(m[1]);
  if (stack.size > 5) return out;
  for (const m of text.matchAll(/\b([a-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const fn = m[1];
    if (!index.has(fn) || stack.has(fn) || /function\s+$/.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
    const ps = paramsOf(fn);
    const at = tagParamAt(fn);
    if (at >= 0) {
      const arg = splitArgs(parenFrom(text, m.index + m[0].length - 1))[at];
      const lit = arg && arg.match(/^'([A-Z]\w*)'$/);
      if (lit) out.add(lit[1]);
      else if (!arg && ps[at].def) out.add(ps[at].def);
    }
    tagsIn(index.get(fn).body, xf, new Set([...stack, fn]), out);
  }
  return out;
};
const journeyText = journeyEntry ? journeyEntry.body : flowText;
const journeyTags = tagsIn(journeyText, (t) => t);
const leanTags = tagsIn(journeyText, stripGuarded);
const allTags = tagsIn(flowText, (t) => t);
if (!thrName) flag('no exported *Thresholds object in the flow');
else {
  const helperTags = new Set(
    [...index.values()]
      .filter((e) => path.normalize(e.file).split(path.sep).includes('helpers'))
      .flatMap((e) => [...read(e.file).matchAll(/\bname\s*[=:]\s*'([A-Z]\w+)'/g)].map((m) => m[1])),
  );
  // shared SLA maps spread into the journey's (...searchEventsThresholds from events.api.ts)
  const spread = new Map();
  for (const m of thrBlock.matchAll(/\.\.\.(\w+)/g)) {
    const e = index.get(m[1]);
    if (!e) continue;
    for (const x of e.body.matchAll(/\{name:([^}]+)\}'\s*:\s*\[([^\]]*)\]/g))
      spread.set(x[1], { v: x[2], from: `${m[1]} (${rel(e.file)})` });
  }
  const covered = (t) => thr.has(t) || spread.has(t) || otherThr.has(t);
  for (const t of journeyTags) {
    if (covered(t)) continue;
    if (helperTags.has(t)) info(`request tag ${t} (shared helper) has no threshold — matches the other journeys unless the SLA needs it`);
    else if (!leanTags.has(t))
      info(`request tag ${t} fires only behind include_ui/include_static (tier support): no threshold, per rules/fidelity.md`);
    else flag(`request tag ${t} has no threshold in ${thrName}`);
  }
  for (const t of allTags)
    if (!journeyTags.has(t) && !covered(t))
      info(`request tag ${t} is reached only outside ${journeyFn} (setup / discovery): no threshold needed`);
  for (const [t, v] of thr) {
    if (!allTags.has(t)) flag(`${thrName} has '${t}', which no reached request is tagged with`);
    else if (avgLimitMs != null && !v.includes(`avg<${avgLimitMs}`)) flag(`${t}: ${v.trim()} — SLA says avg<${avgLimitMs}`);
    else if (/\bp\(\d+(?:\.\d+)?\)/.test(v))
      info(`${t}: ${v.trim()} — the percentile is not a NeoLoad SLA; keep it only if its commit records the measured run (rules/tests.md)`);
  }
  for (const [t, s] of spread)
    if (journeyTags.has(t) && avgLimitMs != null && !s.v.includes(`avg<${avgLimitMs}`))
      info(`${t}: ${s.v.trim()} from the shared ${s.from} — SLA says avg<${avgLimitMs}; changing it affects every journey that spreads it`);
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
