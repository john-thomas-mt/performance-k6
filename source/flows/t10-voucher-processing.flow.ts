import { group } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  get_main_menu_data,
  getMainMenuDataThresholds,
  get_contact_column_stamp,
  open_voucher_list,
  reopen_voucher_list,
  open_voucher_grid,
  reopen_voucher_grid,
  read_voucher_list,
  open_voucher_batch_form,
  save_voucher_batch,
  open_voucher_add_form,
  open_voucher_add_grids,
  open_voucher_add_searches,
  search_voucher_supplier,
  save_recent_voucher_supplier,
  refresh_voucher_supplier_fields,
  save_voucher,
  open_voucher_edit_form,
  open_voucher_edit_grids,
  open_voucher_edit_po_detail_search,
  open_voucher_edit_section_search,
  refresh_voucher_edit_search,
  can_add_voucher_po_items,
  open_voucher_po_lines_form,
  open_voucher_po_lines_grid,
  read_voucher_po_lines,
  open_voucher_po_lines_search,
  save_voucher_po_line,
  read_voucher_detail,
  read_voucher_detail_grid,
  can_post_voucher_batch,
  open_voucher_post_form,
  post_voucher_batch,
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
import {
  voucherProcessingChrome,
  voucherProcessingStatic,
  voucherProcessingTransport,
  voucherProcessing,
} from '../utils/exports/data.exp.ts';
import { User, SetupData, FidelityLevel, VoucherProcessingWindows } from '../utils/exports/types.exp.ts';

export const voucherProcessingThresholds = {
  ...getMainMenuDataThresholds,
  'http_req_duration{name:GetVoucherListObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherList}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherGrid}': ['avg<4000'],
  'http_req_duration{name:GetVoucherFormObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherBatchForm}': ['avg<4000'],
  'http_req_duration{name:SaveVoucherBatch}': ['avg<4000'],
  'http_req_duration{name:ReopenVoucherList}': ['avg<4000'],
  'http_req_duration{name:ReopenVoucherGrid}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherAddForm}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherAddGrid}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherAddSearch}': ['avg<4000'],
  'http_req_duration{name:SearchVoucherSupplier}': ['avg<4000'],
  'http_req_duration{name:SaveRecentVoucherSupplier}': ['avg<4000'],
  'http_req_duration{name:HandleVoucherSupplierFields}': ['avg<4000'],
  'http_req_duration{name:SaveVoucher}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherEditForm}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherEditGrid}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherEditPoDetailSearch}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherEditSectionSearch}': ['avg<4000'],
  'http_req_duration{name:CanAddVoucherPoItems}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherPoLinesForm}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherPoLinesGrid}': ['avg<4000'],
  'http_req_duration{name:ReadVoucherPoLines}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherPoLinesSearch}': ['avg<4000'],
  'http_req_duration{name:SaveVoucherPoLine}': ['avg<4000'],
  'http_req_duration{name:ReopenVoucherEditForm}': ['avg<4000'],
  'http_req_duration{name:ReopenVoucherEditGrid}': ['avg<4000'],
  'http_req_duration{name:ReopenVoucherEditPoDetailSearch}': ['avg<4000'],
  'http_req_duration{name:RefreshVoucherEditSearch}': ['avg<4000'],
  'http_req_duration{name:ReadVoucherDetail}': ['avg<4000'],
  'http_req_duration{name:ReadVoucherDetailGrid}': ['avg<4000'],
  'http_req_duration{name:PostVoucherBatch}': ['avg<4000'],
  'http_req_duration{name:ReadPostedVoucherList}': ['avg<4000'],
  'http_req_duration{name:ReturnVoucherList}': ['avg<4000'],
  'http_req_duration{name:ReturnVoucherGrid}': ['avg<4000'],
  'http_req_duration{name:ReadReturnedVoucherList}': ['avg<4000'],
  'http_req_duration{name:CanPostVoucherBatch}': ['avg<4000'],
  'http_req_duration{name:OpenVoucherPostForm}': ['avg<4000'],
};

type Subs = { [token: string]: string };

const VOUCHER_LIST_OBJECT_ID = 1138;
const VOUCHER_FORM_OBJECT_ID = 1106;
const EDIT_SEARCH_RESULTS_BEFORE_PO_LINE = 0;
const EDIT_SEARCH_RESULTS_AFTER_PO_LINE = 1;

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, voucherProcessingChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(voucherProcessingStatic[step] ?? []);
      fire_transport(token, version, voucherProcessingTransport[step] ?? [], subs);
    }
  }
}

export function voucher_processing_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const subs: Subs = {};
  const iter = exec.scenario.iterationInTest;
  const supplierName = pick_pool_value(voucherProcessing);
  const description = `k6-t10-voucher-batch-${__VU}${iter}${Date.now()}`;
  const vendorInvoice = String(1000000 + Math.floor(Math.random() * 9000000));
  const wdwBase = 9000000 + iter * 10;
  const windows: VoucherProcessingWindows = {
    listWdwid: `AP${wdwBase}`,
    batchAddWdwid: `AP${wdwBase + 1}`,
    batchEditWdwid: `AP${wdwBase + 2}`,
    voucherAddWdwid: `AP${wdwBase + 3}`,
    voucherEditWdwid: `AP${wdwBase + 4}`,
    poSelectWdwid: `AP${wdwBase + 5}`,
    postWdwid: `AP${wdwBase + 6}`,
  };

  group('T010_VoucherProcessing_01_Launch', () => {
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

  const { bearerToken } = login_to_events(user, data.version, 'T010_VoucherProcessing_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  let listStamp = '';
  group('T010_VoucherProcessing_03_SearchVoucher', () => {
    get_main_menu_data(bearerToken, data.version);
    listStamp = get_contact_column_stamp(bearerToken, data.version, VOUCHER_LIST_OBJECT_ID, 'GetVoucherListObjectColumns');
    subs.C_SearchVoucher_Timestamp1 = listStamp;
    open_voucher_list(bearerToken, data.version, windows);
    open_voucher_grid(bearerToken, data.version, windows);
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  let formStamp = '';
  const defaults = group('T010_VoucherProcessing_04_ClickAddButton', () => {
    formStamp = get_contact_column_stamp(bearerToken, data.version, VOUCHER_FORM_OBJECT_ID, 'GetVoucherFormObjectColumns');
    subs.C_ClickAddButton_Timestamp1 = formStamp;
    const batchDefaults = open_voucher_batch_form(bearerToken, data.version, windows, listStamp);
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
    return batchDefaults;
  });
  think();

  let batchId = '';
  const addTable = group('T010_VoucherProcessing_05_ClickPOAdd', () => {
    batchId = save_voucher_batch(bearerToken, data.version, windows, description, defaults);
    subs.C_BatchID = batchId;
    reopen_voucher_list(bearerToken, data.version, windows);
    reopen_voucher_grid(bearerToken, data.version, windows);
    const table = open_voucher_add_form(bearerToken, data.version, windows, formStamp, batchId);
    open_voucher_add_grids(bearerToken, data.version, windows, batchId);
    open_voucher_add_searches(bearerToken, data.version, windows, batchId);
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
    return table;
  });
  think();

  let supplierKey = '';
  let voucher = '';
  group('T010_VoucherProcessing_06_AddSupplier', () => {
    const supplier = search_voucher_supplier(bearerToken, data.version, supplierName);
    supplierKey = supplier.key;
    subs.C_SupplierKey = supplierKey;
    save_recent_voucher_supplier(bearerToken, data.version, supplierKey);
    const supplierTable = refresh_voucher_supplier_fields(bearerToken, data.version, windows, batchId, supplierKey, addTable, defaults);
    voucher = save_voucher(bearerToken, data.version, windows, batchId, supplierTable, vendorInvoice);
    subs.C_OrderCode = voucher;
    open_voucher_edit_form(bearerToken, data.version, windows, formStamp, batchId, voucher);
    open_voucher_edit_grids(bearerToken, data.version, windows, batchId, voucher);
    open_voucher_edit_po_detail_search(bearerToken, data.version, windows, batchId, voucher, EDIT_SEARCH_RESULTS_BEFORE_PO_LINE);
    open_voucher_edit_section_search(bearerToken, data.version, windows, batchId, voucher, EDIT_SEARCH_RESULTS_BEFORE_PO_LINE);
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  const poForm = group('T010_VoucherProcessing_07_AddPurchaseOrder', () => {
    can_add_voucher_po_items(bearerToken, data.version, windows, batchId, voucher, supplierKey);
    const table = open_voucher_po_lines_form(bearerToken, data.version, windows, formStamp, voucher, supplierKey);
    const total = open_voucher_po_lines_grid(bearerToken, data.version, windows, voucher, supplierKey);
    const line = read_voucher_po_lines(bearerToken, data.version, windows, voucher, supplierKey, total, iter);
    open_voucher_po_lines_search(bearerToken, data.version, windows, voucher, supplierKey);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
    return { table, line };
  });
  think();

  group('T010_VoucherProcessing_08_SelectPOfromList', () => {
    save_voucher_po_line(bearerToken, data.version, windows, voucher, supplierKey, poForm.table, poForm.line);
    open_voucher_edit_form(bearerToken, data.version, windows, formStamp, batchId, voucher, 'ReopenVoucherEditForm');
    open_voucher_edit_grids(bearerToken, data.version, windows, batchId, voucher, 'ReopenVoucherEditGrid');
    open_voucher_edit_po_detail_search(
      bearerToken,
      data.version,
      windows,
      batchId,
      voucher,
      EDIT_SEARCH_RESULTS_AFTER_PO_LINE,
      'ReopenVoucherEditPoDetailSearch',
    );
    refresh_voucher_edit_search(bearerToken, data.version, windows, batchId, voucher);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();

  group('T010_VoucherProcessing_09_ClickPOSave', () => {
    read_voucher_detail(bearerToken, data.version, windows, batchId, voucher);
    read_voucher_detail_grid(bearerToken, data.version, windows, batchId, voucher);
    chrome_and_static(bearerToken, data.version, level, ['09'], subs);
  });
  think();

  group('T010_VoucherProcessing_10_GoBackToVoucherProcessingScreen', () => {
    reopen_voucher_list(bearerToken, data.version, windows, 'ReturnVoucherList');
    reopen_voucher_grid(bearerToken, data.version, windows, 'ReturnVoucherGrid');
    read_voucher_list(bearerToken, data.version, windows, 'ReadReturnedVoucherList');
    read_voucher_list(bearerToken, data.version, windows, 'ReadReturnedVoucherList');
    chrome_and_static(bearerToken, data.version, level, ['10'], subs);
  });
  think();

  const postForm = group('T010_VoucherProcessing_11_SelectVoucherAndRightClicktoPost', () => {
    can_post_voucher_batch(bearerToken, data.version, windows, batchId);
    const form = open_voucher_post_form(bearerToken, data.version, windows, listStamp, batchId);
    chrome_and_static(bearerToken, data.version, level, ['11'], subs);
    return form;
  });
  think();

  group('T010_VoucherProcessing_12_PostBatch', () => {
    post_voucher_batch(bearerToken, data.version, windows, batchId, postForm);
    read_voucher_list(bearerToken, data.version, windows, 'ReadPostedVoucherList');
    chrome_and_static(bearerToken, data.version, level, ['12'], subs);
  });
  think();

  group('T010_VoucherProcessing_13_Logout', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['13'], subs);
  });
  think();
}
