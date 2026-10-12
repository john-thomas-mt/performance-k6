import exec from 'k6/execution';
import { group, check, fail } from 'k6';
import {
  signalr_negotiate,
  search_events,
  searchEventsThresholds,
  get_event_control_info,
  open_events_grid,
  open_event_detail_from_row,
  read_event_functions_grid,
  open_paste_functions_form,
  paste_event_functions,
  read_event_detail_data,
  read_event_functions_after_paste,
  open_events_filtered_list,
  open_events_filtered_grid,
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
  format_retrieve_stamp,
  seed_gap_message,
} from '../utils/exports/helpers.exp.ts';
import { copyPasteEventFunctionChrome, copyPasteEventFunctionStatic, copyPasteEventFunctionTransport } from '../utils/exports/data.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { User, FidelityLevel, EventGridFunction, CopyPasteFunctionSetup } from '../utils/exports/types.exp.ts';
import { login_to_events } from './login.flow.ts';

const MIN_FUNCTIONS = 2;
const ALL_FUNCTIONS_CHANCE = 0.25;

export const copyPasteEventFunctionThresholds = {
  ...searchEventsThresholds,
  'http_req_duration{name:OpenEventsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenEventDetailFromRow}': ['avg<4000'],
  'http_req_duration{name:ReadEventFunctionsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenPasteFunctionsForm}': ['avg<4000'],
  'http_req_duration{name:SavePastedFunctions}': ['avg<4000'],
  'http_req_duration{name:ReadEventDetailData}': ['avg<4000'],
  'http_req_duration{name:ReadEventFunctionsAfterPaste}': ['avg<4000'],
  'http_req_duration{name:OpenEventsFilteredList}': ['avg<4000'],
  'http_req_duration{name:OpenEventsFilteredGrid}': ['avg<4000'],
};

export function discover_copy_paste_function_pool(version: string, user: User) {
  const { bearerToken } = login_to_events(user, version);
  const prefix = config.seedCopyPasteFunctionPrefix;
  const pool = search_events(bearerToken, version, prefix, 'DiscoverCopyPasteFunctionEvent')
    .filter((e) => e.desc.startsWith(prefix))
    .sort((a, b) => Number(b.evtId) - Number(a.evtId));
  console.log(`"${prefix}" events: ${pool.length} found`);
  if (pool.length === 0) throw new Error(seed_gap_message('copy_paste_event_function', `no events under "${prefix}"`));
  return pool;
}

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, copyPasteEventFunctionChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(copyPasteEventFunctionStatic[step] ?? []);
      fire_transport(token, version, copyPasteEventFunctionTransport[step] ?? [], subs);
    }
  }
}

function select_functions(functions: EventGridFunction[]) {
  const ids = functions
    .filter((f) => f.desc.includes(`${config.seedCopyPasteFunctionDescPrefix}-`) && f.funcId !== '')
    .map((f) => f.funcId);
  let selected = ids;
  if (ids.length > MIN_FUNCTIONS && Math.random() >= ALL_FUNCTIONS_CHANCE) {
    const count = MIN_FUNCTIONS + Math.floor(Math.random() * (ids.length - MIN_FUNCTIONS + 1));
    const shuffled = ids.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    selected = shuffled.slice(0, count);
  }
  return selected.sort((a, b) => Number(a) - Number(b)).join(',');
}

export function copy_paste_event_function_journey(user: User, data: CopyPasteFunctionSetup) {
  const level = fidelity_level();
  const picked = data.copyPastePool[exec.scenario.iterationInTest % data.copyPastePool.length];
  console.log(`[VU ${__VU}] iteration ${exec.scenario.iterationInTest} pastes into event ${picked.evtId} "${picked.desc}"`);
  const subs: Subs = { C_USI_Version: data.version };

  const refresh = () => {
    const key = Date.now();
    subs.P_EpochTimestamp = String(key);
    subs.P_FormattedTimestamp = format_retrieve_stamp(String(key));
    return key;
  };

  group('T016_CopyPasteEventFunction_01_Launch', () => {
    refresh();
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
    }
    chrome_and_static('', data.version, level, ['01'], subs);
  });
  think();

  const { bearerToken } = login_to_events(user, data.version, 'T016_CopyPasteEventFunction_02_Login', (token, encUserId, ssoToken) => {
    refresh();
    subs.C_UserId = token.split('|')[0];
    subs.C_TokenID = ssoToken;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T016_CopyPasteEventFunction_03_ClickEventsTab', () => {
    refresh();
    const rows = open_events_grid(bearerToken, data.version);
    if (include_ui(level)) {
      if (!check(null, { 'Events grid returned a first row': () => rows.length > 0 })) fail('events grid returned no rows');
      get_event_control_info(bearerToken, data.version, rows[0]);
    }
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  const { event, functions } = group('T016_CopyPasteEventFunction_04_SearchAndOpenEvent', () => {
    const key = refresh();
    const found = search_events(bearerToken, data.version, picked.desc).find((e) => e.desc === picked.desc);
    check(found, { 'Seeded event found by name': (e) => e !== undefined });
    if (!found) fail(`seeded event "${picked.desc}" not found by name`);
    subs.C_CUST_NBR = found.acct;
    subs.C_EVT_ID = found.evtId;
    subs.C_cROW_KEY = found.rowKey;
    subs.C_SearchedEvent = found.desc;
    open_event_detail_from_row(bearerToken, data.version, found, key);
    const rows = read_event_functions_grid(bearerToken, data.version, found, key);
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
    return { event: found, functions: rows };
  });
  think();

  const functionIds = select_functions(functions);
  if (functionIds === '') {
    check(null, { 'Event has seeded functions to paste': () => false });
    fail(
      seed_gap_message('copy_paste_event_function', `event "${event.desc}" has no "${config.seedCopyPasteFunctionDescPrefix}-" functions`),
    );
  }
  subs.P_SelectedNeoLoadFunctions = functionIds;

  const retrieveStamp = group('T016_CopyPasteEventFunction_05_CopyAndPasteFunctions', () => {
    const key = refresh();
    const stamp = open_paste_functions_form(bearerToken, data.version, event.evtId, functionIds, key);
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
    return stamp;
  });
  think();

  group('T016_CopyPasteEventFunction_06_SavePastedFunction', () => {
    const key = refresh();
    paste_event_functions(bearerToken, data.version, event, functionIds, retrieveStamp, key);
    read_event_detail_data(bearerToken, data.version, event, key);
    read_event_functions_after_paste(bearerToken, data.version, event, key);
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  group('T016_CopyPasteEventFunction_07_Save&CloseEvent', () => {
    refresh();
    open_events_filtered_list(bearerToken, data.version, event.desc);
    open_events_filtered_grid(bearerToken, data.version, event.desc);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();

  group('T016_CopyPasteEventFunction_08_Logout', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();
}
