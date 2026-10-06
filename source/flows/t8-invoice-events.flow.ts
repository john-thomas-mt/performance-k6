import { check, group, fail } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  get_main_menu_data,
  getMainMenuDataThresholds,
  open_non_invoiced_orders_list,
  open_non_invoiced_orders_grid,
  open_non_invoiced_orders_search,
  read_non_invoiced_orders,
  get_non_invoiced_order_control_info,
  get_invoice_transaction_source,
  open_invoice_dialog,
  refresh_invoice_fields,
  save_invoice,
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
  seed_gap_message,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { invoiceEventsChrome, invoiceEventsStatic, invoiceEventsTransport } from '../utils/exports/data.exp.ts';
import { User, SetupData, FidelityLevel, NonInvoicedOrderRow, TransportTable } from '../utils/exports/types.exp.ts';

export const invoiceEventsThresholds = {
  ...getMainMenuDataThresholds,
  'http_req_duration{name:OpenNonInvoicedOrdersList}': ['avg<4000'],
  'http_req_duration{name:OpenNonInvoicedOrdersGrid}': ['avg<4000'],
  'http_req_duration{name:OpenNonInvoicedOrdersSearch}': ['avg<4000'],
  'http_req_duration{name:ReadNonInvoicedOrders}': ['avg<4000'],
  'http_req_duration{name:GetInvoiceTransactionSource}': ['avg<4000'],
  'http_req_duration{name:OpenInvoiceDialog}': ['avg<4000'],
  'http_req_duration{name:HandleInvoiceFields}': ['avg<4000'],
  'http_req_duration{name:SaveInvoice}': ['avg<4000'],
  'http_req_duration{name:ReadNonInvoicedOrdersAfterInvoice}': ['avg<4000'],
};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, invoiceEventsChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(invoiceEventsStatic[step] ?? []);
      fire_transport(token, version, invoiceEventsTransport[step] ?? [], subs);
    }
  }
}

export function invoice_events_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const subs: Subs = {};

  group('T008_InvoiceEvent_01_Launch', () => {
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

  const { bearerToken } = login_to_events(user, data.version, 'T008_InvoiceEvent_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T008_InvoiceEvent_03_SearchInvoiceEvent', () => {
    get_main_menu_data(bearerToken, data.version);
    open_non_invoiced_orders_list(bearerToken, data.version);
    open_non_invoiced_orders_grid(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  let orderRef: NonInvoicedOrderRow | null = null;
  group('T008_InvoiceEvent_04_SearchEvent', () => {
    open_non_invoiced_orders_search(bearerToken, data.version);
    const rows = read_non_invoiced_orders(bearerToken, data.version, config.seedInvoiceEventPrefix);
    check(null, { 'Non-invoiced order available': () => rows.length > 0 });
    if (rows.length > 0) {
      orderRef = rows[exec.scenario.iterationInTest % rows.length];
      if (include_ui(level)) get_non_invoiced_order_control_info(bearerToken, data.version, orderRef);
    }
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
  });
  if (!orderRef) fail(seed_gap_message('invoice_events', 'no order in the non-invoiced grid'));
  const order = orderRef as NonInvoicedOrderRow;
  think();

  const refreshKey = String(Date.now());
  let transSource = '';
  let dialogRef: TransportTable | null = null;
  group('T008_InvoiceEvent_05_SelectandInvoice', () => {
    transSource = get_invoice_transaction_source(bearerToken, data.version, order.orderNbr);
    dialogRef = open_invoice_dialog(bearerToken, data.version, order.orderNbr, transSource, refreshKey);
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  const dialog = dialogRef!;
  think();

  group('T008_InvoiceEvent_06_InvoiceOk', () => {
    const table = refresh_invoice_fields(bearerToken, data.version, order.orderNbr, transSource, refreshKey, dialog);
    save_invoice(bearerToken, data.version, order.orderNbr, transSource, refreshKey, table);
    console.log(`[VU ${__VU}] Invoiced order ${order.orderNbr} (event ${order.evtId})`);
    read_non_invoiced_orders(bearerToken, data.version, config.seedInvoiceEventPrefix, 'ReadNonInvoicedOrdersAfterInvoice');
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  group('T008_InvoiceEvent_07_SignOut', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();
}
