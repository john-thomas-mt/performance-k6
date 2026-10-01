// Shared NeoLoad VU-tree parsing for the neoload-* scripts: step order, per-step pages and every request
// they bundle in recorded order, SPINE / CHROME / DROP classification, <variable-extractor> blocks, the
// templated (${…}-bearing) body, the tier path/body a fidelity list emits, and the resolved recorded request
// pulled from a recorded-artifacts zip.
//
// Module only — required by neoload-port-review.cjs, fidelity-tokens.cjs and gen-fidelity-lists.cjs.
// Deterministic and read-only; zip extraction shells out to `unzip` (git-bash / any *nix).

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

// The path a fidelity tier emits for an action: version segment stripped, empty segments collapsed, and the
// query rebuilt from its <parameter> elements with ${…} tokens kept. Shared with gen-fidelity-lists.cjs so the
// review matches tier entries against the recording with the generator's own normalization.
const tierPath = (action) => {
  const rawPath = (action.match(/path="([^"]+)"/) || [])[1] || '';
  const bare = rawPath
    .replace(/^\/\$\{[^}]+\}/, '')
    .replace(/^\/[^/]*(?=\/(api|app)\/)/, '')
    .replace(/\/{2,}/g, '/');
  const params = [...action.matchAll(/<parameter\b([^>]*)>/g)]
    .map((p) => {
      const k = (p[1].match(/\bname="([^"]*)"/) || [])[1];
      const v = (p[1].match(/\bvalue="([^"]*)"/) || [])[1];
      return k != null ? `${k}=${v ?? ''}` : null;
    })
    .filter(Boolean);
  return { bare, url: params.length ? `${bare}?${params.join('&')}` : bare, params };
};
// the posted body as the tiers emit it: NeoLoad stores large bodies Base64-encoded
const tierBody = (action) => {
  const m = action.match(/<textPostContent>\s*<!\[CDATA\[([\s\S]*?)\]\]>/);
  const body = m ? m[1] : undefined;
  return body && body.startsWith('Encoded(Base64):') ? Buffer.from(body.slice(16), 'base64').toString('utf8') : body;
};

const parseAction = (action, page) => {
  const head = openTag(action, 'http-action');
  const method = attr(head, 'method');
  if (!method) return null;
  const rawPath = attr(head, 'path') || '?';
  const cdata = action.match(/<textPostContent><!\[CDATA\[([\s\S]*?)\]\]><\/textPostContent>/);
  const plain = cdata ? null : action.match(/<textPostContent>([\s\S]*?)<\/textPostContent>/);
  const template = cdata ? cdata[1] : plain ? xmlDecode(plain[1]) : null;
  const extractors = [...action.matchAll(/<variable-extractor\b(?:[^>"]|"[^"]*")*>/g)]
    .map((m) => ({ name: attr(m[0], 'name'), jsonpath: attr(m[0], 'jsonpath'), regExp: attr(m[0], 'regExp') }))
    .filter((e) => e.name);
  return {
    uid: page.uid,
    actionUid: attr(head, 'uid'),
    enabled: attr(head, 'enabled') !== 'false',
    method,
    rawPath,
    path: barePath(rawPath),
    endpoint: endpointOf(rawPath),
    cls: classify(rawPath),
    tier: tierPath(action),
    body: tierBody(action),
    template,
    zip: page.zip,
    reqFile: (action.match(/<requestContentFileDescription>([^<]+)<\/requestContentFileDescription>/) || [])[1],
    extractors,
  };
};

// One NeoLoad page file: an <http-page> plus every <http-action> it bundles (the main request and its embedded
// resources), in the page's <embedded-action> order. NeoLoad fires a page's actions in parallel unless
// playRequestsSequentially is set.
const parsePage = (xml) => {
  const head = openTag(xml, 'http-page');
  const page = {
    uid: attr(head, 'uid'),
    name: attr(head, 'name'),
    sequential: attr(head, 'playRequestsSequentially') === 'true',
    zip: (xml.match(/recorded-artifacts\/([a-f0-9-]+\.zip)/) || [])[1],
  };
  const blocks = xml.match(/<http-action\b[\s\S]*?<\/http-action>/g) || [];
  const actions = blocks.map((b) => parseAction(b, page)).filter(Boolean);
  const order = [...xml.matchAll(/<embedded-action>([^<]+)<\/embedded-action>/g)].map((m) => m[1]);
  const pos = (a) => (order.includes(a.actionUid) ? order.indexOf(a.actionUid) : order.length);
  return { ...page, actions: [...actions].sort((a, b) => pos(a) - pos(b)) };
};

// A step's pages in recorded order: the step container's <weighted-embedded-action> list, keyed by each page
// file's <http-page> uid. A directory listing is alphabetical by file name, which is not the recorded order.
const pageOrder = (stepXml, byPage) =>
  embeddedUids(stepXml)
    .map((u) => byPage.get(u))
    .filter(Boolean);

// Steps in the VU's <actions-container> order; each step's pages and requests in recorded order.
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
    const byPage = new Map();
    const nonHttp = [];
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.xml'))) {
        const xml = fs.readFileSync(path.join(dir, f), 'utf8');
        const page = parsePage(xml);
        if (page.actions.length) {
          page.file = f;
          page.actions.forEach((a) => (a.file = f));
          byPage.set(page.uid, page);
        } else nonHttp.push({ file: f, root: (xml.match(/<([a-z-]+)\b/) || [])[1] });
      }
    }
    const pages = pageOrder(node.xml, byPage);
    steps.push({
      name: attr(node.head, 'name'),
      dir: node.file.replace(/\.xml$/, ''),
      slaProfile: attr(node.head, 'slaProfileEnabled') === 'true' ? attr(node.head, 'slaProfileName') : null,
      pages,
      // every request NeoLoad fires in the step, page by page; disabled actions (enabled="false") never fire
      requests: pages.flatMap((p) => p.actions.filter((a) => a.enabled)),
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

module.exports = {
  classify,
  endpointOf,
  barePath,
  attr,
  openTag,
  vuXmlPath,
  embeddedUids,
  parsePage,
  pageOrder,
  tierPath,
  tierBody,
  readTree,
  recordedRequest,
  alignTokens,
};
