import { group, sleep } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import { open_service_order_copy_form, save_service_order_copy, search_events } from '../utils/exports/apis.exp.ts';
import {
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  think,
  major_minor,
} from '../utils/exports/helpers.exp.ts';
import { copyServiceOrdersChrome, copyServiceOrdersStatic } from '../utils/exports/data.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { User, ServiceOrderSetup, ServiceOrderRow, EventRow, FidelityLevel } from '../utils/exports/types.exp.ts';

const COPY_COUNT = Number(__ENV.COPY_COUNT || 2);

export const copyServiceOrdersThresholds = {
  'http_req_duration{name:OpenCopyServiceOrdersForm}': ['p(95)<5000'],
  'http_req_duration{name:SaveServiceOrderCopy}': ['p(95)<5000'],
};

type Subs = { [token: string]: string };

function pick_orders(pool: ServiceOrderRow[], anchor: ServiceOrderRow, count: number): ServiceOrderRow[] {
  const sameFunc = pool.filter((o) => o.evtId === anchor.evtId && o.funcId === anchor.funcId);
  return sameFunc.slice(0, count).length ? sameFunc.slice(0, count) : [anchor];
}

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, copyServiceOrdersChrome[step] ?? [], subs);
    if (include_static(level)) fire_static_assets(copyServiceOrdersStatic[step] ?? []);
  }
}

export function copy_service_orders_journey(user: User, data: ServiceOrderSetup) {
  const level = fidelity_level();
  const { bearerToken, encUserId } = login_to_events(user, data.version);

  /* Copy is an insert (new orders), so iterations may share source rows; anchor on one seeded row
     per iteration and copy the orders that share its event+function so the single-context FuncID/EvtID
     is valid for the whole selection. */
  const anchor = data.soPool[exec.scenario.iterationInTest % data.soPool.length];
  const orders = pick_orders(data.soPool, anchor, COPY_COUNT);
  const refreshKey = Date.now();

  const subs: Subs = {
    C_USI_Version: data.version,
    C_EnterpriseVersion: major_minor(data.version),
    C_UserId: bearerToken.split('|')[0],
    C_EncID: encUserId,
    C_RefreshDependentKey: String(refreshKey),
    C_Event_EVT_ID: String(anchor.evtId),
    C_Event_CUST_NBR: anchor.ordAcct,
    C_SO_ORD_ACCT_REP: anchor.salesPer,
    C_SO_PRICE_LIST: anchor.priceList,
    P_SelectedOrderIds: orders.map((o) => o.orderNbr).join(','),
    P_SelectedOrderIds_Prefixed: orders.map((o) => `${o.orgCode}|${o.orderNbr}`).join(','),
  };
  chrome_and_static(bearerToken, data.version, level, ['01', '02', '03'], subs);
  think(2);

  if (include_ui(level)) {
    const event: EventRow | undefined = search_events(bearerToken, data.version, config.seedEventDesc, 'DiscoverCopyEvent').find(
      (e) => String(e.evtId) === String(anchor.evtId),
    );
    if (event) {
      subs.C_Event_cROW_KEY = event.rowKey;
      subs['P_26_2_CopyServiceOrders.eventName'] = event.desc;
    }
  }
  chrome_and_static(bearerToken, data.version, level, ['04', '05'], subs);
  think(3);

  group('3. Open Copy Order(s) Form', () => {
    open_service_order_copy_form(bearerToken, data.version, encUserId, orders, refreshKey);
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think(3);

  group('4. Save Service Order Copy', () => {
    const added = save_service_order_copy(bearerToken, data.version, encUserId, orders, refreshKey);
    console.log(`[VU ${__VU}] Copied ${orders.length} service order(s) → ${added.length} new order(s)`);
  });

  sleep(1);
}
