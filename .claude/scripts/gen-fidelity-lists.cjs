/* Walk a NeoLoad VU tree and emit the tier-2 (UI chrome), tier-3 (static), and transport request lists a
   fidelity port fires behind -e FIDELITY=ui|full. Spine endpoints (scripted as correlated wrappers) are
   excluded so they are not double-fired. Requests are grouped by NeoLoad step so the flow can fire each
   slice in the matching group, keeping the extra load in-flight around the spine writes.
   Usage: node .claude/scripts/gen-fidelity-lists.cjs "<path to VU tree>" <chrome-out.ts> <static-out.ts> <transport-out.ts> */
const fs = require('fs');
const path = require('path');
const { embeddedUids, attr, openTag, tierPath, tierBody, stepNodes } = require('./neoload-tree.cjs');

const [vuRoot, chromeOut, staticOut, transportOut] = process.argv.slice(2);
if (!vuRoot || !chromeOut || !staticOut || !transportOut) {
  console.error('usage: node .claude/scripts/gen-fidelity-lists.cjs <vu-tree> <chrome-out.ts> <static-out.ts> <transport-out.ts>');
  process.exit(1);
}
const ROOT = path.join(vuRoot, 'actions-container');

const camel = (file, suffix) =>
  path
    .basename(file, suffix)
    .replace(/^t\d+-/, '')
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const journey = path.basename(chromeOut, '.chrome.ts');
const chromeVar = `${camel(chromeOut, '.chrome.ts')}Chrome`;
const staticVar = `${camel(staticOut, '.static.ts')}Static`;
const transportVar = `${camel(transportOut, '.transport.ts')}Transport`;

// global spine: paths every journey scripts as a correlated wrapper wherever the recording has them — writes,
// uploads, sign-in/out and the correlation sources the tiers consume — so they are never emitted as chrome.
// Reads stay off this list: a read on a shared path (grid, detail open, window info) is a wrapper in some
// steps and pure UI paint in others, so a global exclusion silently drops every unscripted occurrence from
// every tier (it once hid recorded GetGridData2 / GetInitialData2 / GetWindowInfo reads in all journeys).
// Exclude a read per journey and step in JOURNEY_SPINE, or per request in JOURNEY_SPINE_REQUESTS.
const SPINE = [
  '/api/USIDataGridServer/CreateNewRowsWithDefaultValues',
  '/api/GenericDetailServer/Save2',
  '/api/USIDataGridServer/Save2',
  '/api/GenericServer/CacheFiles',
  '/api/GenericServer/ApplicationUnloading',
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
  't5-payment-receipt-report': {
    '/api/v1/Reports/10/204/RunReport': ['01'],
  },
  't14-detail-general-ledger-report': {
    '/api/v1/Reports/10/105/RunReport': ['01'],
  },
  't6-badge-report': {
    '/api/v1/Reports/10/6044/RunReport': ['01'],
  },
  't17-event-revenue-metric-report': {
    '/api/v1/Reports/10/6168/RunReport': ['01'],
  },
  't18-space-utilization-report': {
    '/api/v1/Reports/10/6150/RunReport': ['01'],
  },
  't19-opportunity-conversion-report': {
    '/api/v1/Reports/10/6165/RunReport': ['01'],
  },
  't2-book-event': {
    '/api/USIDataGridServer/GetGridData2': ['08', '10'],
    '/api/GenericDetailServer/GetInitialData2': ['06'],
  },
  't4-copy-event': {
    '/api/USIDataGridServer/GetGridData2': ['04'],
    '/api/GenericDetailServer/GetInitialData2': ['05', '06'],
    '/api/WindowServer/GetWindowInfo': ['05'],
  },
  't34-copy-service-orders': {
    '/api/USIDataGridServer/GetGridData2': ['04', '07'],
    '/api/GenericDetailServer/GetInitialData2': ['06'],
  },
  't16-copy-paste-event-function': {
    '/api/GenericListServer/GetInitialData2': ['07'],
    '/api/USIDataGridServer/GetInitialData2': ['03', '07'],
    '/api/USIDataGridServer/GetGridData2': ['04', '06'],
    '/api/GenericDetailServer/GetInitialData2': ['04', '05'],
    '/api/GenericDetailServer/GetData2': ['06'],
  },
  't30-crystal-report': {
    '/api/GenericListServer/GetInitialData2': ['03', '10'],
    '/api/USIDataGridServer/GetInitialData2': ['03', '07', '09'],
    '/api/GenericSearchServer/GetInitialData2': ['07', '09'],
    '/api/USIMultiSelectSuperBoxPageServer/GetInitialData': ['08'],
    '/api/USIMultiSelectSuperBoxPageServer/save': ['08'],
    '/api/GenericDetailServer/GetInitialData2': ['04'],
    '/api/WindowServer/GetWindowInfo': ['08'],
  },
  't1-lead-account': {
    '/api/ObjectColumnCacheServer/GetObjectColumns': ['03'],
    '/api/GenericListServer/GetInitialData2': ['03', '07'],
    '/api/USIDataGridServer/GetInitialData2': ['03', '06', '07'],
    '/api/GenericDetailServer/GetInitialData2': ['04', '05', '06'],
    '/api/GenericDetailServer/HandleDependentFields2': ['05'],
    '/api/USISearchComboServer/SaveRecentlyUsed': ['05'],
    '/api/GenericDetailServer/AccessServerUI': ['06'],
    '/api/GenericSearchServer/GetInitialData2': ['06'],
  },
  't31-room-diagram-upload': {
    '/api/USIDataGridServer/GetGridData2': ['04'],
    '/api/GenericDetailServer/GetInitialData2': ['05', '08'],
  },
  't3-contact-service-order': {
    '/api/ObjectColumnCacheServer/GetObjectColumns': ['03'],
    '/api/GenericListServer/GetInitialData2': ['03', '05'],
    '/api/USISearchComboServer/SaveRecentlyUsed': ['07'],
    '/api/GenericDetailServer/HandleDependentFields2': ['07'],
    '/api/USIDataGridServer/GetGridData2': ['03', '07'],
    '/api/GenericDetailServer/GetInitialData2': ['04', '06', '08'],
  },
  't8-invoice-events': {
    '/api/MainMenuServer/GetMainMenuData': ['03'],
    '/api/GenericListServer/GetInitialData2': ['03'],
    '/api/USIDataGridServer/GetInitialData2': ['03'],
    '/api/GenericSearchServer/GetInitialData2': ['04'],
    '/api/USIDataGridServer/GetGridData2': ['04', '06'],
    '/api/USIDataGridServer/AccessServerUI': ['05'],
    '/api/GenericDetailServer/GetInitialData2': ['05'],
    '/api/GenericDetailServer/HandleDependentFields2': ['06'],
  },
  't9-purchase-orders': {
    '/api/MainMenuServer/GetMainMenuData': ['03'],
    '/api/GenericListServer/GetInitialData2': ['03'],
    '/api/USIDataGridServer/GetInitialData2': ['03', '06', '07'],
    '/api/GenericSearchServer/GetInitialData2': ['06', '07'],
    '/api/GenericDetailServer/GetInitialData2': ['04', '05', '06', '07'],
    '/api/GenericDetailServer/HandleDependentFields2': ['05', '07'],
    '/api/USISearchComboServer/SaveRecentlyUsed': ['05', '07'],
    '/api/USIGLAccountServer/ValidateGLAccount': ['07'],
  },
  't10-voucher-processing': {
    '/api/MainMenuServer/GetMainMenuData': ['03'],
    '/api/GenericListServer/GetInitialData2': ['03', '05', '10'],
    '/api/USIDataGridServer/GetInitialData2': ['03', '05', '06', '07', '08', '10'],
    '/api/USIDataGridServer/GetGridData2': ['07', '09', '10', '12'],
    '/api/GenericDetailServer/GetInitialData2': ['04', '05', '06', '07', '08', '11'],
    '/api/GenericDetailServer/GetData2': ['09'],
    '/api/GenericSearchServer/GetInitialData2': ['05', '06', '07', '08'],
    '/api/GenericDetailServer/HandleDependentFields2': ['06'],
    '/api/USISearchComboServer/SaveRecentlyUsed': ['06'],
    '/api/GenericDetailServer/AccessServerUI': ['07'],
    '/api/USIDataGridServer/AccessServerUI': ['11'],
  },
  't11-payment-plan': {
    '/api/GenericListServer/GetInitialData2': ['03', '09'],
    '/api/USIDataGridServer/GetInitialData2': ['03', '07', '09'],
    '/api/GenericSearchServer/GetInitialData2': ['04', '07'],
    '/api/USISearchComboServer/GetDynamicSearchResults': ['04', '06'],
    '/api/USISearchComboServer/SaveRecentlyUsed': ['04'],
    '/api/GenericSearchServer/HandleDependentFields2': ['04'],
    '/api/USIDataGridServer/GetGridData2': ['04', '08'],
    '/api/GenericDetailServer/GetInitialData2': ['04', '05', '06', '07', '09'],
    '/api/GenericDetailServer/AccessServerUI': ['05'],
    '/api/GenericDetailServer/HandleDependentFields2': ['06', '08'],
  },
};
// per-journey, per-request spine: individual requests scripted as wrappers on a path whose other requests in
// the same step stay chrome (contact-service-order step 04 fires 15 GetObjectColumns, only the object-1659 one
// is a wrapper), so a path+step exclusion would drop too much. Matched on step and path, plus an optional
// prefix of the whitespace-stripped body and/or a substring of the path+query; `max` caps how many matching
// requests are excluded when the step records identical requests and the wrapper reproduces only some of them.
const JOURNEY_SPINE_REQUESTS = {
  't2-book-event': [
    { path: '/api/WindowServer/GetWindowInfo', step: '03', query: 'astrWindowID=EB8776', max: 1 },
    // the account pick: refresh_booking_account_fields reproduces it to correlate the account's contact
    { path: '/api/GenericDetailServer/HandleDependentFields2', step: '07', max: 1 },
  ],
  't3-contact-service-order': [
    { path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '04', body: '[1659,' },
    { path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '06', body: '[456,' },
    { path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '08', body: '[2556,' },
  ],
  't16-copy-paste-event-function': [{ path: '/api/USIDataGridServer/GetInitialData2', step: '04', body: '["10",5451,23,' }],
  't9-purchase-orders': [{ path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '03', body: '[81,' }],
  't10-voucher-processing': [
    { path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '03', body: '[1138,' },
    { path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '04', body: '[1106,' },
  ],
  't11-payment-plan': [
    { path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '03', body: '[4,' },
    { path: '/api/ObjectColumnCacheServer/GetObjectColumns', step: '05', body: '[229,' },
  ],
};
// endpoints a later release drops but that still exist on an older *live* release — emit with a removedIn guard
// so fire time skips them only where they're gone (version_at_least), keeping them on the releases that serve
// them. Empty today: the endpoints removed so far (the NotificationServer count reads) are gone on every live
// version, so they're dropped outright via DEAD below rather than gated.
const VERSION_GATED = {};
// endpoints absent on every live version in the matrix — verified 404 across 25.4/26.1/26.2/26.3 by a
// verify-envs full-fidelity sweep. They were fired by the recording but no live release serves them, so
// emitting them only inflates http_req_failed; never emit them to any tier.
const DEAD = [
  '/api/NotificationServer/RetrieveNotificationCount',
  '/api/NotificationServer/RetrieveUnseenChangelogNotificationsCount',
  '/util00/scripts/jquery.js',
];
const STATIC_EXT = /\.(js|css|html|svg|png|ico|woff2?|ttf|otf|eot|map|jpg|jpeg|gif)(\?|$)/i;

// every step folder, including those inside a loop/if/try action (stepNodes), relative to actions-container
const nodes = stepNodes(vuRoot).steps.filter((s) => /^@t\d+/.test(path.basename(s.dir)));
const stepDirs = nodes.map((s) => s.dir).sort();

const chrome = {};
const stat = {};
const transport = {};
// every request kept out of the tiers as "scripted", printed at the end so the porter can confirm each one
// really is fired by a wrapper in that step — an exclusion with no wrapper behind it fires at no tier at all
const excluded = [];
const requestMatches = new Map();

// step number from the folder name: `_NN_` mid-name (@t30_@crystal@report_02_@login) or `_NN` at the end
// (@t28_@gadgets_@load_03); a VU whose steps carry no number at all (the single-step report VUs,
// @t005_@payment@receipt_@report) numbers them by position. Mirrored in neoload-digest.cjs.
const STEP_NO = /_(\d+)(?:_|$)/;
const anyNumbered = stepDirs.some((d) => STEP_NO.test(path.basename(d)));
// an if-action records the same step number in its then and else branches; the tiers are keyed by step number, so
// both branches would merge into one replay. Stop and name them rather than emit a merged step
const placesOf = new Map();
for (const s of nodes) {
  const no = (path.basename(s.dir).match(STEP_NO) || [])[1];
  if (no) placesOf.set(no, [...(placesOf.get(no) || []), s.within.join(' > ') || 'top level']);
}
const clashes = [...placesOf].filter(([, places]) => places.length > 1);
if (clashes.length) {
  console.error(
    `steps recorded more than once: ${clashes.map(([no, places]) => `${no} in [${places.join('; ')}]`).join(', ')} — the tiers are keyed by step number, so decide which branch the journey ports before generating`,
  );
  process.exit(1);
}

for (const [i, step] of stepDirs.entries()) {
  const stepNo = (path.basename(step).match(STEP_NO) || [])[1] || (anyNumbered ? '' : String(i + 1).padStart(2, '0'));
  if (!stepNo) continue;
  const dir = path.join(ROOT, step);
  // walk the pages in recorded order (the step container's <weighted-embedded-action> list), not the
  // alphabetical directory listing, so the replay fires them in the sequence the recording made them
  const pageXml = new Map(
    fs
      .readdirSync(dir)
      .filter((x) => x.endsWith('.xml'))
      .map((f) => {
        const xml = fs.readFileSync(path.join(dir, f), 'utf8');
        return [attr(openTag(xml, 'http-page'), 'uid') || f, xml];
      }),
  );
  const containerFile = path.join(ROOT, `${step}.xml`);
  const recorded = fs.existsSync(containerFile) ? embeddedUids(fs.readFileSync(containerFile, 'utf8')) : [];
  const ordered = [...recorded.filter((u) => pageXml.has(u)), ...[...pageXml.keys()].filter((u) => !recorded.includes(u))];
  for (const xml of ordered.map((u) => pageXml.get(u))) {
    // NeoLoad bundles a page's whole resource burst as multiple <http-action> elements in one file — walk
    // every action, not just the first, or the bundled embedded resources are silently dropped from the tiers.
    const actions = xml.match(/<http-action\b[\s\S]*?<\/http-action>/g) || [];
    // each NeoLoad file is one <http-page>; keep its actions grouped as a page so the replay can fire one
    // http.batch per page (parallel within, pages sequential) matching NeoLoad's execution model
    const pageChrome = [];
    const pageStat = [];
    const pageTransport = [];
    for (const action of actions) {
      // honor NeoLoad's own enable flag — enabled="false" is a dynamic resource the recording explicitly
      // suppressed (the "disable dynamic resources" action), so the load test never fired it; emitting it
      // would re-introduce a request NeoLoad dropped (and these bundled assets 404 on the current build)
      if ((action.match(/\benabled="([^"]+)"/) || [])[1] === 'false') continue;
      const method = (action.match(/method="([^"]+)"/) || [])[1] || 'GET';
      // version segment stripped, empty segments collapsed (a blank theme token → themes//snug.css), and the
      // query recovered from NeoLoad <parameter> elements with ${...} tokens kept for runtime substitution
      const { bare, url, params } = tierPath(action);
      if (!bare) continue;
      if (SPINE.some((s) => bare.startsWith(s))) {
        excluded.push({ stepNo, bare, why: 'global SPINE' });
        continue;
      }
      if (DEAD.some((s) => bare.startsWith(s))) continue;
      const journeySpine = JOURNEY_SPINE[journey] || {};
      const journeyKey = Object.keys(journeySpine).find((p) => bare.startsWith(p));
      if (journeyKey && journeySpine[journeyKey].includes(stepNo)) {
        excluded.push({ stepNo, bare, why: 'JOURNEY_SPINE' });
        continue;
      }

      // NeoLoad stores large bodies Base64-encoded; decoded so the real JSON (with ${...} tokens) is emitted
      const body = tierBody(action);
      const strippedBody = (body || '').replace(/\s/g, '');
      const scriptedRequest = (JOURNEY_SPINE_REQUESTS[journey] || []).find(
        (r) =>
          r.step === stepNo &&
          bare.startsWith(r.path) &&
          (!r.body || strippedBody.startsWith(r.body)) &&
          (!r.query || url.includes(r.query)) &&
          (r.max === undefined || (requestMatches.get(r) || 0) < r.max),
      );
      if (scriptedRequest) {
        requestMatches.set(scriptedRequest, (requestMatches.get(scriptedRequest) || 0) + 1);
        excluded.push({ stepNo, bare: url, why: 'JOURNEY_SPINE_REQUESTS' });
        continue;
      }

      if (bare.includes('/app/') || STATIC_EXT.test(bare)) {
        pageStat.push({ path: bare });
      } else if (bare.includes('/api/')) {
        const req = { method, path: url };
        if (method !== 'GET' && body !== undefined) req.body = body;
        const gated = Object.keys(VERSION_GATED).find((p) => bare.startsWith(p));
        if (gated) req.removedIn = VERSION_GATED[gated];
        pageChrome.push(req);
      } else {
        // the paramless app85.cshtml bootstrap is scripted as the fetch_bundle_versions wrapper (it correlates
        // the bundle-version tokens the other transport requests consume) — exclude here to avoid double-firing
        if (bare.endsWith('app85.cshtml') && !params.length) continue;
        // neither /api/ nor a static asset (SignalR start, SSO cshtml, …) — the transport tier, fired at
        // FIDELITY=full so a full run reproduces every request the recording made
        const req = { method, path: url };
        if (method !== 'GET' && body !== undefined) req.body = body;
        pageTransport.push(req);
      }
    }
    if (pageChrome.length) (chrome[stepNo] = chrome[stepNo] || []).push(pageChrome);
    if (pageStat.length) (stat[stepNo] = stat[stepNo] || []).push(pageStat);
    if (pageTransport.length) (transport[stepNo] = transport[stepNo] || []).push(pageTransport);
  }
}

const tokenBanner = (kind) =>
  `/* eslint-disable no-template-curly-in-string */\n/* Generated by .claude/scripts/gen-fidelity-lists.cjs from the ${journey} NeoLoad tree — do not hand-edit.\n   Regenerate after re-recording. ${kind} requests fired behind -e FIDELITY.\n   The \${...} tokens are correlation placeholders substituted at fire time. */`;

for (const out of [chromeOut, staticOut, transportOut]) fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  chromeOut,
  `${tokenBanner('Tier-2 (UI chrome)')}\nimport { ChromeRequest } from '../../utils/exports/types.exp.ts';\n\nexport const ${chromeVar}: { [step: string]: ChromeRequest[][] } = ${JSON.stringify(chrome, null, 2)};\n`,
);
fs.writeFileSync(
  staticOut,
  `/* Generated by .claude/scripts/gen-fidelity-lists.cjs — tier-3 static content fired behind -e FIDELITY=full. */\nimport { StaticRequest } from '../../utils/exports/types.exp.ts';\n\nexport const ${staticVar}: { [step: string]: StaticRequest[][] } = ${JSON.stringify(stat, null, 2)};\n`,
);
fs.writeFileSync(
  transportOut,
  `${tokenBanner('Transport (non-api/non-static)')}\nimport { ChromeRequest } from '../../utils/exports/types.exp.ts';\n\nexport const ${transportVar}: { [step: string]: ChromeRequest[][] } = ${JSON.stringify(transport, null, 2)};\n`,
);

const reqCount = (o) => Object.values(o).reduce((a, pages) => a + pages.reduce((b, p) => b + p.length, 0), 0);
const pageCount = (o) => Object.values(o).reduce((a, pages) => a + pages.length, 0);
console.log(
  `chrome: ${reqCount(chrome)} requests in ${pageCount(chrome)} pages across ${Object.keys(chrome).length} steps -> ${chromeOut}`,
);
console.log(`static: ${reqCount(stat)} requests in ${pageCount(stat)} pages across ${Object.keys(stat).length} steps -> ${staticOut}`);
console.log(
  `transport: ${reqCount(transport)} requests in ${pageCount(transport)} pages across ${Object.keys(transport).length} steps -> ${transportOut}`,
);
console.log(`excluded as scripted (${excluded.length}) — each must be fired by a wrapper in its step, or it fires at no tier:`);
for (const e of excluded) console.log(`  ${e.stepNo}  ${e.bare.slice(0, 110)}  [${e.why}]`);
