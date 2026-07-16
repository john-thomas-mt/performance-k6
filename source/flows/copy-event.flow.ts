import { check, group, fail } from 'k6';
import { login_to_events } from './login.flow.ts';
import { search_events, open_copy_form, save_event_copy, open_event_detail, get_window_version } from '../utils/exports/apis.exp.ts';
import { fidelity_level, include_ui, include_static, fire_ui_chrome, fire_static_assets, think } from '../utils/exports/helpers.exp.ts';
import { copyEventChrome, copyEventStatic } from '../utils/exports/data.exp.ts';
import { User, SetupData, EventRow, FidelityLevel } from '../utils/exports/types.exp.ts';

const SOURCE_EVENT = __ENV.SOURCE_EVENT || 'Manual Test Event 1';
const COPY_WINDOW_ID = 'EB2212';

export const copyEventThresholds = {
  'http_req_duration{name:SearchEvents}': ['p(95)<3000'],
  'http_req_duration{name:OpenCopyForm}': ['p(95)<5000'],
  'http_req_duration{name:SaveEventCopy}': ['p(95)<5000'],
  'http_req_duration{name:SearchNewEvent}': ['p(95)<3000'],
  'http_req_duration{name:OpenEventDetail}': ['p(95)<5000'],
};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, copyEventChrome[step] ?? [], subs);
    if (include_static(level)) fire_static_assets(copyEventStatic[step] ?? []);
  }
}

export function copy_event_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const runToken = crypto.randomUUID().split('-')[0];
  const newDescription = `Manual Event Perf Test - ${runToken}`;

  const { bearerToken, encUserId } = login_to_events(user, data.version);

  const subs: Subs = {
    'C_USI_Version': data.version,
    'C_EncID': encUserId,
    'C_UserId': bearerToken.split('|')[0],
    'P_26_2_CopyEvents.eventName': SOURCE_EVENT,
    'C_ClickCopy_Timestamp1': String(Date.now()),
    'C_RefreshDependentKey': String(Date.now()),
  };
  chrome_and_static(bearerToken, data.version, level, ['01', '02'], subs);
  think();

  let sourceRef: EventRow | null = null;
  group('3. Search Source Event', () => {
    const rows = search_events(bearerToken, data.version, SOURCE_EVENT);
    const found = rows.find((r) => r.desc === SOURCE_EVENT && !!r.evtId) || null;
    sourceRef = found;
    check(null, { 'Source event found': () => Boolean(found) });
    if (found) {
      subs.C_CUST_NBR = found.acct;
      subs.C_EVT_ID = String(found.evtId);
    }
    chrome_and_static(bearerToken, data.version, level, ['03', '04'], subs);
  });
  if (!sourceRef) fail('source event not found');
  const source = sourceRef;
  think();

  group('4. Open Copy Event Form', () => {
    open_copy_form(bearerToken, data.version, encUserId, source);
    if (include_ui(level)) subs.C_Version = get_window_version(bearerToken, data.version, COPY_WINDOW_ID, 'CopyWindowInfo');
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  think();

  let newEvtIdRef: string | null = null;
  group('5. Save Event Copy', () => {
    newEvtIdRef = save_event_copy(bearerToken, data.version, encUserId, source, newDescription);
    console.log(`[VU ${__VU}] Created event ${newEvtIdRef} — ${newDescription}`);
    subs.C_Updated_EventId = newEvtIdRef;
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  const newEvtId = newEvtIdRef!;
  think();

  group('6. Confirm New Event in List', () => {
    const rows = search_events(bearerToken, data.version, newDescription, 'SearchNewEvent');
    const match = rows.find((r) => r.desc === newDescription);
    check(null, {
      'New event appears in search': () => Boolean(match),
      'New event id matches saved id': () => Boolean(match && String(match.evtId) === String(newEvtId)),
    });
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();

  group('7. Open New Event & Verify Details', () => {
    open_event_detail(bearerToken, data.version, newEvtId, newDescription);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });

  think();
}
