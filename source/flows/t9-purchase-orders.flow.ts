import { group } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  get_main_menu_data,
  getMainMenuDataThresholds,
  get_contact_column_stamp,
  open_purchase_orders_list,
  open_purchase_orders_grid,
  open_purchase_order_form,
  search_purchase_order_supplier,
  save_recent_po_supplier,
  refresh_po_supplier_fields,
  search_po_department,
  refresh_po_department_fields,
  save_purchase_order,
  open_purchase_order_detail,
  open_po_items_grid,
  open_po_items_search,
  open_po_item_form,
  search_po_item,
  save_recent_po_item,
  refresh_po_item_selection,
  refresh_po_item_quantity,
  refresh_po_item_rate,
  refresh_po_item_gl_account,
  validate_po_gl_account,
  save_purchase_order_item,
  refresh_po_items_grid,
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
  pick_pool_value,
} from '../utils/exports/helpers.exp.ts';
import { purchaseOrdersChrome, purchaseOrdersStatic, purchaseOrdersTransport, purchaseOrders } from '../utils/exports/data.exp.ts';
import { User, SetupData, FidelityLevel, PurchaseOrderContext, PurchaseOrderItemCells } from '../utils/exports/types.exp.ts';

export const purchaseOrdersThresholds = {
  ...getMainMenuDataThresholds,
  'http_req_duration{name:GetPurchaseOrderObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenPurchaseOrdersList}': ['avg<4000'],
  'http_req_duration{name:OpenPurchaseOrdersGrid}': ['avg<4000'],
  'http_req_duration{name:OpenPurchaseOrderForm}': ['avg<4000'],
  'http_req_duration{name:SearchPoSupplier}': ['avg<4000'],
  'http_req_duration{name:SaveRecentPoSupplier}': ['avg<4000'],
  'http_req_duration{name:HandlePoSupplierFields}': ['avg<4000'],
  'http_req_duration{name:SearchPoDepartment}': ['avg<4000'],
  'http_req_duration{name:HandlePoDepartmentFields}': ['avg<4000'],
  'http_req_duration{name:SavePurchaseOrder}': ['avg<4000'],
  'http_req_duration{name:OpenPurchaseOrderDetail}': ['avg<4000'],
  'http_req_duration{name:OpenPoItemsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenPoItemsSearch}': ['avg<4000'],
  'http_req_duration{name:OpenPoItemForm}': ['avg<4000'],
  'http_req_duration{name:SearchPoItem}': ['avg<4000'],
  'http_req_duration{name:SaveRecentPoItem}': ['avg<4000'],
  'http_req_duration{name:HandlePoItemSelection}': ['avg<4000'],
  'http_req_duration{name:HandlePoItemQuantity}': ['avg<4000'],
  'http_req_duration{name:HandlePoItemRate}': ['avg<4000'],
  'http_req_duration{name:HandlePoItemGlAccount}': ['avg<4000'],
  'http_req_duration{name:ValidatePoGlAccount}': ['avg<4000'],
  'http_req_duration{name:SavePurchaseOrderItem}': ['avg<4000'],
  'http_req_duration{name:RefreshPurchaseOrderDetail}': ['avg<4000'],
  'http_req_duration{name:RefreshPoItemsGrid}': ['avg<4000'],
  'http_req_duration{name:RefreshPoItemsSearch}': ['avg<4000'],
};

type Subs = { [token: string]: string };

const PURCHASE_ORDER_OBJECT_ID = 81;

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, purchaseOrdersChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(purchaseOrdersStatic[step] ?? []);
      fire_transport(token, version, purchaseOrdersTransport[step] ?? [], subs);
    }
  }
}

export function purchase_orders_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const subs: Subs = {};
  const iter = exec.scenario.iterationInTest;
  const row = pick_pool_value(purchaseOrders);
  const description = `k6-t9-purchase-order-${__VU}${iter}${Date.now()}`;
  const wdwBase = 9000000 + iter * 10;
  const windows = {
    addWdwid: `PO${wdwBase}`,
    editWdwid: `PO${wdwBase + 1}`,
    itemWdwid: `PO${wdwBase + 2}`,
    itemEditWdwid: `PO${wdwBase + 3}`,
    listWdwid: `PO${wdwBase + 4}`,
    accountWdwid: `OA${wdwBase + 5}`,
  };
  const quantity = String(1 + Math.floor(Math.random() * 5));
  const rate = String(5 + 5 * Math.floor(Math.random() * 20));

  group('T009_PurchaseOrder_01_Launch', () => {
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

  const { bearerToken } = login_to_events(user, data.version, 'T009_PurchaseOrder_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  let columnStamp = '';
  group('T009_PurchaseOrder_03_SearchPOTab', () => {
    get_main_menu_data(bearerToken, data.version);
    columnStamp = get_contact_column_stamp(bearerToken, data.version, PURCHASE_ORDER_OBJECT_ID, 'GetPurchaseOrderObjectColumns');
    subs.C_SearchPOTab_Timestamp1 = columnStamp;
    open_purchase_orders_list(bearerToken, data.version, windows);
    open_purchase_orders_grid(bearerToken, data.version, windows);
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  const defaults = group('T009_PurchaseOrder_04_ClickAddPurchaseOrders', () => {
    const form = open_purchase_order_form(bearerToken, data.version, windows, columnStamp);
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
    return form;
  });
  think();

  let supplierKey = '';
  let departmentKey = '';
  let poNbr = '';
  let itemFormStamp = '';
  group('T009_PurchaseOrder_05_EnterPODetailsAndSave', () => {
    supplierKey = search_purchase_order_supplier(bearerToken, data.version, row.SupplierName);
    save_recent_po_supplier(bearerToken, data.version, supplierKey);
    const fields = refresh_po_supplier_fields(bearerToken, data.version, defaults, windows, supplierKey, description);
    departmentKey = search_po_department(bearerToken, data.version);
    refresh_po_department_fields(bearerToken, data.version, defaults, windows, supplierKey, departmentKey, fields);
    poNbr = save_purchase_order(bearerToken, data.version, defaults, windows, supplierKey, departmentKey, fields);
    subs.C_PurchaseOrderNbr = poNbr;
    itemFormStamp = open_purchase_order_detail(bearerToken, data.version, windows, poNbr, columnStamp);
    subs.C_EnterPODetailsAndSave_Timestamp1 = itemFormStamp;
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  think();

  group('T009_PurchaseOrder_06_ClickAddPOItem', () => {
    open_po_items_grid(bearerToken, data.version, windows, poNbr);
    open_po_items_search(bearerToken, data.version, windows, poNbr, 0);
    open_po_item_form(bearerToken, data.version, defaults, windows, supplierKey, poNbr, itemFormStamp);
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  group('T009_PurchaseOrder_07_EnterPOIDetailsAndSave', () => {
    const itemKey = search_po_item(bearerToken, data.version, row.ItemName);
    save_recent_po_item(bearerToken, data.version, itemKey);
    const ctx: PurchaseOrderContext = { defaults, windows, supplierKey, departmentKey, itemKey, poNbr, tableName: '' };
    const selection = refresh_po_item_selection(bearerToken, data.version, ctx);
    ctx.tableName = selection.tableName;
    const item: PurchaseOrderItemCells = {
      itemDesc: selection.itemDesc,
      major: selection.major,
      quantity: '',
      taxesAmtEx: '',
      taxesAmtIn: '',
      extCost: '',
      unitCost: '',
      unitCostInc: '',
      cUnitCost: '',
      cExtCost: '',
    };
    item.quantity = refresh_po_item_quantity(bearerToken, data.version, ctx, item, quantity);
    Object.assign(item, refresh_po_item_rate(bearerToken, data.version, ctx, item, rate));
    refresh_po_item_gl_account(bearerToken, data.version, ctx, item);
    validate_po_gl_account(bearerToken, data.version);
    validate_po_gl_account(bearerToken, data.version);
    save_purchase_order_item(bearerToken, data.version, ctx, item);
    open_purchase_order_detail(bearerToken, data.version, windows, poNbr, columnStamp, 'RefreshPurchaseOrderDetail');
    refresh_po_items_grid(bearerToken, data.version, windows, poNbr);
    open_po_items_search(bearerToken, data.version, windows, poNbr, 1, 'RefreshPoItemsSearch');
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();

  group('T009_PurchaseOrder_08_Logout', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();
}
