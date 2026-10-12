import { group, check, fail } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  search_events,
  load_service_orders,
  signalr_negotiate,
  cache_document_file,
  open_payment_plan_orders_list,
  open_payment_plan_orders_grid,
  open_payment_plan_orders_search,
  search_payment_plan_events,
  save_payment_plan_recent_event,
  handle_payment_plan_event_fields,
  read_payment_plan_orders,
  open_payment_plan_orders_filtered_list,
  open_payment_plan_orders_filtered_grid,
  get_payment_plan_order_control_info,
  open_service_order_for_edit,
  refresh_service_order_edit_fields,
  save_service_order_header,
  read_service_order_data,
  open_service_order_lines_grid,
  open_service_order_lines_search,
  open_service_order_items_form,
  read_service_order_add_items,
  open_service_order_items_search,
  save_service_order_items,
  read_service_order_lines,
  reopen_service_order_after_items,
  open_service_order_documents_grid,
  open_service_order_documents_search,
  open_service_order_document_form,
  refresh_service_order_document_fields,
  save_service_order_document,
  read_service_order_documents,
  save_service_order_close,
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
  echo_cell,
} from '../utils/exports/helpers.exp.ts';
import { editServiceOrdersChrome, editServiceOrdersStatic, editServiceOrdersTransport } from '../utils/exports/data.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { EventRow, User, FidelityLevel, EditServiceOrderSetup, ServiceOrderDocumentFixture } from '../utils/exports/types.exp.ts';

export const editServiceOrdersThresholds = {
  'http_req_duration{name:OpenEditOrdersList}': ['avg<4000'],
  'http_req_duration{name:OpenEditOrdersGrid}': ['avg<4000'],
  'http_req_duration{name:OpenEditOrdersSearch}': ['avg<4000'],
  'http_req_duration{name:SearchEditOrderEvent}': ['avg<4000'],
  'http_req_duration{name:SaveEditOrderRecentEvent}': ['avg<4000'],
  'http_req_duration{name:HandleEditOrderEventFields}': ['avg<4000'],
  'http_req_duration{name:ReadEditOrderEventOrders}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderForEdit}': ['avg<4000'],
  'http_req_duration{name:HandleServiceOrderEditFields}': ['avg<4000'],
  'http_req_duration{name:SaveServiceOrderHeader}': ['avg<4000'],
  'http_req_duration{name:ReadServiceOrderData}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderLinesGrid}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderLinesSearch}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderItemsForm}': ['avg<4000'],
  'http_req_duration{name:ReadServiceOrderAddItems}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderItemsSearch}': ['avg<4000'],
  'http_req_duration{name:SaveServiceOrderItems}': ['avg<4000'],
  'http_req_duration{name:ReadServiceOrderLines}': ['avg<4000'],
  'http_req_duration{name:ReopenServiceOrderAfterItems}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderLinesGridAfterSave}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderLinesSearchAfterSave}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderDocumentsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderDocumentsSearch}': ['avg<4000'],
  'http_req_duration{name:CacheEditOrderDocument}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderDocumentForm}': ['avg<4000'],
  'http_req_duration{name:HandleServiceOrderDocumentFields}': ['avg<4000'],
  'http_req_duration{name:SaveServiceOrderDocument}': ['avg<4000'],
  'http_req_duration{name:ReadServiceOrderDocuments}': ['avg<4000'],
  'http_req_duration{name:SaveServiceOrderClose}': ['avg<4000'],
  'http_req_duration{name:OpenEditOrdersFilteredList}': ['avg<4000'],
  'http_req_duration{name:OpenEditOrdersFilteredGrid}': ['avg<4000'],
  'http_req_duration{name:GetEditOrderControlInfo}': ['avg<4000'],
};

type Subs = { [token: string]: string };

const POOL_EVENTS = Number(__ENV.POOL_EVENTS || 100);
const POOL_OFFSET = Number(__ENV.POOL_OFFSET || 0);
const ORDER_DATE_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;
const MAX_ITEM_QUANTITY = 5;
const ORDER_TOTAL_CONTROL_ID = 622;

export function find_events_with_service_orders(
  bearerToken: string,
  version: string,
  prefix: string,
  tags: { events: string; orders: string },
  limit = Infinity,
) {
  const withOrders: EventRow[] = [];
  const events = search_events(bearerToken, version, prefix, tags.events).filter((e) => e.desc.startsWith(prefix));
  for (const event of events) {
    if (withOrders.length >= limit) break;
    if (load_service_orders(bearerToken, version, event, tags.orders).length > 0) withOrders.push(event);
  }
  return withOrders;
}

export function discover_edit_service_order_pool(version: string, user: User) {
  const { bearerToken } = login_to_events(user, version);
  const prefix = config.seedEditServiceOrderPrefix;
  const pool = find_events_with_service_orders(
    bearerToken,
    version,
    prefix,
    { events: 'DiscoverEditServiceOrderEvents', orders: 'DiscoverEditServiceOrderOrders' },
    POOL_EVENTS,
  );
  console.log(`"${prefix}" events: ${pool.length} with a service order found`);
  if (pool.length === 0) {
    throw new Error(seed_gap_message('edit_service_orders', `no service order under "${prefix}" events`));
  }
  return pool;
}

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, editServiceOrdersChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(editServiceOrdersStatic[step] ?? []);
      fire_transport(token, version, editServiceOrdersTransport[step] ?? [], subs);
    }
  }
}

export function edit_service_orders_journey(user: User, data: EditServiceOrderSetup, document: ServiceOrderDocumentFixture) {
  const level = fidelity_level();
  const iter = exec.scenario.iterationInTest;
  const picked = data.editOrderPool[(POOL_OFFSET + iter) % data.editOrderPool.length];
  const orderDate = Date.now() + Math.floor(Math.random() * ORDER_DATE_WINDOW_MS);
  const quantity = 1 + Math.floor(Math.random() * MAX_ITEM_QUANTITY);
  const docDesc = `k6-t20-document-${__VU}${iter}${Date.now()}`;
  const wdwBase = 9000000 + iter * 10;
  const orderWdwid = `EM${wdwBase}`;
  const itemsWdwid = `EM${wdwBase + 1}`;
  const docWdwid = `AA${wdwBase + 2}`;
  const subs: Subs = {};
  const refresh = () => {
    const key = Date.now();
    subs.P_EpochTimestamp = String(key);
    subs.P_FormattedTimestamp = format_retrieve_stamp(String(key));
    return key;
  };

  group('T20_EditServiceOrders_01_Launch', () => {
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

  const { bearerToken } = login_to_events(user, data.version, 'T20_EditServiceOrders_02_Login', (token, enc, sso) => {
    refresh();
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T20_EditServiceOrders_03_ClickOnServiceOrdersTab', () => {
    refresh();
    open_payment_plan_orders_list(bearerToken, data.version, 'OpenEditOrdersList');
    open_payment_plan_orders_grid(bearerToken, data.version, 'OpenEditOrdersGrid');
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  const { event, order } = group('T20_EditServiceOrders_04_SearchEvent', () => {
    refresh();
    open_payment_plan_orders_search(bearerToken, data.version, 'OpenEditOrdersSearch');
    const hit = search_payment_plan_events(bearerToken, data.version, picked.desc, 'SearchEditOrderEvent').find(
      (e) => e.desc === picked.desc,
    );
    check(hit, { 'Seeded event found by exact name': (e) => e !== undefined });
    if (!hit) fail(`seeded event "${picked.desc}" not returned by its exact-name search`);
    subs.P_EventKey = hit.key;
    save_payment_plan_recent_event(bearerToken, data.version, hit.key, 'SaveEditOrderRecentEvent');
    handle_payment_plan_event_fields(bearerToken, data.version, hit.key, 'HandleEditOrderEventFields');
    const row = read_payment_plan_orders(bearerToken, data.version, hit.key, 'ReadEditOrderEventOrders')[0];
    if (!check(null, { 'Event has a service order': () => Boolean(row) })) {
      fail(seed_gap_message('edit_service_orders', `event ${hit.key} has no service order`));
    }
    subs.C_ORD_ACCT = row.ordAcct;
    subs.C_ORD_NBR = row.orderNbr;
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
    return { event: hit, order: row };
  });
  console.log(`[VU ${__VU}] iteration ${iter}: editing order ${order.orderNbr} of "${picked.desc}" (event ${event.key})`);
  think();

  const openedHeader = group('T20_EditServiceOrders_05_SelectEditServiceOrder', () => {
    const key = refresh();
    const header = open_service_order_for_edit(bearerToken, data.version, order, orderWdwid, key);
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
    return header;
  });
  think();

  group('T20_EditServiceOrders_06_Edit_General_RateAndOrderDate', () => {
    const key = refresh();
    refresh_service_order_edit_fields(bearerToken, data.version, order, picked.desc, openedHeader, orderWdwid, key);
    save_service_order_header(bearerToken, data.version, order, picked.desc, openedHeader, orderDate, orderWdwid, key);
    read_service_order_data(bearerToken, data.version, order, orderWdwid, key);
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  const { form, items } = group('T20_EditServiceOrders_07_Edit_ServiceOrderItems_AddItems', () => {
    const key = refresh();
    open_service_order_lines_grid(bearerToken, data.version, order, orderWdwid, key);
    open_service_order_lines_search(bearerToken, data.version, order, orderWdwid, key);
    const itemsForm = open_service_order_items_form(bearerToken, data.version, order, itemsWdwid, key);
    subs.C_StartDate = itemsForm.startDate;
    subs.C_EndDate = itemsForm.endDate;
    const grid = read_service_order_add_items(bearerToken, data.version, order, itemsForm.startDate, itemsForm.endDate, itemsWdwid, key);
    open_service_order_items_search(bearerToken, data.version, order, itemsForm.startDate, itemsForm.endDate, itemsWdwid, key);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
    return { form: itemsForm, items: grid };
  });
  think();

  const reopenedHeader = group('T20_EditServiceOrders_08_Edit_ServiceOrderItems_SelectUnitsAndSave', () => {
    const key = refresh();
    const chosen = { ...items, TransportDataRows: [items.TransportDataRows[Math.floor(Math.random() * items.TransportDataRows.length)]] };
    const minQuantity = Number(echo_cell(chosen, 'CC716_MIN_QTY')) || 0;
    save_service_order_items(bearerToken, data.version, order, form, chosen, Math.max(quantity, minQuantity), itemsWdwid, key);
    read_service_order_lines(bearerToken, data.version, order, orderWdwid, key);
    const header = reopen_service_order_after_items(bearerToken, data.version, order, orderWdwid, key);
    open_service_order_lines_grid(bearerToken, data.version, order, orderWdwid, key, 'OpenServiceOrderLinesGridAfterSave');
    open_service_order_lines_search(bearerToken, data.version, order, orderWdwid, key, 'OpenServiceOrderLinesSearchAfterSave');
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
    return header;
  });
  think();

  const fileKey = group('T20_EditServiceOrders_09_Edit_Documents_UploadDoc', () => {
    const key = refresh();
    open_service_order_documents_grid(bearerToken, data.version, order, orderWdwid, key);
    open_service_order_documents_search(bearerToken, data.version, order, orderWdwid, key);
    const cached = cache_document_file(bearerToken, data.version, document.name, document.content, 'CacheEditOrderDocument');
    open_service_order_document_form(bearerToken, data.version, order, cached, document.name, docWdwid, key);
    chrome_and_static(bearerToken, data.version, level, ['09'], subs);
    return cached;
  });
  think();

  const documentsKey = group('T20_EditServiceOrders_10_Edit_Documents_Import', () => {
    const key = refresh();
    const doc = refresh_service_order_document_fields(bearerToken, data.version, order, docDesc, fileKey, document.name, docWdwid, key);
    save_service_order_document(bearerToken, data.version, order, doc, docWdwid, key);
    const echoed = read_service_order_documents(bearerToken, data.version, order, orderWdwid, key);
    chrome_and_static(bearerToken, data.version, level, ['10'], subs);
    return echoed;
  });
  think();

  group('T20_EditServiceOrders_11_SaveAndClose', () => {
    refresh();
    save_service_order_close(bearerToken, data.version, order, picked.desc, reopenedHeader, orderDate, orderWdwid, documentsKey);
    open_payment_plan_orders_filtered_list(bearerToken, data.version, event.key, 'OpenEditOrdersFilteredList');
    open_payment_plan_orders_filtered_grid(bearerToken, data.version, event.key, 'OpenEditOrdersFilteredGrid');
    if (include_ui(level))
      get_payment_plan_order_control_info(bearerToken, data.version, order, 'GetEditOrderControlInfo', ORDER_TOTAL_CONTROL_ID);
    chrome_and_static(bearerToken, data.version, level, ['11'], subs);
  });
  think();

  group('T20_EditServiceOrders_12_LogOut', () => {
    refresh();
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['12'], subs);
  });
  think();
}
