import { group } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  open_service_order_copy_form,
  save_service_order_copy,
  search_events,
  load_service_orders,
  signalr_negotiate,
  get_service_order_control_info,
  read_event_service_orders_grid,
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
  major_minor,
  format_retrieve_stamp,
} from '../utils/exports/helpers.exp.ts';
import { copyServiceOrdersChrome, copyServiceOrdersStatic, copyServiceOrdersTransport } from '../utils/exports/data.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { User, ServiceOrderSetup, ServiceOrderRow, PooledServiceOrder, EventRow, FidelityLevel } from '../utils/exports/types.exp.ts';

const POOL_EVENTS = Number(__ENV.POOL_EVENTS || 50);

function interleave(lists: PooledServiceOrder[][]) {
  const longest = Math.max(0, ...lists.map((l) => l.length));
  const out: PooledServiceOrder[] = [];
  for (let i = 0; i < longest; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

export function discover_service_order_pool(version: string, user: User) {
  const { bearerToken } = login_to_events(user, version);
  const prefix = config.seedEventPrefix;

  const seeded = search_events(bearerToken, version, prefix, 'DiscoverSeedEvent').filter((e) => e.desc.startsWith(prefix));
  const events = shuffle(seeded).slice(0, POOL_EVENTS);
  const pool = interleave(events.map((e) => load_service_orders(bearerToken, version, e).map((o) => ({ ...o, evtDesc: e.desc }))));
  console.log(`"${prefix}" events: ${seeded.length} found, ${events.length} sampled, ${pool.length} service order(s)`);
  if (pool.length === 0) {
    throw new Error(`no service orders under "${prefix}" events — run source/seeds/service-orders.seed.ts after the snapshot reset`);
  }
  return pool;
}

const COPY_COUNT_OVERRIDE = __ENV.COPY_COUNT ? Number(__ENV.COPY_COUNT) : undefined;
/* NeoLoad's recorded T34 event carried ~10 service orders (SO grid ResultsCount 10) and the copy selects a
   random 1..N of them. The shared seed pool is sized for the other journeys and may exceed that, so cap the
   random upper bound here to a realistic per-event size rather than the whole pool. */
const NEOLOAD_EVENT_SO_COUNT = 10;

export const copyServiceOrdersThresholds = {
  'http_req_duration{name:OpenCopyServiceOrdersForm}': ['avg<4000'],
  'http_req_duration{name:SaveServiceOrderCopy}': ['avg<4000'],
};

type Subs = { [token: string]: string };

function shuffle<T>(rows: T[]): T[] {
  const a = rows.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/* Port of NeoLoad JS_Select_ServiceOrders: copy a random 1..N of the event's service orders, where N is the
   orders under the anchor's event+function capped at NEOLOAD_EVENT_SO_COUNT (the single FuncID/EvtID context
   must stay valid for the whole selection). The anchor stays orders[0] as the copy template; the rest are a
   random sample. Setting -e COPY_COUNT pins the count for deterministic debug runs. */
function pick_orders(pool: ServiceOrderRow[], anchor: ServiceOrderRow, override?: number): ServiceOrderRow[] {
  const sameFunc = pool.filter((o) => o.evtId === anchor.evtId && o.funcId === anchor.funcId);
  if (sameFunc.length === 0) return [anchor];
  const upper = Math.min(sameFunc.length, NEOLOAD_EVENT_SO_COUNT);
  const count = Math.min(override ?? 1 + Math.floor(Math.random() * upper), sameFunc.length);
  const others = shuffle(sameFunc.filter((o) => o.orderNbr !== anchor.orderNbr));
  return [anchor, ...others].slice(0, count);
}

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, copyServiceOrdersChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(copyServiceOrdersStatic[step] ?? []);
      fire_transport(token, version, copyServiceOrdersTransport[step] ?? [], subs);
    }
  }
}

export function copy_service_orders_journey(user: User, data: ServiceOrderSetup) {
  const level = fidelity_level();

  /* Copy is an insert (new orders), so iterations may share source rows; anchor on one seeded row
     per iteration and copy the orders that share its event+function so the single-context FuncID/EvtID
     is valid for the whole selection. */
  const anchor = data.soPool[exec.scenario.iterationInTest % data.soPool.length];
  const orders = pick_orders(data.soPool, anchor, COPY_COUNT_OVERRIDE);
  const refreshKey = Date.now();

  const subs: Subs = {
    C_USI_Version: data.version,
    C_EnterpriseVersion: major_minor(data.version),
    C_RefreshDependentKey: String(refreshKey),
    P_FormattedTimestamp: format_retrieve_stamp(String(refreshKey)),
    C_Event_EVT_ID: String(anchor.evtId),
    C_Event_CUST_NBR: anchor.ordAcct,
    C_SO_ORD_ACCT_REP: anchor.salesPer,
    C_SO_PRICE_LIST: anchor.priceList,
    P_SelectedOrderIds: orders.map((o) => o.orderNbr).join(','),
    P_SelectedOrderIds_Prefixed: orders.map((o) => `${o.orgCode}|${o.orderNbr}`).join(','),
  };

  group('T34_CopyServiceOrders_01_Launch', () => {
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

  const { bearerToken, encUserId } = login_to_events(user, data.version, 'T34_CopyServiceOrders_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T34_CopyServiceOrders_03_ClickOnEventsTab', () => {
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  let eventRowKey = '';
  group('T34_CopyServiceOrders_04_SearchEvent', () => {
    if (include_ui(level)) {
      const event: EventRow | undefined = search_events(bearerToken, data.version, anchor.evtDesc, 'DiscoverCopyEvent').find(
        (e) => String(e.evtId) === String(anchor.evtId),
      );
      if (event) {
        eventRowKey = event.rowKey;
        subs.C_Event_cROW_KEY = event.rowKey;
        subs['P_26_2_CopyServiceOrders.eventName'] = event.desc;
      }
    }
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
  });
  think();

  group('T34_CopyServiceOrders_05_ClickServiceOrdersSection', () => {
    if (include_ui(level)) get_service_order_control_info(bearerToken, data.version, orders[0], eventRowKey);
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  think();

  group('T34_CopyServiceOrders_06_SelectAndCopyServiceOrders', () => {
    if (include_ui(level) && orders[1]) get_service_order_control_info(bearerToken, data.version, orders[1], eventRowKey);
    open_service_order_copy_form(bearerToken, data.version, encUserId, orders, refreshKey);
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  group('T34_CopyServiceOrders_07_SelectFunctionAndSave', () => {
    const added = save_service_order_copy(bearerToken, data.version, encUserId, orders, refreshKey);
    console.log(`[VU ${__VU}] Copied ${orders.length} service order(s) → ${added.length} new order(s)`);
    if (include_ui(level)) read_event_service_orders_grid(bearerToken, data.version, anchor, eventRowKey);
  });
  think();

  group('T34_CopyServiceOrders_08_LogOut', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();
}
