import { check, group, fail } from 'k6';
import { login_to_events } from './login.flow.ts';
import {
  search_events,
  open_copy_form,
  save_event_copy,
  open_event_detail,
  get_window_version,
  signalr_negotiate,
} from '../utils/exports/apis.exp.ts';
import {
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
  fetch_bundle_versions,
  think,
  sign_out,
} from '../utils/exports/helpers.exp.ts';
import { copyEventChrome, copyEventStatic, copyEventTransport } from '../utils/exports/data.exp.ts';
import { User, SetupData, EventRow, FidelityLevel } from '../utils/exports/types.exp.ts';

const SOURCE_EVENT = __ENV.SOURCE_EVENT || 'Manual Test Event 1';
const COPY_WINDOW_ID = 'EB2212';

export const copyEventThresholds = {
  'http_req_duration{name:SearchEvents}': ['p(95)<3000'],
  'http_req_duration{name:OpenCopyForm}': ['p(95)<5000'],
  'http_req_duration{name:SaveEventCopy}': ['p(95)<5000'],
  'http_req_duration{name:OpenEventDetail}': ['p(95)<5000'],
};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, copyEventChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(copyEventStatic[step] ?? []);
      fire_transport(token, version, copyEventTransport[step] ?? [], subs);
    }
  }
}

export function copy_event_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const runToken = crypto.randomUUID().split('-')[0];
  const newDescription = `Manual Event Perf Test - ${runToken}`;

  const subs: Subs = {
    'C_USI_Version': data.version,
    'P_26_2_CopyEvents.eventName': SOURCE_EVENT,
  };

  group('T004_CopyEvent_01_Launch', () => {
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
      subs.P_EpochTimestamp = String(Date.now());
    }
    chrome_and_static('', data.version, level, ['01'], subs);
  });
  think();

  const { bearerToken, encUserId } = login_to_events(user, data.version, 'T004_CopyEvent_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T004_CopyEvent_03_ClickEventsTab', () => {
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  let sourceRef: EventRow | null = null;
  group('T004_CopyEvent_04_SearchEvent', () => {
    const rows = search_events(bearerToken, data.version, SOURCE_EVENT);
    const found = rows.find((r) => r.desc === SOURCE_EVENT && !!r.evtId) || null;
    sourceRef = found;
    check(null, { 'Source event found': () => Boolean(found) });
    if (found) {
      subs.C_CUST_NBR = found.acct;
      subs.C_EVT_ID = String(found.evtId);
    }
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
  });
  if (!sourceRef) fail('source event not found');
  const source = sourceRef;
  think();

  group('T004_CopyEvent_05_CopyEvent', () => {
    open_copy_form(bearerToken, data.version, encUserId, source);
    if (include_ui(level)) subs.C_Version = get_window_version(bearerToken, data.version, COPY_WINDOW_ID, 'CopyWindowInfo');
    subs.C_RefreshDependentKey = String(Date.now());
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  think();

  group('T004_CopyEvent_06_ClickSave', () => {
    const newEvtId = save_event_copy(bearerToken, data.version, encUserId, source, newDescription);
    console.log(`[VU ${__VU}] Created event ${newEvtId} — ${newDescription}`);
    subs.C_Updated_EventId = newEvtId;
    subs.C_ClickCopy_Timestamp1 = String(Date.now());
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
    open_event_detail(bearerToken, data.version, newEvtId, newDescription);
  });
  think();

  group('T004_CopyEvent_07_ClickSaveAgain', () => {
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();

  group('T004_CopyEvent_08_SignOut', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();
}
