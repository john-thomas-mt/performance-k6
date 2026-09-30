// Shared NeoLoad VU-tree parsing for the neoload-* scripts: step order, per-step requests in true
// execution order, SPINE / CHROME / DROP classification, <variable-extractor> blocks, the templated
// (${…}-bearing) body, and the resolved recorded request pulled from a recorded-artifacts zip.
//
// Module only — required by neoload-port-review.cjs. Deterministic and read-only; zip extraction shells
// out to `unzip` (git-bash / any *nix).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const STATIC_EXT = /\.(css|js|html|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|map)(\?|$)/i;
const STATIC_PREFIX = /^\/(Content|Scripts|scripts|fonts|Fonts|app)\//i;
const TELEMETRY = /\/v1\/traces|analytics|\/signalr\//i;
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
  'ChangelogNotificationsCount',
  'GetMainMenuData',
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

const barePath = (p) => p.replace(/^\/\$\{[^}]+\}/, '').replace(/^\/[^/]+(?=\/api\/)/, '');
const classify = (p) => {
  const b = barePath(p);
  if (STATIC_EXT.test(b) || STATIC_PREFIX.test(b) || TELEMETRY.test(b)) return 'DROP';
  if (CHROME.some((c) => b.includes(c))) return 'CHROME';
  return 'SPINE';
};
const endpointOf = (p) =>
  barePath(p)
    .replace(/^\/api\//, '')
    .replace(/\?.*$/, '');

const xmlDecode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const attr = (text, name) => {
  const m = text.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? xmlDecode(m[1]) : undefined;
};
const openTag = (xml, tag) => {
  const i = xml.indexOf(`<${tag}`);
  return i < 0 ? '' : xml.slice(i, xml.indexOf('>', i) + 1);
};

const vuXmlPath = (treeDir) => `${treeDir.replace(/[\\/]+$/, '')}.xml`;
const embeddedUids = (xml) => [...xml.matchAll(/<weighted-embedded-action uid="([^"]+)"/g)].map((m) => m[1]);

const parseRequest = (xml) => {
  const action = openTag(xml, 'http-action');
  const method = attr(action, 'method');
  if (!method) return null;
  const rawPath = attr(action, 'path') || '?';
  const cdata = xml.match(/<textPostContent><!\[CDATA\[([\s\S]*?)\]\]><\/textPostContent>/);
  const plain = cdata ? null : xml.match(/<textPostContent>([\s\S]*?)<\/textPostContent>/);
  const template = cdata ? cdata[1] : plain ? xmlDecode(plain[1]) : null;
  const extractors = [...xml.matchAll(/<variable-extractor\b(?:[^>"]|"[^"]*")*>/g)]
    .map((m) => ({ name: attr(m[0], 'name'), jsonpath: attr(m[0], 'jsonpath'), regExp: attr(m[0], 'regExp') }))
    .filter((e) => e.name);
  return {
    uid: attr(openTag(xml, 'http-page'), 'uid'),
    method,
    rawPath,
    path: barePath(rawPath),
    endpoint: endpointOf(rawPath),
    cls: classify(rawPath),
    template,
    zip: (xml.match(/recorded-artifacts\/([a-f0-9-]+\.zip)/) || [])[1],
    reqFile: (xml.match(/<requestContentFileDescription>([^<]+)<\/requestContentFileDescription>/) || [])[1],
    extractors,
  };
};

// Steps in the VU's <actions-container> order; each step's requests in its container's order.
const readTree = (treeDir) => {
  const actionsDir = path.join(treeDir, 'actions-container');
  const vuXml = fs.readFileSync(vuXmlPath(treeDir), 'utf8');
  const actionsTag = vuXml.slice(vuXml.indexOf('<actions-container'));
  const order = embeddedUids(actionsTag.slice(0, actionsTag.indexOf('</actions-container>')));
  const stepFiles = fs.readdirSync(actionsDir).filter((f) => f.endsWith('.xml'));
  const byUid = new Map();
  for (const f of stepFiles) {
    const xml = fs.readFileSync(path.join(actionsDir, f), 'utf8');
    const root = (xml.match(/<([a-z-]+)\b/) || [])[1];
    const head = openTag(xml, root);
    byUid.set(attr(head, 'uid'), { file: f, xml, root, head });
  }
  const steps = [];
  const other = [];
  for (const uid of order) {
    const node = byUid.get(uid);
    if (!node) continue;
    if (node.root !== 'basic-logical-action-container') {
      other.push({ file: node.file, root: node.root, name: attr(node.head, 'name') });
      continue;
    }
    const dir = path.join(actionsDir, node.file.replace(/\.xml$/, ''));
    const reqs = new Map();
    const nonHttp = [];
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.xml'))) {
        const xml = fs.readFileSync(path.join(dir, f), 'utf8');
        const r = parseRequest(xml);
        if (r) reqs.set(r.uid, { ...r, file: f });
        else nonHttp.push({ file: f, root: (xml.match(/<([a-z-]+)\b/) || [])[1] });
      }
    }
    const inner = embeddedUids(node.xml);
    steps.push({
      name: attr(node.head, 'name'),
      slaProfile: attr(node.head, 'slaProfileEnabled') === 'true' ? attr(node.head, 'slaProfileName') : null,
      requests: inner.map((u) => reqs.get(u)).filter(Boolean),
      nonHttp,
    });
  }
  return { vuXml, steps, other };
};

// The resolved recorded request (real values) for a request's zip: request line + body.
const recordedRequest = (treeDir, r) => {
  if (!r.zip) return { err: 'no recorded-artifacts zip' };
  const zipPath = path.join(treeDir, '%resources%', 'recorded-artifacts', r.zip);
  if (!fs.existsSync(zipPath)) return { err: `zip not found: ${r.zip}` };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nltree-'));
  try {
    execSync(`unzip -o -q "${zipPath}" -d "${tmp}"`, { stdio: 'ignore' });
  } catch {
    return { err: `unzip failed: ${r.zip}` };
  }
  const reqDir = path.join(tmp, 'recorded-requests');
  const split = (raw) => {
    const i = raw.search(/\r?\n\r?\n/);
    return { requestLine: raw.split(/\r?\n/)[0], body: i >= 0 ? raw.slice(i).trim() : '' };
  };
  const named = r.reqFile ? path.join(tmp, r.reqFile) : null;
  let pick = named && fs.existsSync(named) ? split(fs.readFileSync(named, 'utf8')) : null;
  if (!pick && fs.existsSync(reqDir)) {
    const target = (r.template || '').length;
    pick = fs
      .readdirSync(reqDir)
      .map((f) => split(fs.readFileSync(path.join(reqDir, f), 'utf8')))
      .filter((x) => x.requestLine.includes(`/api/${r.endpoint}`) || x.requestLine.includes(r.endpoint))
      .sort((a, b) => Math.abs(a.body.length - target) - Math.abs(b.body.length - target))[0];
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return pick || { err: `no recorded request for ${r.endpoint} in ${r.zip}` };
};

// Align a ${…}-templated string against its resolved recording → token → recorded value.
const alignTokens = (rawTemplate, rawResolved) => {
  const template = rawTemplate.replace(/\r\n/g, '\n');
  const resolved = rawResolved.replace(/\r\n/g, '\n');
  const parts = template.split(/(\$\{[^}]+\})/);
  const out = [];
  let cursor = resolved.startsWith(parts[0]) ? parts[0].length : -1;
  if (cursor < 0) return { values: out, aligned: false };
  for (let i = 1; i < parts.length; i += 2) {
    const token = parts[i].slice(2, -1);
    const next = parts[i + 1];
    if (next === '' && i + 2 < parts.length) {
      out.push({ token, value: null });
      continue;
    }
    const idx = next === '' ? resolved.length : resolved.indexOf(next, cursor);
    if (idx < 0) return { values: out, aligned: false };
    out.push({ token, value: resolved.slice(cursor, idx) });
    cursor = idx + next.length;
  }
  return { values: out, aligned: true };
};

module.exports = { classify, endpointOf, barePath, attr, openTag, vuXmlPath, readTree, recordedRequest, alignTokens };
