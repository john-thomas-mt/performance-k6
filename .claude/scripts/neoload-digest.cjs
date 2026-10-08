// Distill a NeoLoad VU tree into a compact authoring digest for the perf-1-seed-port / perf-3-journey-port workflow — the
// NeoLoad-side analog of the recon-kit. Walks the tree and prints, in one pass: the step order (steps inside a
// loop/if/try action included), the transaction spine (each request classified keep / chrome / drop), the solved
// <variable-extractor> correlation map, the paired test-data-script VU with the command to digest it, what a data
// script hands its consuming VU (DATA WRITES), and a dissection of each write/open request body pulled from its
// recorded-artifacts zip. Keeps the raw XML, extractor blocks, and multi-KB captured
// bodies out of the caller's main context — the caller reads this digest, not the tree.
//
// Usage:
//   node .claude/scripts/neoload-digest.cjs "<VU tree dir>"
//   node .claude/scripts/neoload-digest.cjs "team/vus/@t34_@copy@service@orders #2826#2E2#29"
//   node .claude/scripts/neoload-digest.cjs "<VU tree dir>" --paired   (only the paired data-script VU, no digest)
//
// Deterministic and read-only. Body dissection shells out to `unzip` (git-bash / any *nix); if unzip
// is absent it degrades to listing the zip path so the author can extract it manually.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { findProjectRoot, loadDefs, refsInTree, poolReport } = require('./neoload-vars.cjs');
const { attr, openTag, parsePage, pageOrder, stepNodes } = require('./neoload-tree.cjs');

const pairedOnly = process.argv.includes('--paired');
const treeDir = process.argv.slice(2).find((a) => a !== '--paired');
if (!treeDir) {
  console.error('usage: node .claude/scripts/neoload-digest.cjs "<VU tree dir>" [--paired]');
  process.exit(1);
}
if (!fs.existsSync(treeDir)) {
  console.error(`VU tree not found: ${treeDir}`);
  process.exit(1);
}

const vuName = path.basename(treeDir);
const actionsDir = path.join(treeDir, 'actions-container');
const artifactsDir = path.join(treeDir, '%resources%', 'recorded-artifacts');

const STATIC_EXT = /\.(css|js|html|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|map)(\?|$)/i;
const STATIC_PREFIX = /^\/(Content|Scripts|scripts|fonts|Fonts)\//i;
const TELEMETRY = /\/v1\/traces|analytics|\/signalr\//i;
// UI-chrome application/API reads a browser fires to paint the UI — dropped from the spine, replayed
// only as the -e FIDELITY tier. Server-qualify GetInitialData (the bare read is chrome; the spine's
// GetInitialData2 is a distinct write-feeding read that must not be substring-matched here).
const CHROME = [
  'GetHostedEnvironment',
  'GetUSIGlobalsAndUserInfo',
  'GetGlobalNavSettings',
  'GetMenuItemsObject',
  'GetWebTemplateHTML',
  'GetDashbar',
  'HomeServer/GetInitialData',
  'RetrieveActivityNotification',
  'RetrieveChangelogNotification',
  'RetrieveCheckedOutDocument',
  'RetrieveNotificationCount',
  'GetPrimaryKeyObjectColumns',
  'GetObjectColumns',
  'AddWindowUsageRecord',
  'SetSelectedSection',
  'GetControlInfo',
  'GetRecentlyUsedMenuItems',
  'SaveRecentlyUsedMenuItem',
  'USIDataGridViewMenuServer',
  'GetWindowInfo',
  'GetSearchFilterCriteria',
  'ApplicationUnloading',
  'app85.cshtml',
];
// The reproduced write / detail-form-open payloads worth dissecting inline (the bodies an author
// writes a builder for). Grid/search reads (GetGridData2, USIDataGridServer/GetInitialData2) are
// correlated from responses via existing wrappers, so their request bodies aren't dissected here —
// run .claude/scripts/inspect-capture.cjs on a listed zip if one is needed.
const DISSECT = /(\/Save2|GenericDetailServer\/GetInitialData2|\/CacheFiles|\/CreateNewRowsWithDefaultValues)(\?|$)/;

const barePath = (p) => p.replace(/^\/\$\{[^}]+\}/, '');
const classify = (method, p) => {
  const b = barePath(p);
  if (STATIC_EXT.test(b) || STATIC_PREFIX.test(b) || TELEMETRY.test(b)) return 'DROP';
  if (CHROME.some((c) => b.includes(c.replace('?', '')))) return 'CHROME';
  return 'SPINE';
};

// step number from the folder name: `_NN_` mid-name (@t30_@crystal@report_02_@login), `_NN` at the end
// (@t28_@gadgets_@load_03) or a leading `NN_` (the data-script VUs: 03_@click@calender@tab); a VU whose steps carry
// no number at all (the single-step report VUs, @t005_@payment@receipt_@report) numbers them by position. Steps come
// from stepNodes, so a step inside a loop/if/try action is listed in execution order with what encloses it.
const STEP_NO = /_(\d+)(?:_|$)|^(\d+)_/;
const readStepFolders = () => {
  if (!fs.existsSync(actionsDir)) return [];
  const nodes = stepNodes(treeDir).steps;
  const numbered = nodes.some((s) => STEP_NO.test(path.basename(s.dir)));
  return nodes.map((s, i) => {
    const m = path.basename(s.dir).match(STEP_NO);
    const no = (m && (m[1] || m[2])) || (numbered ? '?' : String(i + 1).padStart(2, '0'));
    return { name: s.dir, no, loop: s.loop, within: s.within };
  });
};

// One request of a page, read from its own <http-action> block: a page file bundles the main request plus its
// embedded resources, and any of them can be a spine call, so every enabled action is digested, not just the first.
const parseRequest = (a) => {
  const action = a.block;
  const hasBody = a.template !== null;
  // tokens the request's own body and query consume (not its headers, which carry the same session tokens on
  // every call): a read that consumes a per-iteration C_… value can't be a fixed replay, so it is functional
  // flow even when no later write consumes what it extracts
  let body = a.template || '';
  if (body.startsWith('Encoded(Base64):')) body = Buffer.from(body.slice(16), 'base64').toString('utf8');
  const query = [...action.matchAll(/<parameter\b[^>]*\bvalue="([^"]*)"/g)].map((m) => m[1]).join(' ');
  const consumes = [...new Set([...`${body} ${query}`.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]))].filter(
    (t) => !/^P_Performance_/.test(t),
  );
  return {
    method: a.method,
    path: barePath(a.rawPath),
    hasBody,
    zip: a.zip,
    reqFile: a.reqFile,
    extractors: a.extractors,
    consumes,
  };
};

// A step's enabled requests in recorded order: pages by the step container's <weighted-embedded-action> list
// (a directory listing is alphabetical by URL), then each page's actions in its <embedded-action> order.
const stepRequests = (s) => {
  const stepDir = path.join(actionsDir, s.name);
  const byPage = new Map();
  for (const f of fs.readdirSync(stepDir).filter((n) => n.endsWith('.xml'))) {
    const xml = fs.readFileSync(path.join(stepDir, f), 'utf8');
    const page = parsePage(xml);
    const blocks = new Map(
      (xml.match(/<http-action\b[\s\S]*?<\/http-action>/g) || []).map((b) => [attr(openTag(b, 'http-action'), 'uid'), b]),
    );
    page.actions.forEach((a) => (a.block = blocks.get(a.actionUid) || ''));
    byPage.set(page.uid, page);
  }
  const stepXml = path.join(actionsDir, `${s.name}.xml`);
  const ordered = fs.existsSync(stepXml) ? pageOrder(fs.readFileSync(stepXml, 'utf8'), byPage) : [];
  const pages = [...ordered, ...[...byPage.values()].filter((p) => !ordered.includes(p))];
  return pages.flatMap((p) => p.actions.filter((a) => a.enabled)).map(parseRequest);
};

// ---- body dissection (mirrors .claude/scripts/inspect-capture.cjs, condensed) ----
const shape = (v) =>
  Array.isArray(v) ? `Array(${v.length})` : v && typeof v === 'object' ? `{${Object.keys(v).join(',')}}` : JSON.stringify(v);

const dissect = (body) => {
  let j;
  try {
    j = JSON.parse(body);
  } catch {
    return `    (body not JSON — first 120 chars: ${body.slice(0, 120)})`;
  }
  const out = [`    TOP: ${shape(j)}`];
  const tables = [];
  const find = (v, p) => {
    if (Array.isArray(v)) return v.forEach((e, i) => find(e, `${p}[${i}]`));
    if (v && typeof v === 'object') {
      if (Array.isArray(v.TransportDataColumns) && Array.isArray(v.TransportDataRows)) tables.push([p, v]);
      Object.keys(v).forEach((k) => find(v[k], `${p}.${k}`));
    }
  };
  find(j, 'root');
  for (const [p, t] of tables) {
    const cols = t.TransportDataColumns;
    out.push(`    TABLE ${p}  cols=${cols.length} rows=${t.TransportDataRows.length}`);
    t.TransportDataRows.forEach((r, ri) => {
      const vals = r.Values || {};
      const pop = Object.keys(vals).filter((k) => ![null, '', 0, false].includes(vals[k]));
      out.push(`      row[${ri}] populated ${pop.length}/${Object.keys(vals).length}:`);
      for (const k of pop) {
        const col = cols.find((c) => String(c.ColumnID) === String(k));
        out.push(`        Values["${k}"] ${col ? col.ColumnName : '?'} = ${JSON.stringify(vals[k])}`);
      }
    });
  }
  // key/value context arrays (the Save2 / form-open [{Key,Value}] blocks)
  const kvArrays = [];
  const findKv = (v, p) => {
    if (Array.isArray(v)) {
      if (v.length && v.every((e) => e && typeof e === 'object' && 'Key' in e && 'Value' in e)) kvArrays.push([p, v]);
      else v.forEach((e, i) => findKv(e, `${p}[${i}]`));
    } else if (v && typeof v === 'object') Object.keys(v).forEach((k) => findKv(v[k], `${p}.${k}`));
  };
  findKv(j, 'root');
  for (const [p, arr] of kvArrays) {
    out.push(`    CONTEXT ${p}  (${arr.length} Key/Value pairs):`);
    arr.forEach((e) => out.push(`        ${e.Key} = ${JSON.stringify(e.Value)}`));
  }
  return out.join('\n');
};

const extractBody = (zipName, reqFile) => {
  const zipPath = path.join(artifactsDir, zipName);
  if (!fs.existsSync(zipPath)) return { err: `zip not found: ${zipName}` };
  let tmp;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nldig-'));
    execSync(`unzip -o "${zipPath}" -d "${tmp}"`, { stdio: 'ignore' });
  } catch {
    return { err: `unzip failed (extract manually): ${zipName}` };
  }
  const reqDir = path.join(tmp, 'recorded-requests');
  if (!fs.existsSync(reqDir)) return { err: `no recorded-requests in ${zipName}` };
  const own = reqFile && path.basename(reqFile);
  const file = own && fs.existsSync(path.join(reqDir, own)) ? own : fs.readdirSync(reqDir).find((f) => f.endsWith('.txt'));
  if (!file) return { err: `no req file in ${zipName}` };
  const raw = fs.readFileSync(path.join(reqDir, file), 'utf8');
  const i = raw.search(/\r?\n\r?\n/);
  return { body: i >= 0 ? raw.slice(i).trim() : '' };
};

const findPairedDataScript = () => {
  // team/populations/*test*data* naming this VU's short id (T<NN>) + its <split virtualUserUid>
  const root = path.resolve(treeDir, '..', '..', '..');
  const popsDir = path.join(root, 'team', 'populations');
  if (!fs.existsSync(popsDir)) return null;
  const tid = (vuName.match(/@?t(\d+)/i) || [])[1];
  for (const f of fs.readdirSync(popsDir)) {
    if (!/test.*data/i.test(f)) continue;
    const xml = fs.readFileSync(path.join(popsDir, f), 'utf8');
    const desc = (xml.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    const split = (xml.match(/virtualUserUid="([^"]+)"/) || [])[1];
    if (tid && (new RegExp(`T0*${tid}\\b`).test(desc) || f.includes(`t${tid}_`) || f.includes(`@t${tid}_`))) {
      return { population: f, journey: desc.trim(), dataScript: split };
    }
  }
  return null;
};

// the data-script VU's own tree, so the seed is ported from its digest rather than from the journey's reads
function printPaired() {
  const vuTreeOf = (uid) => {
    const vusDir = path.dirname(path.resolve(treeDir));
    const head = fs
      .readdirSync(vusDir)
      .filter((f) => f.endsWith('.xml'))
      .find((f) => attr(openTag(fs.readFileSync(path.join(vusDir, f), 'utf8'), 'virtual-user'), 'uid') === uid);
    return head ? path.join(vusDir, head.replace(/\.xml$/, '')).replace(/\\/g, '/') : null;
  };
  const paired = findPairedDataScript();
  console.log('\nPAIRED DATA-SCRIPT VU  (port to source/seeds/ as a separate seed pass):');
  if (!paired) {
    console.log('  (none found)');
    return;
  }
  // a population can name another version's data script (@population_@test@data_@t34_26#2E1 → U13 (26.1)); the
  // same data script at this VU's version is the one to port
  const ver = (vuName.match(/#28([\d#E]+)#29/) || [])[1]?.replace(/#2E/g, '.');
  const sameVer = ver && paired.dataScript.replace(/\([\d.]+\)$/, `(${ver})`);
  const dsTree = (sameVer && vuTreeOf(sameVer)) || vuTreeOf(paired.dataScript);
  console.log(`  ${paired.population}\n    journey: ${paired.journey}\n    data-script VU: ${paired.dataScript}`);
  if (sameVer && sameVer !== paired.dataScript && vuTreeOf(sameVer)) console.log(`    at this VU's version: ${sameVer}`);
  console.log(
    dsTree ? `    → digest it: node .claude/scripts/neoload-digest.cjs "${dsTree}"` : '    (its tree was not found under team/vus)',
  );
}

// ---- emit digest ----
console.log(`=== NEOLOAD DIGEST: ${vuName} ===\n`);
if (pairedOnly) {
  printPaired();
  process.exit(0);
}

const steps = readStepFolders();
console.log(`STEP ORDER (${steps.length} steps): ${steps.map((s) => s.no).join(' → ')}`);
steps.forEach((s) => console.log(`  ${s.no}  ${s.name}${s.within.length ? `  [inside ${s.within.join(' > ')}]` : ''}`));

console.log('\nSPINE  (SPINE=keep · CHROME=UI-paint, fidelity tier · DROP=static/telemetry):');
const correlation = [];
const dissectQueue = [];
let dropped = 0;
for (const s of steps) {
  for (const r of stepRequests(s)) {
    const cls = classify(r.method, r.path);
    if (cls === 'DROP' || cls === 'CHROME') {
      dropped++;
      continue;
    }
    const ex = r.extractors.map((e) => e.name).join(', ');
    const used = r.consumes.join(', ');
    console.log(
      `  [${s.no}] ${r.method} ${r.path}${r.hasBody ? '  [BODY]' : ''}${used ? `\n         consume ← ${used}` : ''}${ex ? `\n         extract → ${ex}` : ''}`,
    );
    r.extractors.forEach((e) => correlation.push({ step: s.no, ...e }));
    if (r.hasBody && r.zip && DISSECT.test(r.path)) dissectQueue.push({ step: s.no, ...r });
  }
}
console.log(`  (${dropped} chrome/static/telemetry requests dropped from the spine)`);

console.log('\nCORRELATION  (solved <variable-extractor> → translate to k6):');
if (!correlation.length) console.log('  (none)');
for (const c of correlation) {
  const src = c.jsonpath ? `jsonpath=${c.jsonpath}` : c.regExp ? `regExp=${c.regExp}` : '(derived)';
  console.log(`  ${c.name}  ←[${c.step}]  ${src}`);
}

// The VU tree only names its ${P_…} variables; resolve them to the values held outside it
// (team/variables/*.xml → variables/version_*/*.txt, or an inline Base64 <values> blob).
console.log('');
const projectRoot = findProjectRoot(treeDir);
if (!projectRoot) {
  console.log('DATA POOLS:\n  (no NeoLoad project root above the VU tree — team/variables not found)');
} else {
  console.log(poolReport(refsInTree(treeDir), loadDefs(projectRoot), projectRoot, 3));
}

printPaired();

// a data-script VU hands its records to the consuming VU through a DataWrite jsAction that appends a variable to a
// variables/ file; the k6 seed replaces that file with names the journey discovers (rules/seeds.md)
const scriptsDir = path.join(treeDir, '%resources%', 'scripts');
const writes = fs.existsSync(scriptsDir)
  ? fs
      .readdirSync(scriptsDir)
      .flatMap((f) =>
        [
          ...fs
            .readFileSync(path.join(scriptsDir, f), 'utf8')
            .matchAll(/writeVariableToFile\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g),
        ].map((m) => `${m[1]} → ${m[2]}  (${f})`),
      )
  : [];
if (writes.length) {
  console.log('\nDATA WRITES  (this VU is a data script: what it hands to the consuming VU):');
  writes.forEach((w) => console.log(`  ${w}`));
}

console.log('\nWRITE / FORM-OPEN BODIES  (resolved real values from recorded-artifacts zips):');
if (!dissectQueue.length) console.log('  (none)');
for (const r of dissectQueue) {
  console.log(`\n  --- [${r.step}] ${r.method} ${r.path}  (zip ${r.zip.slice(0, 8)}) ---`);
  const { body, err } = extractBody(r.zip, r.reqFile);
  console.log(err ? `    ${err}` : dissect(body));
}
