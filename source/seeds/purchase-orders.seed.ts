import exec from 'k6/execution';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import {
  get_window_version,
  get_contact_column_stamp,
  open_purchase_order_form,
  search_purchase_order_supplier,
  save_recent_po_supplier,
  refresh_po_supplier_fields,
  search_po_department,
  refresh_po_department_fields,
  save_purchase_order,
  read_purchase_order_detail,
  search_po_item,
  save_recent_po_item,
  refresh_po_item_selection,
  refresh_po_item_quantity,
  refresh_po_item_rate,
  refresh_po_item_gl_account,
  validate_po_gl_account,
  save_purchase_order_item,
  approve_purchase_order,
  issue_purchase_order,
  open_purchase_order_receive_fields,
  receive_purchase_order,
} from '../utils/exports/apis.exp.ts';
import { fetch_server_version, decrypt_seed_users, pick_user, pick_pool_value } from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { PurchaseOrderContext, PurchaseOrderItemCells, SeedSetup, SeedSession } from '../utils/exports/types.exp.ts';
import { purchaseOrders, dataScriptVoucherProcessing } from '../utils/exports/data.exp.ts';

const SEED_ADD = __ENV.SEED_ADD ? Number(__ENV.SEED_ADD) : undefined;
const SEED_COUNT = SEED_ADD ?? Number(__ENV.SEED_COUNT || 50);
const SEED_VUS = Number(__ENV.SEED_VUS || 10);
const PURCHASE_ORDER_OBJECT_ID = 81;

export const options: Options = {
  scenarios: {
    seed: {
      executor: 'shared-iterations',
      vus: Math.min(SEED_VUS, SEED_COUNT),
      iterations: SEED_COUNT,
      maxDuration: __ENV.SEED_MAX_DURATION || '4h',
    },
  },
};

export async function setup() {
  const cryptoKey = config.cryptoKey;
  if (!cryptoKey) {
    throw new Error('No decryption key — write temp/secret.json (npm run secret -- --key <pass>)');
  }
  const users = await decrypt_seed_users(config.seedUsers, cryptoKey);
  const version = fetch_server_version();
  const shortfall = SEED_COUNT;

  console.log(`Server version: ${version}`);
  console.log(
    `Creating ${shortfall} "${config.seedVoucherPrefix}" purchase order(s), each approved, issued and received in full, with ${SEED_VUS} VU(s), each on its own session`,
  );
  return { version, users, shortfall };
}

let vuSession: SeedSession | null = null;

function seed_session(data: SeedSetup) {
  if (!vuSession) {
    const { bearerToken, encUserId } = login_to_events(pick_user(data.users), data.version);
    vuSession = {
      version: data.version,
      bearerToken,
      encUserId,
      windowVersion: get_window_version(bearerToken, data.version, 'AA3602', 'GetPurchaseOrderWindowInfo'),
    };
  }
  return vuSession;
}

export default function seed_purchase_orders(data: SeedSetup) {
  if (exec.scenario.iterationInTest >= data.shortfall) return;
  const { bearerToken, version, encUserId, windowVersion } = seed_session(data);
  const iter = exec.scenario.iterationInTest;
  const supplier = pick_pool_value(dataScriptVoucherProcessing);
  const item = pick_pool_value(purchaseOrders).ItemName;
  const description = `${config.seedVoucherPrefix}-${__VU}${iter}${Date.now()}`;
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

  const columnStamp = get_contact_column_stamp(bearerToken, version, PURCHASE_ORDER_OBJECT_ID, 'GetPurchaseOrderObjectColumns');
  const defaults = open_purchase_order_form(bearerToken, version, windows, columnStamp);

  const supplierKey = search_purchase_order_supplier(bearerToken, version, supplier);
  save_recent_po_supplier(bearerToken, version, supplierKey);
  const fields = refresh_po_supplier_fields(bearerToken, version, defaults, windows, supplierKey, description);
  const departmentKey = search_po_department(bearerToken, version);
  refresh_po_department_fields(bearerToken, version, defaults, windows, supplierKey, departmentKey, fields);
  const poNbr = save_purchase_order(bearerToken, version, defaults, windows, supplierKey, departmentKey, fields);
  const { searchKey } = read_purchase_order_detail(bearerToken, version, windows, poNbr, columnStamp);

  const itemKey = search_po_item(bearerToken, version, item);
  save_recent_po_item(bearerToken, version, itemKey);
  const ctx: PurchaseOrderContext = { defaults, windows, supplierKey, departmentKey, itemKey, poNbr, tableName: '' };
  const selection = refresh_po_item_selection(bearerToken, version, ctx);
  ctx.tableName = selection.tableName;
  const cells: PurchaseOrderItemCells = {
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
  cells.quantity = refresh_po_item_quantity(bearerToken, version, ctx, cells, quantity);
  Object.assign(cells, refresh_po_item_rate(bearerToken, version, ctx, cells, rate));
  refresh_po_item_gl_account(bearerToken, version, ctx, cells);
  validate_po_gl_account(bearerToken, version);
  validate_po_gl_account(bearerToken, version);
  save_purchase_order_item(bearerToken, version, ctx, cells);

  const stdCost = approve_purchase_order(bearerToken, version, `PO${wdwBase + 6}`, {
    poNbr,
    description,
    supplierKey,
    supplierName: fields.supplierName,
    orderDate: defaults.date,
    status: defaults.status,
    buyer: defaults.buyer,
    totalCost: cells.taxesAmtEx,
  });
  issue_purchase_order(bearerToken, version, `PO${wdwBase + 7}`, poNbr);

  const receiveFields = {
    poNbr,
    description,
    supplierKey,
    supplierName: fields.supplierName,
    orderDate: defaults.date,
    buyer: defaults.buyer,
    billTo: defaults.billTo,
    shipTo: defaults.shipTo,
    space: defaults.space,
    itemKey,
    itemDesc: cells.itemDesc,
    quantity: cells.quantity,
    unitCost: cells.unitCost,
    totalCost: cells.taxesAmtEx,
  };
  const receiveWdwid = `PO${wdwBase + 8}`;
  const updStamp = open_purchase_order_receive_fields(bearerToken, version, receiveWdwid, encUserId, windowVersion, receiveFields);
  receive_purchase_order(bearerToken, version, receiveWdwid, encUserId, windowVersion, receiveFields, stdCost, searchKey, updStamp);
  console.log(`[VU ${__VU}] Received purchase order ${poNbr} "${description}" from ${supplier}`);
}
