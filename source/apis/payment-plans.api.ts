import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, find_transport_table, get_cell, initial_data_table, set_cell } from '../utils/exports/helpers.exp.ts';
import {
  paymentPlanOrdersListPayload,
  paymentPlanOrdersFilteredListPayload,
  paymentPlanOrdersGridInitPayload,
  paymentPlanOrdersFilteredGridInitPayload,
  paymentPlanSearchInitPayload,
  paymentPlanEventSearchPayload,
  paymentPlanEventRecentPayload,
  paymentPlanEventFieldsPayload,
  paymentPlanOrdersGridPayload,
  paymentPlanOrderControlInfoPayload,
  paymentPlanOrderDetailPayload,
  paymentPlanAccessPayload,
  paymentPlanFormPayload,
  paymentPlanScheduleSearchPayload,
  paymentPlanFieldsPayload,
  paymentPlanFormTable,
  paymentPlanScheduleCode,
  paymentPlanSavePayload,
  paymentPlanOpenPayload,
  paymentPlanStepsGridInitPayload,
  paymentPlanStepsSearchPayload,
  paymentPlanStepsGridPayload,
  paymentPlanInvoiceDialogPayload,
  paymentPlanInvoiceFieldsPayload,
  paymentPlanInvoiceSavePayload,
} from '../utils/exports/data.exp.ts';
import {
  InvoiceSaveResult,
  PaymentPlanEvent,
  PaymentPlanOrderRow,
  PaymentPlanSaveResult,
  ServiceOrderRow,
  TransportTable,
} from '../utils/exports/types.exp.ts';
import { serviceOrderColumns } from './service-orders.api.ts';

function post_plan(endpoint: string, payload: unknown, token: string, version: string, name: string) {
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

export function open_payment_plan_orders_list(token: string, version: string, name = 'OpenPaymentPlanOrdersList') {
  post_plan('GenericListServer/GetInitialData2', paymentPlanOrdersListPayload(), token, version, name);
}

export function open_payment_plan_orders_grid(token: string, version: string, name = 'OpenPaymentPlanOrdersGrid') {
  post_plan('USIDataGridServer/GetInitialData2', paymentPlanOrdersGridInitPayload(), token, version, name);
}

export function open_payment_plan_orders_search(token: string, version: string, name = 'OpenPaymentPlanOrdersSearch') {
  post_plan('GenericSearchServer/GetInitialData2', paymentPlanSearchInitPayload(), token, version, name);
}

export function search_payment_plan_events(token: string, version: string, eventName: string, name = 'SearchPaymentPlanEvents') {
  const res = post_plan('USISearchComboServer/GetDynamicSearchResults', paymentPlanEventSearchPayload(eventName), token, version, name);
  let events: PaymentPlanEvent[] = [];
  try {
    const hits = JSON.parse((res.json() as string[])[0]) as { Key: string; Value: string }[];
    events = hits.map((h) => ({ key: h.Key, desc: h.Value.split(` (${h.Key});`)[0] }));
  } catch {
    events = [];
  }
  check(events, { [`${name}: returns events`]: (e) => e.length > 0 });
  return events;
}

export function save_payment_plan_recent_event(token: string, version: string, eventKey: string, name = 'SavePaymentPlanRecentEvent') {
  post_plan('USISearchComboServer/SaveRecentlyUsed', paymentPlanEventRecentPayload(eventKey), token, version, name);
}

export function handle_payment_plan_event_fields(token: string, version: string, eventKey: string, name = 'HandlePaymentPlanEventFields') {
  post_plan('GenericSearchServer/HandleDependentFields2', paymentPlanEventFieldsPayload(eventKey), token, version, name);
}

export function read_payment_plan_orders(token: string, version: string, eventKey: string, name = 'ReadPaymentPlanOrders') {
  const res = post_plan('USIDataGridServer/GetGridData2', paymentPlanOrdersGridPayload(eventKey), token, version, name);
  const grid = find_transport_table(res, 'ER100_ORD_NBR', name);
  const rows: PaymentPlanOrderRow[] = grid.TransportDataRows.map((row) => {
    const table = { TransportDataColumns: grid.TransportDataColumns, TransportDataRows: [row] };
    const fields = Object.fromEntries(Object.entries(serviceOrderColumns).map(([field, column]) => [field, get_cell(table, column)]));
    return { ...(fields as ServiceOrderRow), table };
  });
  return rows.filter((row) => row.orderNbr !== '');
}

export function get_payment_plan_order_control_info(token: string, version: string, row: PaymentPlanOrderRow, name = 'GetControlInfo') {
  post_plan('USIDataGridServer/GetControlInfo', paymentPlanOrderControlInfoPayload(row), token, version, name);
}

export function open_payment_plan_order(token: string, version: string, row: ServiceOrderRow, name = 'OpenPaymentPlanOrder') {
  post_plan('GenericDetailServer/GetInitialData2', paymentPlanOrderDetailPayload(row), token, version, name);
}

export function access_payment_plan_order(token: string, version: string, row: ServiceOrderRow, name = 'AccessPaymentPlanOrder') {
  post_plan('GenericDetailServer/AccessServerUI', paymentPlanAccessPayload(row), token, version, name);
}

export function open_payment_plan_form(token: string, version: string, orderNbr: string, name = 'OpenPaymentPlanForm') {
  const res = post_plan('GenericDetailServer/GetInitialData2', paymentPlanFormPayload(orderNbr), token, version, name);
  return initial_data_table(res, name);
}

export function search_payment_plan_schedule(token: string, version: string, name = 'SearchPaymentPlanSchedule') {
  post_plan(
    'USISearchComboServer/GetDynamicSearchResults',
    paymentPlanScheduleSearchPayload(paymentPlanScheduleCode),
    token,
    version,
    name,
  );
}

export function handle_payment_plan_fields(
  token: string,
  version: string,
  orderNbr: string,
  billTo: string,
  form: TransportTable,
  name = 'HandlePaymentPlanFields',
) {
  const res = post_plan(
    'GenericDetailServer/HandleDependentFields2',
    paymentPlanFieldsPayload(orderNbr, billTo, paymentPlanFormTable(form, billTo)),
    token,
    version,
    name,
  );
  return find_transport_table(res, 'ER200_SCHED_CODE', name);
}

export function save_payment_plan(token: string, version: string, orderNbr: string, table: TransportTable, name = 'SavePaymentPlan') {
  const res = post_plan('GenericDetailServer/Save2', paymentPlanSavePayload(orderNbr, table), token, version, name);
  const body = res.json();
  const result = Array.isArray(body) ? (body[0] as PaymentPlanSaveResult | undefined) : undefined;
  const ok = check(result, {
    [`${name}: ResultValue is 0 (success)`]: (r) => r?.ResultValue === 0,
    [`${name}: returns new payment plan key`]: (r) => (r?.AddedRowKeys?.length ?? 0) > 0,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] ${name} failed for order ${orderNbr} — ${body_text(res).slice(0, 300)}`);
    fail(`${name} did not create a payment plan for order ${orderNbr}`);
  }
  return result!.AddedRowKeys![0].split('|')[1];
}

export function open_payment_plan(token: string, version: string, orderNbr: string, payPlanId: string, name = 'OpenPaymentPlan') {
  post_plan('GenericDetailServer/GetInitialData2', paymentPlanOpenPayload(orderNbr, payPlanId), token, version, name);
}

export function open_payment_plan_steps_grid(
  token: string,
  version: string,
  orderNbr: string,
  payPlanId: string,
  name = 'OpenPaymentPlanStepsGrid',
) {
  post_plan('USIDataGridServer/GetInitialData2', paymentPlanStepsGridInitPayload(orderNbr, payPlanId), token, version, name);
}

export function open_payment_plan_steps_search(
  token: string,
  version: string,
  orderNbr: string,
  payPlanId: string,
  name = 'OpenPaymentPlanStepsSearch',
) {
  post_plan('GenericSearchServer/GetInitialData2', paymentPlanStepsSearchPayload(orderNbr, payPlanId), token, version, name);
}

export function read_payment_plan_steps(
  token: string,
  version: string,
  orderNbr: string,
  payPlanId: string,
  name = 'ReadPaymentPlanSteps',
) {
  post_plan('USIDataGridServer/GetGridData2', paymentPlanStepsGridPayload(orderNbr, payPlanId), token, version, name);
}

export function open_payment_plan_invoice_dialog(
  token: string,
  version: string,
  payPlanId: string,
  refreshKey: number,
  name = 'OpenPaymentPlanInvoiceDialog',
) {
  const res = post_plan(
    'GenericDetailServer/GetInitialData2',
    paymentPlanInvoiceDialogPayload(payPlanId, refreshKey),
    token,
    version,
    name,
  );
  return initial_data_table(res, name);
}

export function handle_payment_plan_invoice_fields(
  token: string,
  version: string,
  payPlanId: string,
  refreshKey: number,
  dialog: TransportTable,
  name = 'HandlePaymentPlanInvoiceFields',
) {
  set_cell(dialog, 'cREPORT_TYPE', '1');
  dialog.TableName = `${Date.now()}`;
  const res = post_plan(
    'GenericDetailServer/HandleDependentFields2',
    paymentPlanInvoiceFieldsPayload(payPlanId, refreshKey, dialog),
    token,
    version,
    name,
  );
  return find_transport_table(res, 'cREPORT_TYPE', name);
}

export function save_payment_plan_invoice(
  token: string,
  version: string,
  payPlanId: string,
  refreshKey: number,
  table: TransportTable,
  name = 'SavePaymentPlanInvoice',
) {
  const res = post_plan('GenericDetailServer/Save2', paymentPlanInvoiceSavePayload(payPlanId, refreshKey, table), token, version, name);
  const body = res.json();
  const result = Array.isArray(body) ? (body[0] as InvoiceSaveResult | undefined) : undefined;
  const ok = check(result, {
    [`${name}: ResultValue is 0 (success)`]: (r) => r?.ResultValue === 0,
    [`${name}: no error codes`]: (r) => r?.ErrorCodes.length === 0,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] ${name} failed for payment plan ${payPlanId} — ${body_text(res).slice(0, 300)}`);
    fail(`${name} did not create an invoice for payment plan ${payPlanId}`);
  }
}

export function open_payment_plan_orders_filtered_list(
  token: string,
  version: string,
  eventKey: string,
  name = 'OpenPaymentPlanOrdersFilteredList',
) {
  post_plan('GenericListServer/GetInitialData2', paymentPlanOrdersFilteredListPayload(eventKey), token, version, name);
}

export function open_payment_plan_orders_filtered_grid(
  token: string,
  version: string,
  eventKey: string,
  name = 'OpenPaymentPlanOrdersFilteredGrid',
) {
  post_plan('USIDataGridServer/GetInitialData2', paymentPlanOrdersFilteredGridInitPayload(eventKey), token, version, name);
}
