import http from 'k6/http';
import { check, fail, JSONValue } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, find_transport_table, get_cell, initial_data_table } from '../utils/exports/helpers.exp.ts';
import {
  purchaseOrderDepartmentFieldsPayload,
  purchaseOrderDepartmentSearchPayload,
  purchaseOrderDetailPayload,
  purchaseOrderFormPayload,
  purchaseOrderGlAccountPayload,
  purchaseOrderItemCostFieldsPayload,
  purchaseOrderItemFormPayload,
  purchaseOrderItemQuantityFieldsPayload,
  purchaseOrderItemRateFieldsPayload,
  purchaseOrderItemRecentlyUsedPayload,
  purchaseOrderItemsGridPayload,
  purchaseOrderItemsGridRefreshPayload,
  purchaseOrderItemSavePayload,
  purchaseOrderItemSearchPayload,
  purchaseOrderItemSelectFieldsPayload,
  purchaseOrderItemsSearchPayload,
  purchaseOrderSavePayload,
  purchaseOrderSupplierFieldsPayload,
  purchaseOrderSupplierRecentlyUsedPayload,
  purchaseOrderSupplierSearchPayload,
  purchaseOrdersGridInitPayload,
  purchaseOrdersListPayload,
} from '../utils/exports/data.exp.ts';
import {
  PurchaseOrderCells,
  PurchaseOrderComboRow,
  PurchaseOrderContext,
  PurchaseOrderDefaults,
  PurchaseOrderItemCells,
  PurchaseOrderSaveResult,
  PurchaseOrderSupplierFields,
  PurchaseOrderWindows,
} from '../utils/exports/types.exp.ts';

const NON_INVENTORY_PREFIX = '@NONINVENTORY';

function post_purchase_order(endpoint: string, payload: unknown, token: string, version: string, name: string) {
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

function json_at(res: ReturnType<typeof post_purchase_order>, index: number) {
  try {
    return (res.json() as JSONValue[])[index];
  } catch {
    return undefined;
  }
}

function string_at(res: ReturnType<typeof post_purchase_order>, index: number) {
  const value = json_at(res, index);
  return typeof value === 'string' ? value : '';
}

function combo_rows(res: ReturnType<typeof post_purchase_order>) {
  try {
    return JSON.parse(string_at(res, 0)) as PurchaseOrderComboRow[];
  } catch {
    return [];
  }
}

function save_result(res: ReturnType<typeof post_purchase_order>) {
  const result = json_at(res, 0);
  return result !== null && typeof result === 'object' && !Array.isArray(result) ? (result as PurchaseOrderSaveResult) : undefined;
}

function report_save(result: PurchaseOrderSaveResult | undefined, name: string) {
  const ok = check(result, {
    [`${name}: ResultValue is 0 (success)`]: (r) => r?.ResultValue === 0,
    [`${name}: no error codes`]: (r) => (r?.ErrorCodes ?? []).length === 0,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] ${name} failed — ${JSON.stringify(result).slice(0, 400)}`);
    fail(`${name} did not save`);
  }
}

function require_cells(cells: PurchaseOrderCells, name: string) {
  const missing = Object.keys(cells).filter((cell) => cells[cell] === '');
  if (!check(missing, { [`${name}: returns the cells the next request echoes`]: (m) => m.length === 0 })) {
    console.error(`[VU ${__VU}] ${name} failed — empty ${missing.join(', ')}`);
    fail(`${name}: response left ${missing.join(', ')} empty`);
  }
}

export function open_purchase_orders_list(token: string, version: string, windows: PurchaseOrderWindows, name = 'OpenPurchaseOrdersList') {
  post_purchase_order('GenericListServer/GetInitialData2', purchaseOrdersListPayload(windows), token, version, name);
}

export function open_purchase_orders_grid(token: string, version: string, windows: PurchaseOrderWindows, name = 'OpenPurchaseOrdersGrid') {
  post_purchase_order('USIDataGridServer/GetInitialData2', purchaseOrdersGridInitPayload(windows), token, version, name);
}

export function open_purchase_order_form(
  token: string,
  version: string,
  windows: PurchaseOrderWindows,
  columnStamp: string,
  name = 'OpenPurchaseOrderForm',
) {
  const res = post_purchase_order(
    'GenericDetailServer/GetInitialData2',
    purchaseOrderFormPayload(windows, columnStamp),
    token,
    version,
    name,
  );
  const table = initial_data_table(res, name);
  const defaults: PurchaseOrderDefaults = {
    date: get_cell(table, 'PO100_DATE'),
    status: get_cell(table, 'cCOMP_STATUS'),
    billTo: get_cell(table, 'PO100_BILLTO'),
    buyer: get_cell(table, 'PO100_BUYER'),
    shipTo: get_cell(table, 'PO100_SHIPTO'),
    space: get_cell(table, 'PO100_SPACE'),
    requestor: get_cell(table, 'PO100_REQUESTOR'),
  };
  require_cells({ ...defaults }, name);
  if (!check(defaults, { [`${name}: returns a numeric order date`]: (d) => /^-?\d+$/.test(d.date) })) {
    console.error(`[VU ${__VU}] open_purchase_order_form failed — date ${defaults.date}`);
    fail(`${name}: order date is not an epoch`);
  }
  return defaults;
}

export function search_purchase_order_supplier(token: string, version: string, supplierName: string, name = 'SearchPoSupplier') {
  const res = post_purchase_order(
    'USISearchComboServer/GetDynamicSearchResults',
    purchaseOrderSupplierSearchPayload(supplierName),
    token,
    version,
    name,
  );
  const supplierKey = combo_rows(res)[0]?.Key ?? '';
  if (!check(supplierKey, { [`${name}: finds the supplier`]: (k) => k !== '' })) {
    console.error(
      `[VU ${__VU}] search_purchase_order_supplier failed — no supplier matches "${supplierName}": ${body_text(res).slice(0, 200)}`,
    );
    fail(`${name}: supplier "${supplierName}" not found`);
  }
  return supplierKey;
}

export function save_recent_po_supplier(token: string, version: string, supplierKey: string, name = 'SaveRecentPoSupplier') {
  post_purchase_order('USISearchComboServer/SaveRecentlyUsed', purchaseOrderSupplierRecentlyUsedPayload(supplierKey), token, version, name);
}

export function refresh_po_supplier_fields(
  token: string,
  version: string,
  defaults: PurchaseOrderDefaults,
  windows: PurchaseOrderWindows,
  supplierKey: string,
  description: string,
  name = 'HandlePoSupplierFields',
) {
  const res = post_purchase_order(
    'GenericDetailServer/HandleDependentFields2',
    purchaseOrderSupplierFieldsPayload(defaults, windows, supplierKey, description),
    token,
    version,
    name,
  );
  const header = find_transport_table(res, 'PO100_DESC', name);
  const fields: PurchaseOrderSupplierFields = {
    tableName: header.TableName ?? '',
    description: get_cell(header, 'PO100_DESC'),
    supplierName: get_cell(header, 'POSupplierAccount_EV870_NAME'),
  };
  require_cells({ ...fields }, name);
  return fields;
}

export function search_po_department(token: string, version: string, name = 'SearchPoDepartment') {
  const res = post_purchase_order(
    'USISearchComboServer/GetDynamicSearchResults',
    purchaseOrderDepartmentSearchPayload(),
    token,
    version,
    name,
  );
  const departmentKey = combo_rows(res)[0]?.Key ?? '';
  if (!check(departmentKey, { [`${name}: finds the department`]: (k) => k !== '' })) {
    console.error(`[VU ${__VU}] search_po_department failed — ${body_text(res).slice(0, 200)}`);
    fail(`${name}: no department found`);
  }
  return departmentKey;
}

export function refresh_po_department_fields(
  token: string,
  version: string,
  defaults: PurchaseOrderDefaults,
  windows: PurchaseOrderWindows,
  supplierKey: string,
  departmentKey: string,
  fields: PurchaseOrderSupplierFields,
  name = 'HandlePoDepartmentFields',
) {
  const res = post_purchase_order(
    'GenericDetailServer/HandleDependentFields2',
    purchaseOrderDepartmentFieldsPayload(
      defaults,
      windows,
      supplierKey,
      departmentKey,
      fields.description,
      fields.supplierName,
      fields.tableName,
    ),
    token,
    version,
    name,
  );
  find_transport_table(res, 'PO100_DESC', name);
}

export function save_purchase_order(
  token: string,
  version: string,
  defaults: PurchaseOrderDefaults,
  windows: PurchaseOrderWindows,
  supplierKey: string,
  departmentKey: string,
  fields: PurchaseOrderSupplierFields,
  name = 'SavePurchaseOrder',
) {
  const res = post_purchase_order(
    'GenericDetailServer/Save2',
    purchaseOrderSavePayload(defaults, windows, supplierKey, departmentKey, fields.description, fields.supplierName, fields.tableName),
    token,
    version,
    name,
  );
  const result = save_result(res);
  report_save(result, name);
  const poNbr = /^10\|(\d+)$/.exec(result?.AddedRowKeys?.[0] ?? '')?.[1] ?? '';
  if (!check(poNbr, { [`${name}: returns the new purchase order number`]: (n) => n !== '' })) {
    console.error(`[VU ${__VU}] save_purchase_order failed — ${JSON.stringify(result).slice(0, 300)}`);
    fail(`${name}: no purchase order number in AddedRowKeys`);
  }
  return poNbr;
}

export function open_purchase_order_detail(
  token: string,
  version: string,
  windows: PurchaseOrderWindows,
  poNbr: string,
  columnStamp: string,
  name = 'OpenPurchaseOrderDetail',
) {
  const res = post_purchase_order(
    'GenericDetailServer/GetInitialData2',
    purchaseOrderDetailPayload(windows, poNbr, columnStamp),
    token,
    version,
    name,
  );
  const detailStamp = string_at(res, 6);
  const ok = check(res, {
    [`${name}: echoes the purchase order`]: (r) => body_text(r).includes(`10|${poNbr}`),
    [`${name}: returns the detail stamp`]: () => /^\d{4}-\d{2}-\d{2} /.test(detailStamp),
  });
  if (!ok) {
    console.error(`[VU ${__VU}] open_purchase_order_detail failed — PO ${poNbr}, stamp "${detailStamp}"`);
    fail(`${name}: purchase order ${poNbr} not opened`);
  }
  return detailStamp;
}

export function open_po_items_grid(token: string, version: string, windows: PurchaseOrderWindows, poNbr: string, name = 'OpenPoItemsGrid') {
  post_purchase_order('USIDataGridServer/GetInitialData2', purchaseOrderItemsGridPayload(windows, poNbr), token, version, name);
}

export function open_po_items_search(
  token: string,
  version: string,
  windows: PurchaseOrderWindows,
  poNbr: string,
  resultsCount: number,
  name = 'OpenPoItemsSearch',
) {
  post_purchase_order(
    'GenericSearchServer/GetInitialData2',
    purchaseOrderItemsSearchPayload(windows, poNbr, resultsCount),
    token,
    version,
    name,
  );
}

export function open_po_item_form(
  token: string,
  version: string,
  defaults: PurchaseOrderDefaults,
  windows: PurchaseOrderWindows,
  supplierKey: string,
  poNbr: string,
  itemFormStamp: string,
  name = 'OpenPoItemForm',
) {
  post_purchase_order(
    'GenericDetailServer/GetInitialData2',
    purchaseOrderItemFormPayload(defaults, windows, supplierKey, poNbr, itemFormStamp),
    token,
    version,
    name,
  );
}

export function search_po_item(token: string, version: string, itemName: string, name = 'SearchPoItem') {
  const res = post_purchase_order(
    'USISearchComboServer/GetDynamicSearchResults',
    purchaseOrderItemSearchPayload(itemName),
    token,
    version,
    name,
  );
  const itemKey = combo_rows(res).find((row) => !row.Key.startsWith(NON_INVENTORY_PREFIX))?.Key ?? '';
  if (!check(itemKey, { [`${name}: finds an inventory item`]: (k) => k !== '' })) {
    console.error(`[VU ${__VU}] search_po_item failed — no inventory item matches "${itemName}": ${body_text(res).slice(0, 200)}`);
    fail(`${name}: item "${itemName}" not found`);
  }
  return itemKey;
}

export function save_recent_po_item(token: string, version: string, itemKey: string, name = 'SaveRecentPoItem') {
  post_purchase_order('USISearchComboServer/SaveRecentlyUsed', purchaseOrderItemRecentlyUsedPayload(itemKey), token, version, name);
}

export function refresh_po_item_selection(token: string, version: string, ctx: PurchaseOrderContext, name = 'HandlePoItemSelection') {
  const res = post_purchase_order(
    'GenericDetailServer/HandleDependentFields2',
    purchaseOrderItemSelectFieldsPayload(ctx.defaults, ctx.windows, ctx.supplierKey, ctx.departmentKey, ctx.itemKey, ctx.poNbr),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'PO101_ITEM_DESC', name);
  const selection = {
    tableName: table.TableName ?? '',
    itemDesc: get_cell(table, 'PO101_ITEM_DESC'),
    major: get_cell(table, 'PO101_MAJOR'),
  };
  require_cells({ tableName: selection.tableName, itemDesc: selection.itemDesc }, name);
  return selection;
}

export function refresh_po_item_quantity(
  token: string,
  version: string,
  ctx: PurchaseOrderContext,
  item: PurchaseOrderItemCells,
  quantity: string,
  name = 'HandlePoItemQuantity',
) {
  const res = post_purchase_order(
    'GenericDetailServer/HandleDependentFields2',
    purchaseOrderItemQuantityFieldsPayload(
      ctx.defaults,
      ctx.windows,
      item,
      ctx.supplierKey,
      ctx.departmentKey,
      ctx.itemKey,
      ctx.poNbr,
      ctx.tableName,
      quantity,
    ),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'PO101_QTY', name);
  const echoed = get_cell(table, 'PO101_QTY');
  require_cells({ quantity: echoed }, name);
  return echoed;
}

export function refresh_po_item_rate(
  token: string,
  version: string,
  ctx: PurchaseOrderContext,
  item: PurchaseOrderItemCells,
  rate: string,
  name = 'HandlePoItemRate',
) {
  const res = post_purchase_order(
    'GenericDetailServer/HandleDependentFields2',
    purchaseOrderItemRateFieldsPayload(
      ctx.defaults,
      ctx.windows,
      item,
      ctx.supplierKey,
      ctx.departmentKey,
      ctx.itemKey,
      ctx.poNbr,
      ctx.tableName,
      rate,
    ),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'PO101_UNIT_COST', name);
  const costs = {
    taxesAmtEx: get_cell(table, 'PO101_TAXES_AMT_EX'),
    taxesAmtIn: get_cell(table, 'PO101_TAXES_AMT_IN'),
    extCost: get_cell(table, 'PO101_EXT_COST'),
    unitCost: get_cell(table, 'PO101_UNIT_COST'),
    unitCostInc: get_cell(table, 'PO101_UNIT_COST_INC'),
    cUnitCost: get_cell(table, 'cUNIT_COST'),
    cExtCost: get_cell(table, 'cEXT_COST'),
  };
  require_cells(costs, name);
  return costs;
}

export function refresh_po_item_gl_account(
  token: string,
  version: string,
  ctx: PurchaseOrderContext,
  item: PurchaseOrderItemCells,
  name = 'HandlePoItemGlAccount',
) {
  const res = post_purchase_order(
    'GenericDetailServer/HandleDependentFields2',
    purchaseOrderItemCostFieldsPayload(
      ctx.defaults,
      ctx.windows,
      item,
      ctx.supplierKey,
      ctx.departmentKey,
      ctx.itemKey,
      ctx.poNbr,
      ctx.tableName,
    ),
    token,
    version,
    name,
  );
  find_transport_table(res, 'PO101_ITEM_DESC', name);
}

export function validate_po_gl_account(token: string, version: string, name = 'ValidatePoGlAccount') {
  const res = post_purchase_order('USIGLAccountServer/ValidateGLAccount', purchaseOrderGlAccountPayload(), token, version, name);
  if (!check(json_at(res, 0), { [`${name}: accepts the GL account`]: (valid) => valid === true })) {
    console.error(`[VU ${__VU}] validate_po_gl_account failed — ${body_text(res).slice(0, 200)}`);
    fail(`${name}: GL account rejected`);
  }
}

export function save_purchase_order_item(
  token: string,
  version: string,
  ctx: PurchaseOrderContext,
  item: PurchaseOrderItemCells,
  name = 'SavePurchaseOrderItem',
) {
  const res = post_purchase_order(
    'GenericDetailServer/Save2',
    purchaseOrderItemSavePayload(
      ctx.defaults,
      ctx.windows,
      item,
      ctx.supplierKey,
      ctx.departmentKey,
      ctx.itemKey,
      ctx.poNbr,
      ctx.tableName,
    ),
    token,
    version,
    name,
  );
  const result = save_result(res);
  report_save(result, name);
  if (!check(result, { [`${name}: adds the item row to the order`]: (r) => (r?.AddedRowKeys?.[0] ?? '').startsWith(`10|${ctx.poNbr}|`) })) {
    console.error(`[VU ${__VU}] save_purchase_order_item failed — ${JSON.stringify(result).slice(0, 300)}`);
    fail(`${name}: item row not added to purchase order ${ctx.poNbr}`);
  }
}

export function refresh_po_items_grid(
  token: string,
  version: string,
  windows: PurchaseOrderWindows,
  poNbr: string,
  name = 'RefreshPoItemsGrid',
) {
  post_purchase_order('USIDataGridServer/GetInitialData2', purchaseOrderItemsGridRefreshPayload(windows, poNbr), token, version, name);
}
