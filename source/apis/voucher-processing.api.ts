import http from 'k6/http';
import { check, fail, JSONValue } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import {
  build_headers,
  body_text,
  coerce_transport_types,
  find_transport_table,
  get_cell,
  initial_data_table,
  seed_gap_message,
} from '../utils/exports/helpers.exp.ts';
import {
  voucherBatchFormPayload,
  voucherBatchSavePayload,
  voucherAddFormPayload,
  voucherAddGridInitPayload,
  voucherAddPoDetailSearchPayload,
  voucherAddSectionSearchPayload,
  voucherCanAddPoItemsPayload,
  voucherCanPostPayload,
  voucherDetailDataPayload,
  voucherDetailGridDataPayload,
  voucherEditFormPayload,
  voucherEditGridInitPayload,
  voucherEditPoDetailSearchPayload,
  voucherEditPoSectionSearchPayload,
  voucherEditSectionSearchPayload,
  voucherGridInitPayload,
  voucherGridReturnPayload,
  voucherListGridDataPayload,
  voucherListPayload,
  voucherListReturnPayload,
  voucherPoLinesFormPayload,
  voucherPoLinesGridDataPayload,
  voucherPoLinesGridInitPayload,
  voucherPoLinesSearchPayload,
  voucherPoSavePayload,
  voucherPostFormPayload,
  voucherPostSavePayload,
  voucherSavePayload,
  voucherSupplierFieldsPayload,
  voucherSupplierRecentlyUsedPayload,
  voucherSupplierSearchPayload,
} from '../utils/exports/data.exp.ts';
import {
  TransportTable,
  VoucherBatchDefaults,
  VoucherPostForm,
  VoucherPurchaseOrderLine,
  VoucherSaveResult,
  VoucherSupplier,
  VoucherProcessingWindows,
  VoucherComboRow,
} from '../utils/exports/types.exp.ts';

const SUPPLIER_NAME_SEPARATOR = ';';
const ADD_PO_LINE_GRID_OBJECTS = { poDetail: 1296, section: 1261 };

function post_voucher(endpoint: string, payload: unknown, token: string, version: string, name: string) {
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

function json_at(res: ReturnType<typeof post_voucher>, index: number) {
  try {
    return (res.json() as JSONValue[])[index];
  } catch {
    return undefined;
  }
}

function string_at(res: ReturnType<typeof post_voucher>, index: number) {
  const value = json_at(res, index);
  return typeof value === 'string' ? value : '';
}

function combo_rows(res: ReturnType<typeof post_voucher>) {
  try {
    return JSON.parse(string_at(res, 0)) as VoucherComboRow[];
  } catch {
    return [];
  }
}

function save_result(res: ReturnType<typeof post_voucher>) {
  const result = json_at(res, 0);
  return result !== null && typeof result === 'object' && !Array.isArray(result) ? (result as VoucherSaveResult) : undefined;
}

function report_save(result: VoucherSaveResult | undefined, name: string) {
  const ok = check(result, {
    [`${name}: ResultValue is 0 (success)`]: (r) => r?.ResultValue === 0,
    [`${name}: no error codes`]: (r) => (r?.ErrorCodes ?? []).length === 0,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] ${name} failed — ${JSON.stringify(result).slice(0, 400)}`);
    fail(`${name} did not save`);
  }
}

function added_key(result: VoucherSaveResult | undefined, name: string) {
  const key = (result?.AddedRowKeys ?? [])[0] ?? '';
  const id = key.slice(key.indexOf('|') + 1);
  if (!check(id, { [`${name}: returns the added record key`]: (k) => k !== '' })) {
    console.error(`[VU ${__VU}] ${name} failed — no AddedRowKeys: ${JSON.stringify(result).slice(0, 300)}`);
    fail(`${name}: no added row key returned`);
  }
  return id;
}

function require_cells(cells: { [cell: string]: string }, name: string) {
  const missing = Object.keys(cells).filter((cell) => cells[cell] === '');
  if (!check(missing, { [`${name}: returns the cells the next request echoes`]: (m) => m.length === 0 })) {
    console.error(`[VU ${__VU}] ${name} failed — empty ${missing.join(', ')}`);
    fail(`${name}: response left ${missing.join(', ')} empty`);
  }
}

export function open_voucher_list(token: string, version: string, windows: VoucherProcessingWindows, name = 'OpenVoucherList') {
  post_voucher('GenericListServer/GetInitialData2', voucherListPayload(windows), token, version, name);
}

export function reopen_voucher_list(token: string, version: string, windows: VoucherProcessingWindows, name = 'ReopenVoucherList') {
  post_voucher('GenericListServer/GetInitialData2', voucherListReturnPayload(windows), token, version, name);
}

export function open_voucher_grid(token: string, version: string, windows: VoucherProcessingWindows, name = 'OpenVoucherGrid') {
  post_voucher('USIDataGridServer/GetInitialData2', voucherGridInitPayload(windows), token, version, name);
}

export function reopen_voucher_grid(token: string, version: string, windows: VoucherProcessingWindows, name = 'ReopenVoucherGrid') {
  post_voucher('USIDataGridServer/GetInitialData2', voucherGridReturnPayload(windows), token, version, name);
}

export function read_voucher_list(token: string, version: string, windows: VoucherProcessingWindows, name = 'ReadVoucherList') {
  post_voucher('USIDataGridServer/GetGridData2', voucherListGridDataPayload(windows), token, version, name);
}

export function open_voucher_batch_form(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  columnStamp: string,
  name = 'OpenVoucherBatchForm',
) {
  const res = post_voucher('GenericDetailServer/GetInitialData2', voucherBatchFormPayload(windows, columnStamp), token, version, name);
  const table = initial_data_table(res, name);
  const defaults: VoucherBatchDefaults = {
    glDate: get_cell(table, 'AP110_GL_TRANS_DATE'),
    fiscalPeriod: get_cell(table, 'cFYP'),
  };
  require_cells({ ...defaults }, name);
  if (!check(defaults, { [`${name}: returns a numeric GL date`]: (d) => /^-?\d+$/.test(d.glDate) })) {
    console.error(`[VU ${__VU}] open_voucher_batch_form failed — GL date ${defaults.glDate}`);
    fail(`${name}: GL date is not an epoch`);
  }
  return defaults;
}

export function save_voucher_batch(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  description: string,
  defaults: VoucherBatchDefaults,
  name = 'SaveVoucherBatch',
) {
  const res = post_voucher(
    'GenericDetailServer/Save2',
    voucherBatchSavePayload(windows, description, defaults.glDate, defaults.fiscalPeriod),
    token,
    version,
    name,
  );
  const result = save_result(res);
  report_save(result, name);
  return added_key(result, name);
}

export function open_voucher_add_form(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  columnStamp: string,
  batchId: string,
  name = 'OpenVoucherAddForm',
) {
  const res = post_voucher(
    'GenericDetailServer/GetInitialData2',
    voucherAddFormPayload(windows, columnStamp, batchId),
    token,
    version,
    name,
  );
  return initial_data_table(res, name);
}

export function open_voucher_add_grids(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  name = 'OpenVoucherAddGrid',
) {
  post_voucher(
    'USIDataGridServer/GetInitialData2',
    voucherAddGridInitPayload(windows, batchId, ADD_PO_LINE_GRID_OBJECTS.poDetail),
    token,
    version,
    name,
  );
  post_voucher(
    'USIDataGridServer/GetInitialData2',
    voucherAddGridInitPayload(windows, batchId, ADD_PO_LINE_GRID_OBJECTS.section),
    token,
    version,
    name,
  );
}

export function open_voucher_add_searches(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  name = 'OpenVoucherAddSearch',
) {
  post_voucher('GenericSearchServer/GetInitialData2', voucherAddPoDetailSearchPayload(windows, batchId), token, version, name);
  post_voucher('GenericSearchServer/GetInitialData2', voucherAddSectionSearchPayload(windows, batchId), token, version, name);
}

export function search_voucher_supplier(token: string, version: string, supplierName: string, name = 'SearchVoucherSupplier') {
  const res = post_voucher(
    'USISearchComboServer/GetDynamicSearchResults',
    voucherSupplierSearchPayload(supplierName),
    token,
    version,
    name,
  );
  const row = combo_rows(res)[0];
  const supplier: VoucherSupplier = {
    key: row?.Key ?? '',
    name: (row?.Value ?? '').split(SUPPLIER_NAME_SEPARATOR)[0],
  };
  if (!check(supplier, { [`${name}: finds the supplier`]: (s) => s.key !== '' })) {
    console.error(`[VU ${__VU}] search_voucher_supplier failed — no supplier matches "${supplierName}": ${body_text(res).slice(0, 200)}`);
    fail(`${name}: supplier "${supplierName}" not found`);
  }
  return supplier;
}

export function save_recent_voucher_supplier(token: string, version: string, supplierKey: string, name = 'SaveRecentVoucherSupplier') {
  post_voucher('USISearchComboServer/SaveRecentlyUsed', voucherSupplierRecentlyUsedPayload(supplierKey), token, version, name);
}

export function refresh_voucher_supplier_fields(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  supplierKey: string,
  source: TransportTable,
  defaults: VoucherBatchDefaults,
  name = 'HandleVoucherSupplierFields',
) {
  const res = post_voucher(
    'GenericDetailServer/HandleDependentFields2',
    voucherSupplierFieldsPayload(windows, batchId, supplierKey, source, defaults.glDate),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'AP100_GLACCT_AP', name);
  require_cells({ glAccount: get_cell(table, 'AP100_GLACCT_AP') }, name);
  return table;
}

export function save_voucher(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  source: TransportTable,
  vendorInvoice: string,
  name = 'SaveVoucher',
) {
  const res = post_voucher('GenericDetailServer/Save2', voucherSavePayload(windows, batchId, source, vendorInvoice), token, version, name);
  const result = save_result(res);
  report_save(result, name);
  return added_key(result, name);
}

export function open_voucher_edit_form(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  columnStamp: string,
  batchId: string,
  voucher: string,
  name = 'OpenVoucherEditForm',
) {
  post_voucher('GenericDetailServer/GetInitialData2', voucherEditFormPayload(windows, columnStamp, batchId, voucher), token, version, name);
}

export function open_voucher_edit_grids(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  name = 'OpenVoucherEditGrid',
) {
  post_voucher(
    'USIDataGridServer/GetInitialData2',
    voucherEditGridInitPayload(windows, batchId, voucher, ADD_PO_LINE_GRID_OBJECTS.poDetail),
    token,
    version,
    name,
  );
  post_voucher(
    'USIDataGridServer/GetInitialData2',
    voucherEditGridInitPayload(windows, batchId, voucher, ADD_PO_LINE_GRID_OBJECTS.section),
    token,
    version,
    name,
  );
}

export function open_voucher_edit_po_detail_search(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  resultsCount: number,
  name = 'OpenVoucherEditPoDetailSearch',
) {
  post_voucher(
    'GenericSearchServer/GetInitialData2',
    voucherEditPoDetailSearchPayload(windows, batchId, voucher, resultsCount),
    token,
    version,
    name,
  );
}

export function open_voucher_edit_section_search(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  resultsCount: number,
  name = 'OpenVoucherEditSectionSearch',
) {
  post_voucher(
    'GenericSearchServer/GetInitialData2',
    voucherEditSectionSearchPayload(windows, batchId, voucher, resultsCount),
    token,
    version,
    name,
  );
}

export function refresh_voucher_edit_search(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  name = 'RefreshVoucherEditSearch',
) {
  post_voucher('GenericSearchServer/GetInitialData2', voucherEditPoSectionSearchPayload(windows, batchId, voucher), token, version, name);
}

export function can_add_voucher_po_items(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  supplierKey: string,
  name = 'CanAddVoucherPoItems',
) {
  post_voucher(
    'GenericDetailServer/AccessServerUI',
    voucherCanAddPoItemsPayload(windows, batchId, voucher, supplierKey),
    token,
    version,
    name,
  );
}

export function open_voucher_po_lines_form(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  columnStamp: string,
  voucher: string,
  supplierKey: string,
  name = 'OpenVoucherPoLinesForm',
) {
  const res = post_voucher(
    'GenericDetailServer/GetInitialData2',
    voucherPoLinesFormPayload(windows, columnStamp, voucher, supplierKey),
    token,
    version,
    name,
  );
  return initial_data_table(res, name);
}

export function open_voucher_po_lines_grid(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  voucher: string,
  supplierKey: string,
  name = 'OpenVoucherPoLinesGrid',
) {
  const res = post_voucher(
    'USIDataGridServer/GetInitialData2',
    voucherPoLinesGridInitPayload(windows, voucher, supplierKey),
    token,
    version,
    name,
  );
  const total = json_at(res, 9);
  if (!check(total, { [`${name}: returns the PO line total`]: (t) => typeof t === 'number' && t > 0 })) {
    console.error(`[VU ${__VU}] open_voucher_po_lines_grid failed — total ${JSON.stringify(total)}`);
    fail(seed_gap_message('voucher_processing', `supplier ${supplierKey} has no purchase order lines to voucher`));
  }
  return total as number;
}

export function read_voucher_po_lines(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  voucher: string,
  supplierKey: string,
  totalCount: number,
  pickIndex: number,
  name = 'ReadVoucherPoLines',
) {
  const res = post_voucher(
    'USIDataGridServer/GetGridData2',
    voucherPoLinesGridDataPayload(windows, voucher, supplierKey, totalCount),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'cROW_KEY', name);
  const columns = table.TransportDataColumns.map((c) => c.ColumnName);
  const invoicedAt = String(columns.indexOf('cQTY_INVOICED'));
  const rowKeyAt = String(columns.indexOf('cROW_KEY'));
  const voucherable = table.TransportDataRows.filter((r) => {
    const invoiced = Number(r.Values[invoicedAt]);
    return !isNaN(invoiced) && invoiced !== 0 && r.Values[rowKeyAt] !== null && r.Values[rowKeyAt] !== undefined;
  });
  if (!check(voucherable, { [`${name}: finds a PO line to voucher`]: (rows) => rows.length > 0 })) {
    console.error(`[VU ${__VU}] read_voucher_po_lines failed — ${table.TransportDataRows.length} lines, none with an invoiceable quantity`);
    fail(seed_gap_message('voucher_processing', `supplier ${supplierKey} has no invoiceable purchase order line`));
  }
  const row = voucherable[pickIndex % voucherable.length];
  const line: VoucherPurchaseOrderLine = {
    table: coerce_transport_types({ ...table, TransportDataRows: [row] }),
    rowKey: String(row.Values[rowKeyAt]),
  };
  return line;
}

export function open_voucher_po_lines_search(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  voucher: string,
  supplierKey: string,
  name = 'OpenVoucherPoLinesSearch',
) {
  post_voucher('GenericSearchServer/GetInitialData2', voucherPoLinesSearchPayload(windows, voucher, supplierKey), token, version, name);
}

export function save_voucher_po_line(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  voucher: string,
  supplierKey: string,
  header: TransportTable,
  line: VoucherPurchaseOrderLine,
  name = 'SaveVoucherPoLine',
) {
  const res = post_voucher(
    'GenericDetailServer/Save2',
    voucherPoSavePayload(windows, voucher, supplierKey, header, line.table, line.rowKey),
    token,
    version,
    name,
  );
  report_save(save_result(res), name);
}

export function read_voucher_detail(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  name = 'ReadVoucherDetail',
) {
  post_voucher('GenericDetailServer/GetData2', voucherDetailDataPayload(windows, batchId, voucher), token, version, name);
}

export function read_voucher_detail_grid(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  name = 'ReadVoucherDetailGrid',
) {
  post_voucher('USIDataGridServer/GetGridData2', voucherDetailGridDataPayload(windows, batchId, voucher), token, version, name);
}

export function can_post_voucher_batch(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  name = 'CanPostVoucherBatch',
) {
  post_voucher('USIDataGridServer/AccessServerUI', voucherCanPostPayload(windows, batchId), token, version, name);
}

export function open_voucher_post_form(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  columnStamp: string,
  batchId: string,
  name = 'OpenVoucherPostForm',
) {
  const res = post_voucher(
    'GenericDetailServer/GetInitialData2',
    voucherPostFormPayload(windows, columnStamp, batchId, String(Date.now())),
    token,
    version,
    name,
  );
  const refreshKey = /"RefreshDependentKey":(\d+),"WdwContextObjectIDForFav"/.exec(string_at(res, 7))?.[1] ?? '';
  const form: VoucherPostForm = { table: find_transport_table(res, 'AP110_BATCH_TOTAL', name), refreshKey };
  require_cells({ refreshKey }, name);
  return form;
}

export function post_voucher_batch(
  token: string,
  version: string,
  windows: VoucherProcessingWindows,
  batchId: string,
  form: VoucherPostForm,
  name = 'PostVoucherBatch',
) {
  const res = post_voucher(
    'GenericDetailServer/Save2',
    voucherPostSavePayload(windows, batchId, form.table, form.refreshKey),
    token,
    version,
    name,
  );
  report_save(save_result(res), name);
}
