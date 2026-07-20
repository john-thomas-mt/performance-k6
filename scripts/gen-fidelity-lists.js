/* Walk a NeoLoad VU tree and emit the tier-2 (UI chrome), tier-3 (static), and transport request lists a
   fidelity port fires behind -e FIDELITY=ui|full. Spine endpoints (scripted as correlated wrappers) are
   excluded so they are not double-fired. Requests are grouped by NeoLoad step so the flow can fire each
   slice in the matching group, keeping the extra load in-flight around the spine writes.
   Usage: node scripts/gen-fidelity-lists.js "<path to VU tree>" <chrome-out.ts> <static-out.ts> <transport-out.ts> */
const fs = require('fs');
const path = require('path');

const [vuRoot, chromeOut, staticOut, transportOut] = process.argv.slice(2);
if (!vuRoot || !chromeOut || !staticOut || !transportOut) {
  console.error('usage: node scripts/gen-fidelity-lists.js <vu-tree> <chrome-out.ts> <static-out.ts> <transport-out.ts>');
  process.exit(1);
}
const ROOT = path.join(vuRoot, 'actions-container');

const camel = (file, suffix) => path.basename(file, suffix).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const journey = path.basename(chromeOut, '.chrome.ts');
const chromeVar = `${camel(chromeOut, '.chrome.ts')}Chrome`;
const staticVar = `${camel(staticOut, '.static.ts')}Static`;
const transportVar = `${camel(transportOut, '.transport.ts')}Transport`;

// spine endpoints scripted as correlated wrappers — never emit as chrome (would double-fire)
const SPINE = [
  '/api/USIDataGridServer/CreateNewRowsWithDefaultValues',
  '/api/USIDataGridServer/GetGridData2',
  '/api/GenericDetailServer/Save2',
  '/api/USIDataGridServer/Save2',
  '/api/GenericDetailServer/GetInitialData2',
  '/api/GenericServer/CacheFiles',
  '/api/GenericServer/ApplicationUnloading',
  '/api/WindowServer/GetWindowInfo',
  '/api/GenericServer/SignIn',
  // promoted to a gated correlated wrapper (produces the search-result key the chrome batch consumes)
  '/api/USISearchComboServer/GetDynamicSearchResults',
  // scripted as signalr_negotiate (produces the connectionToken the transport signalr/start consumes)
  '/signalr/negotiate',
  // UI-chrome grid control-info reads (body echoes a full selected grid row) scripted as dedicated,
  // fidelity-gated wrappers (get_service_order_control_info / get_event_control_info) in the T34/T31
  // flows that need 1:1 parity — excluded here so the chrome tier does not also fire them
  '/api/USIDataGridServer/GetControlInfo',
];
// per-journey spine: endpoints a specific journey scripts as correlated wrappers but which share a path
// with wrapper-less UI-chrome grids in other journeys, so they can't be excluded globally via SPINE.
// Scoped per journey and per step (the step numbers the wrapper reproduces) so only those occurrences are
// dropped from that journey's chrome, leaving a genuine UI grid on the same path in another step in place
// (e.g. crystal-report re-opens the report-master list at step 10 via a wrapper, but its grid read there is
// pure chrome — so GenericListServer is excluded at 10, USIDataGridServer is not).
const JOURNEY_SPINE = {
  'crystal-report': {
    '/api/GenericListServer/GetInitialData2': ['03', '10'],
    '/api/USIDataGridServer/GetInitialData2': ['03', '07', '09'],
    '/api/GenericSearchServer/GetInitialData2': ['07', '09'],
    '/api/USIMultiSelectSuperBoxPageServer/GetInitialData': ['08'],
    '/api/USIMultiSelectSuperBoxPageServer/save': ['08'],
  },
};
// endpoints a later release drops but that still exist on an older *live* release — emit with a removedIn guard
// so fire time skips them only where they're gone (version_at_least), keeping them on the releases that serve
// them. Empty today: the endpoints removed so far (the NotificationServer count reads) are gone on every live
// version, so they're dropped outright via DEAD below rather than gated.
const VERSION_GATED = {};
// endpoints absent on every live version in the matrix — verified 404 across 25.4/26.1/26.2/26.3 by a
// verify-envs full-fidelity sweep. They were fired by the recording but no live release serves them, so
// emitting them only inflates http_req_failed; never emit them to any tier.
const DEAD = ['/api/NotificationServer/RetrieveNotificationCount', '/api/NotificationServer/RetrieveUnseenChangelogNotificationsCount'];
const STATIC_EXT = /\.(js|css|html|svg|png|ico|woff2?|ttf|otf|eot|map|jpg|jpeg|gif)(\?|$)/i;

const stepDirs = fs
  .readdirSync(ROOT)
  .filter((d) => /^@t\d+/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
  .sort();

const chrome = {};
const stat = {};
const transport = {};

for (const step of stepDirs) {
  const stepNo = (step.match(/_(\d+)_/) || [])[1];
  if (!stepNo) continue;
  const dir = path.join(ROOT, step);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.xml'))) {
    const xml = fs.readFileSync(path.join(dir, f), 'utf8');
    // NeoLoad bundles a page's whole resource burst as multiple <http-action> elements in one file — walk
    // every action, not just the first, or the bundled embedded resources are silently dropped from the tiers.
    const actions = xml.match(/<http-action\b[\s\S]*?<\/http-action>/g) || [];
    for (const action of actions) {
      const method = (action.match(/method="([^"]+)"/) || [])[1] || 'GET';
      const rawPath = (action.match(/path="([^"]+)"/) || [])[1] || '';
      if (!rawPath) continue;
      const bare = rawPath.replace(/^\/\$\{[^}]+\}/, '').replace(/^\/[^/]*(?=\/(api|app)\/)/, ''); // strip version segment
      if (SPINE.some((s) => bare.startsWith(s))) continue;
      if (DEAD.some((s) => bare.startsWith(s))) continue;
      const journeySpine = JOURNEY_SPINE[journey] || {};
      const journeyKey = Object.keys(journeySpine).find((p) => bare.startsWith(p));
      if (journeyKey && journeySpine[journeyKey].includes(stepNo)) continue;

      // recover the query string from NeoLoad <parameter> elements, keeping ${...} tokens for runtime substitution
      const params = [...action.matchAll(/<parameter\b([^>]*)>/g)]
        .map((p) => {
          const k = (p[1].match(/\bname="([^"]*)"/) || [])[1];
          const v = (p[1].match(/\bvalue="([^"]*)"/) || [])[1];
          return k != null ? `${k}=${v ?? ''}` : null;
        })
        .filter(Boolean);
      const url = params.length ? `${bare}?${params.join('&')}` : bare;

      // NeoLoad stores large bodies Base64-encoded; decode so the real JSON (with ${...} tokens) is emitted
      const m = action.match(/<textPostContent>\s*<!\[CDATA\[([\s\S]*?)\]\]>/);
      let body = m ? m[1] : undefined;
      if (body && body.startsWith('Encoded(Base64):')) body = Buffer.from(body.slice(16), 'base64').toString('utf8');

      if (bare.includes('/app/') || STATIC_EXT.test(bare)) {
        (stat[stepNo] = stat[stepNo] || []).push({ path: bare });
      } else if (bare.includes('/api/')) {
        const req = { method, path: url };
        if (method !== 'GET' && body !== undefined) req.body = body;
        const gated = Object.keys(VERSION_GATED).find((p) => bare.startsWith(p));
        if (gated) req.removedIn = VERSION_GATED[gated];
        (chrome[stepNo] = chrome[stepNo] || []).push(req);
      } else {
        // the paramless app85.cshtml bootstrap is scripted as the fetch_bundle_versions wrapper (it correlates
        // the bundle-version tokens the other transport requests consume) — exclude here to avoid double-firing
        if (bare.endsWith('app85.cshtml') && !params.length) continue;
        // neither /api/ nor a static asset (SignalR start, SSO cshtml, …) — the transport tier, fired at
        // FIDELITY=full so a full run reproduces every request the recording made
        const req = { method, path: url };
        if (method !== 'GET' && body !== undefined) req.body = body;
        (transport[stepNo] = transport[stepNo] || []).push(req);
      }
    }
  }
}

const tokenBanner = (kind) =>
  `/* eslint-disable no-template-curly-in-string */\n/* Generated by scripts/gen-fidelity-lists.js from the ${journey} NeoLoad tree — do not hand-edit.\n   Regenerate after re-recording. ${kind} requests fired behind -e FIDELITY.\n   The \${...} tokens are correlation placeholders substituted at fire time. */`;

for (const out of [chromeOut, staticOut, transportOut]) fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  chromeOut,
  `${tokenBanner('Tier-2 (UI chrome)')}\nimport { ChromeRequest } from '../../utils/exports/types.exp.ts';\n\nexport const ${chromeVar}: { [step: string]: ChromeRequest[] } = ${JSON.stringify(chrome, null, 2)};\n`,
);
fs.writeFileSync(
  staticOut,
  `/* Generated by scripts/gen-fidelity-lists.js — tier-3 static content fired behind -e FIDELITY=full. */\nimport { StaticRequest } from '../../utils/exports/types.exp.ts';\n\nexport const ${staticVar}: { [step: string]: StaticRequest[] } = ${JSON.stringify(stat, null, 2)};\n`,
);
fs.writeFileSync(
  transportOut,
  `${tokenBanner('Transport (non-api/non-static)')}\nimport { ChromeRequest } from '../../utils/exports/types.exp.ts';\n\nexport const ${transportVar}: { [step: string]: ChromeRequest[] } = ${JSON.stringify(transport, null, 2)};\n`,
);

const n = (o) => Object.values(o).reduce((a, v) => a + v.length, 0);
console.log(`chrome: ${n(chrome)} requests across ${Object.keys(chrome).length} steps -> ${chromeOut}`);
console.log(`static: ${n(stat)} requests across ${Object.keys(stat).length} steps -> ${staticOut}`);
console.log(`transport: ${n(transport)} requests across ${Object.keys(transport).length} steps -> ${transportOut}`);
