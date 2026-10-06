import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, find_transport_table, get_cell, initial_data_table, set_cell } from '../utils/exports/helpers.exp.ts';
import {
  invoiceDialogPayload,
  invoiceFieldsPayload,
  invoiceSavePayload,
  canCompleteWorkOrdersPayload,
  closeOrderPayload,
  completeWorkOrdersPayload,
  invoiceTransactionSourcePayload,
  nonInvoicedOrderControlInfoPayload,
  nonInvoicedOrdersGridInitPayload,
  nonInvoicedOrdersGridPayload,
  nonInvoicedOrdersListPayload,
  nonInvoicedOrdersSearchPayload,
} from '../utils/exports/data.exp.ts';
import { InvoiceSaveResult, NonInvoicedOrderRow, TransportTable } from '../utils/exports/types.exp.ts';

function post_invoice(endpoint: string, payload: unknown, token: string, version: string, name: string) {
  const res = http.post(`${config.baseUrl}/api/${endpoint}`, JSON.stringify(payload), {
    headers: build_headers(token, version),
    tags: { name },
  });
  if (!check(res, { [`${name}: status is 201`]: (r) => r.status === 201 })) {
    console.error(`[VU ${__VU}] ${name} failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail(`${name} did not return 201`);
  }
  return res;
}

export function get_main_menu_data(token: string, version: string, name = 'GetMainMenuData') {
  const res = http.get(`${config.baseUrl}/api/MainMenuServer/GetMainMenuData?astrOrgCode=10&astrSearchTerm=&ablnInitialLoad=true`, {
    headers: build_headers(token, version),
    tags: { name },
  });
  if (!check(res, { [`${name}: status is 200 or 201`]: (r) => r.status === 200 || r.status === 201 })) {
    console.error(`[VU ${__VU}] ${name} failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail(`${name} did not return 200 or 201`);
  }
}

export function open_non_invoiced_orders_list(token: string, version: string, name = 'OpenNonInvoicedOrdersList') {
  post_invoice('GenericListServer/GetInitialData2', nonInvoicedOrdersListPayload(), token, version, name);
}

export function open_non_invoiced_orders_grid(token: string, version: string, name = 'OpenNonInvoicedOrdersGrid') {
  post_invoice('USIDataGridServer/GetInitialData2', nonInvoicedOrdersGridInitPayload(), token, version, name);
}

export function open_non_invoiced_orders_search(token: string, version: string, name = 'OpenNonInvoicedOrdersSearch') {
  post_invoice('GenericSearchServer/GetInitialData2', nonInvoicedOrdersSearchPayload(), token, version, name);
}

export function read_non_invoiced_orders(token: string, version: string, eventPrefix: string, name = 'ReadNonInvoicedOrders') {
  const res = post_invoice('USIDataGridServer/GetGridData2', nonInvoicedOrdersGridPayload(eventPrefix), token, version, name);
  const grid = find_transport_table(res, 'ER100_ORD_NBR', name);
  const rows: NonInvoicedOrderRow[] = grid.TransportDataRows.map((row) => {
    const table = { TransportDataColumns: grid.TransportDataColumns, TransportDataRows: [row] };
    return { orderNbr: get_cell(table, 'ER100_ORD_NBR'), evtId: get_cell(table, 'ER100_EVT_ID'), table };
  });
  return rows.filter((row) => row.orderNbr !== '');
}

export function get_non_invoiced_order_control_info(token: string, version: string, row: NonInvoicedOrderRow, name = 'GetControlInfo') {
  post_invoice('USIDataGridServer/GetControlInfo', nonInvoicedOrderControlInfoPayload(row), token, version, name);
}

export function get_invoice_transaction_source(token: string, version: string, orderNbr: string, name = 'GetInvoiceTransactionSource') {
  const res = post_invoice('USIDataGridServer/AccessServerUI', invoiceTransactionSourcePayload(orderNbr), token, version, name);
  let transSource = '';
  try {
    transSource = (JSON.parse((res.json() as string[])[0]) as { InvoiceTransSource?: string }).InvoiceTransSource ?? '';
  } catch {
    transSource = '';
  }
  if (!check(transSource, { [`${name}: returns the invoice transaction source`]: (s) => s !== '' })) {
    console.error(`[VU ${__VU}] ${name} failed for order ${orderNbr} — ${body_text(res).slice(0, 300)}`);
    fail(`${name}: no transaction source for order ${orderNbr}`);
  }
  return transSource;
}

export function open_invoice_dialog(
  token: string,
  version: string,
  orderNbr: string,
  transSource: string,
  refreshKey: string,
  name = 'OpenInvoiceDialog',
) {
  const res = post_invoice(
    'GenericDetailServer/GetInitialData2',
    invoiceDialogPayload(orderNbr, transSource, refreshKey),
    token,
    version,
    name,
  );
  return initial_data_table(res, name);
}

export function refresh_invoice_fields(
  token: string,
  version: string,
  orderNbr: string,
  transSource: string,
  refreshKey: string,
  dialog: TransportTable,
  name = 'HandleInvoiceFields',
) {
  set_cell(dialog, 'cREPORT_TYPE', '1');
  dialog.TableName = `${Date.now()}`;
  const res = post_invoice(
    'GenericDetailServer/HandleDependentFields2',
    invoiceFieldsPayload(orderNbr, transSource, refreshKey, dialog),
    token,
    version,
    name,
  );
  return find_transport_table(res, 'cREPORT_TYPE', name);
}

export function save_invoice(
  token: string,
  version: string,
  orderNbr: string,
  transSource: string,
  refreshKey: string,
  table: TransportTable,
  name = 'SaveInvoice',
) {
  const res = post_invoice('GenericDetailServer/Save2', invoiceSavePayload(orderNbr, transSource, refreshKey, table), token, version, name);
  const body = res.json();
  const result = Array.isArray(body) ? (body[0] as InvoiceSaveResult | undefined) : undefined;
  const ok = check(result, {
    [`${name}: ResultValue is 0 (success)`]: (r) => r?.ResultValue === 0,
    [`${name}: no error codes`]: (r) => r?.ErrorCodes.length === 0,
    [`${name}: reports InvoicesCreated`]: (r) => r?.MessageInfoList.some((m) => m.MessageKey === 'InvoicesCreated') === true,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] ${name} failed for order ${orderNbr} — ${body_text(res).slice(0, 300)}`);
    fail(`${name} did not create an invoice for order ${orderNbr}`);
  }
}

function access_work_orders(payload: unknown, expected: string, token: string, version: string, name: string) {
  const res = post_invoice('USIDataGridServer/AccessServerUI', payload, token, version, name);
  if (!check(res, { [`${name}: response contains ${expected}`]: (r) => body_text(r).includes(expected) })) {
    const text = body_text(res).replace(/\\+"/g, '"');
    const reason = /"MessageTitle":"([^"]*)".*?"Messages":\[([^\]]*)\]/.exec(text);
    console.error(`[VU ${__VU}] ${name} failed — ${reason ? `${reason[1]}: ${reason[2]}` : text.slice(0, 300)}`);
    fail(`${name}: response did not contain ${expected}`);
  }
}

export function can_complete_work_orders(token: string, version: string, name = 'CanCompleteWorkOrders') {
  access_work_orders(canCompleteWorkOrdersPayload(), 'CanCompleteWorkOrders\\":true', token, version, name);
}

export function complete_work_orders(token: string, version: string, orderNbr: string, name = 'CompleteWorkOrders') {
  access_work_orders(completeWorkOrdersPayload(orderNbr), 'Work Order(s) Completed', token, version, name);
}

export function close_service_order(token: string, version: string, orderNbr: string, closeDate: number, name = 'CloseServiceOrder') {
  access_work_orders(closeOrderPayload(orderNbr, closeDate), 'ErrorCodes\\":[]', token, version, name);
}
