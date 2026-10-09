import { group, check, fail } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  get_contact_column_stamp,
  open_payment_plan_orders_list,
  open_payment_plan_orders_grid,
  open_payment_plan_orders_search,
  search_payment_plan_events,
  save_payment_plan_recent_event,
  handle_payment_plan_event_fields,
  read_payment_plan_orders,
  get_payment_plan_order_control_info,
  open_payment_plan_order,
  access_payment_plan_order,
  open_payment_plan_form,
  search_payment_plan_schedule,
  handle_payment_plan_fields,
  save_payment_plan,
  open_payment_plan,
  open_payment_plan_steps_grid,
  open_payment_plan_steps_search,
  read_payment_plan_steps,
  open_payment_plan_invoice_dialog,
  handle_payment_plan_invoice_fields,
  save_payment_plan_invoice,
  open_payment_plan_orders_filtered_list,
  open_payment_plan_orders_filtered_grid,
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
  get_cell,
  sign_out,
  seed_gap_message,
} from '../utils/exports/helpers.exp.ts';
import { paymentPlanChrome, paymentPlanStatic, paymentPlanTransport } from '../utils/exports/data.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { User, PaymentPlanSetup, PaymentPlanEvent, PaymentPlanOrderRow, FidelityLevel } from '../utils/exports/types.exp.ts';

export const paymentPlanThresholds = {
  'http_req_duration{name:OpenPaymentPlanOrdersList}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanOrdersGrid}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanOrdersSearch}': ['avg<4000'],
  'http_req_duration{name:SearchPaymentPlanEvents}': ['avg<4000'],
  'http_req_duration{name:SavePaymentPlanRecentEvent}': ['avg<4000'],
  'http_req_duration{name:HandlePaymentPlanEventFields}': ['avg<4000'],
  'http_req_duration{name:ReadPaymentPlanOrders}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanOrder}': ['avg<4000'],
  'http_req_duration{name:AccessPaymentPlanOrder}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanForm}': ['avg<4000'],
  'http_req_duration{name:SearchPaymentPlanSchedule}': ['avg<4000'],
  'http_req_duration{name:HandlePaymentPlanFields}': ['avg<4000'],
  'http_req_duration{name:SavePaymentPlan}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlan}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanStepsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanStepsSearch}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanInvoiceDialog}': ['avg<4000'],
  'http_req_duration{name:HandlePaymentPlanInvoiceFields}': ['avg<4000'],
  'http_req_duration{name:SavePaymentPlanInvoice}': ['avg<4000'],
  'http_req_duration{name:ReadPaymentPlanSteps}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanOrdersFilteredList}': ['avg<4000'],
  'http_req_duration{name:OpenPaymentPlanOrdersFilteredGrid}': ['avg<4000'],
  'http_req_duration{name:ReopenPaymentPlanOrder}': ['avg<4000'],
};

type Subs = { [token: string]: string };

const POOL_EVENTS = Number(__ENV.POOL_EVENTS || 100);

function is_unplanned(row: PaymentPlanOrderRow) {
  return get_cell(row.table, 'ER100_PAY_PLAN_ID') === '0';
}

export function find_unplanned_payment_plan_events(
  bearerToken: string,
  version: string,
  prefix: string,
  tags: { events: string; orders: string },
  limit = Infinity,
) {
  const unplanned: PaymentPlanEvent[] = [];
  for (const event of search_payment_plan_events(bearerToken, version, prefix, tags.events)) {
    if (unplanned.length >= limit) break;
    if (read_payment_plan_orders(bearerToken, version, event.key, tags.orders).some(is_unplanned)) unplanned.push(event);
  }
  return unplanned;
}

export function discover_payment_plan_pool(version: string, user: User) {
  const { bearerToken } = login_to_events(user, version);
  const prefix = config.seedPaymentPlanPrefix;
  const pool = find_unplanned_payment_plan_events(
    bearerToken,
    version,
    prefix,
    { events: 'DiscoverPaymentPlanEvents', orders: 'DiscoverPaymentPlanOrders' },
    POOL_EVENTS,
  );
  console.log(`"${prefix}" events: ${pool.length} without a payment plan found`);
  if (pool.length === 0) {
    throw new Error(seed_gap_message('payment_plan', `no service order without a payment plan under "${prefix}" events`));
  }
  return pool;
}

const SERVICE_ORDER_OBJECT_ID = 4;
const PAYMENT_PLAN_OBJECT_ID = 229;

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, paymentPlanChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(paymentPlanStatic[step] ?? []);
      fire_transport(token, version, paymentPlanTransport[step] ?? [], subs);
    }
  }
}

export function payment_plan_journey(user: User, data: PaymentPlanSetup) {
  const level = fidelity_level();
  const subs: Subs = {};
  const iter = exec.scenario.iterationInTest;

  group('T011_PaymentPlan_01_Launch', () => {
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

  const { bearerToken } = login_to_events(user, data.version, 'T011_PaymentPlan_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T011_PaymentPlan_03_ClickServiceOrderTab', () => {
    if (include_ui(level)) {
      subs.C_ClickServiceOrderTab_Timestamp1 = get_contact_column_stamp(
        bearerToken,
        data.version,
        SERVICE_ORDER_OBJECT_ID,
        'GetPaymentPlanServiceOrderObjectColumns',
      );
    }
    open_payment_plan_orders_list(bearerToken, data.version);
    open_payment_plan_orders_grid(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  const { eventKey, order } = group('T011_PaymentPlan_04_SearchSO', () => {
    open_payment_plan_orders_search(bearerToken, data.version);
    const picked = data.planPool[iter % data.planPool.length];
    const hit = search_payment_plan_events(bearerToken, data.version, picked.desc).find((e) => e.desc === picked.desc);
    check(hit, { 'Payment plan event found by exact name': (e) => e !== undefined });
    if (!hit) fail(`event "${picked.desc}" not returned by its exact-name search`);
    const key = hit.key;
    subs.C_SearchSO_Key = key;
    save_payment_plan_recent_event(bearerToken, data.version, key);
    handle_payment_plan_event_fields(bearerToken, data.version, key);
    const row = read_payment_plan_orders(bearerToken, data.version, key).find(is_unplanned);
    if (!row) fail(seed_gap_message('payment_plan', `event ${key} has no service order without a payment plan`));
    subs.C_OrderNbr = row.orderNbr;
    if (include_ui(level)) get_payment_plan_order_control_info(bearerToken, data.version, row);
    open_payment_plan_order(bearerToken, data.version, row);
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
    return { eventKey: key, order: row };
  });
  think();

  const planForm = group('T011_PaymentPlan_05_ClickPaymentPlan', () => {
    access_payment_plan_order(bearerToken, data.version, order);
    const form = open_payment_plan_form(bearerToken, data.version, order.orderNbr);
    if (include_ui(level)) {
      subs.C_ClickPaymentPlan_Timestamp1 = get_contact_column_stamp(
        bearerToken,
        data.version,
        PAYMENT_PLAN_OBJECT_ID,
        'GetPaymentPlanObjectColumns',
      );
    }
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
    return form;
  });
  think();

  const payPlanId = group('T011_PaymentPlan_06_SelectSchedule', () => {
    search_payment_plan_schedule(bearerToken, data.version);
    const table = handle_payment_plan_fields(bearerToken, data.version, order.orderNbr, order.billTo, planForm);
    const id = save_payment_plan(bearerToken, data.version, order.orderNbr, table);
    subs.C_PayPlanID = id;
    open_payment_plan(bearerToken, data.version, order.orderNbr, id);
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
    return id;
  });
  think();

  const refreshKey = Date.now();
  const dialog = group('T011_PaymentPlan_07_ClickInvoice', () => {
    open_payment_plan_steps_grid(bearerToken, data.version, order.orderNbr, payPlanId);
    open_payment_plan_steps_search(bearerToken, data.version, order.orderNbr, payPlanId);
    const table = open_payment_plan_invoice_dialog(bearerToken, data.version, payPlanId, refreshKey);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
    return table;
  });
  think();

  group('T011_PaymentPlan_08_ClickInvoiceOK', () => {
    const table = handle_payment_plan_invoice_fields(bearerToken, data.version, payPlanId, refreshKey, dialog);
    save_payment_plan_invoice(bearerToken, data.version, payPlanId, refreshKey, table);
    read_payment_plan_steps(bearerToken, data.version, order.orderNbr, payPlanId);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();

  group('T011_PaymentPlan_09_ClickPaymentPlanSave', () => {
    open_payment_plan_orders_filtered_list(bearerToken, data.version, eventKey);
    open_payment_plan_orders_filtered_grid(bearerToken, data.version, eventKey);
    open_payment_plan_order(bearerToken, data.version, order, 'ReopenPaymentPlanOrder');
    chrome_and_static(bearerToken, data.version, level, ['09'], subs);
  });
  think();

  group('T011_PaymentPlan_10_Logout', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['10'], subs);
  });
  think();
}
