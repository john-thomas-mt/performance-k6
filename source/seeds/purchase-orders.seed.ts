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
  search_voucher_supplier,
  count_seeded_voucher_po_lines,
} from '../utils/exports/apis.exp.ts';
import { fetch_server_version, decrypt_seed_users, pick_user, pick_pool_value } from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import {
  PurchaseOrderContext,
  PurchaseOrderItemCells,
  PurchaseOrderSeedSetup,
  SeedSetup,
  SeedSession,
  User,
  VoucherProcessingWindows,
} from '../utils/exports/types.exp.ts';
import { purchaseOrders, dataScriptVoucherProcessing } from '../utils/exports/data.exp.ts';

const SEED_ADD = __ENV.SEED_ADD ? Number(__ENV.SEED_ADD) : undefined;
const SEED_COUNT = Number(__ENV.SEED_COUNT || 120);
const SEED_VUS = Number(__ENV.SEED_VUS || 10);
const PURCHASE_ORDER_OBJECT_ID = 81;
const SUPPLIERS = [...new Set(dataScriptVoucherProcessing)];
const PER_SUPPLIER_TARGET = Math.ceil(SEED_COUNT / SUPPLIERS.length);
const MAX_ITERATIONS = SEED_ADD ?? PER_SUPPLIER_TARGET * SUPPLIERS.length;

export const options: Options = {
  scenarios: {
    seed: {
      executor: 'shared-iterations',
      vus: Math.min(SEED_VUS, MAX_ITERATIONS),
      iterations: MAX_ITERATIONS,
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
  const existing = count_voucherable_orders(users[0], version);
  const supplierPlan =
    SEED_ADD === undefined ? top_up_plan(existing) : Array.from({ length: SEED_ADD }, (slot, i) => SUPPLIERS[i % SUPPLIERS.length]);

  console.log(`Server version: ${version}`);
  console.log(
    `"${config.seedVoucherPrefix}" voucherable purchase order lines per supplier: ${SUPPLIERS.map((s) => `${s} ${existing[s]}`).join(', ')}; ${SEED_ADD === undefined ? `target ${PER_SUPPLIER_TARGET} each` : 'adding'}, creating ${supplierPlan.length} (each approved, issued and received in full) with ${SEED_VUS} VU(s), each on its own session`,
  );
  return { version, users, shortfall: supplierPlan.length, supplierPlan };
}

function top_up_plan(existing: { [supplierName: string]: number }) {
  const plan: string[] = [];
  for (let round = 0; round < PER_SUPPLIER_TARGET; round++) {
    for (const supplier of SUPPLIERS) {
      if (existing[supplier] + round < PER_SUPPLIER_TARGET) plan.push(supplier);
    }
  }
  return plan;
}

function count_voucherable_orders(user: User, version: string) {
  const { bearerToken } = login_to_events(user, version);
  const windows: VoucherProcessingWindows = {
    listWdwid: 'AP9000000',
    batchAddWdwid: 'AP9000001',
    batchEditWdwid: 'AP9000002',
    voucherAddWdwid: 'AP9000003',
    voucherEditWdwid: 'AP9000004',
    poSelectWdwid: 'AP9000005',
    postWdwid: 'AP9000006',
  };
  const counts: { [supplierName: string]: number } = {};
  for (const supplierName of SUPPLIERS) {
    const { key } = search_voucher_supplier(bearerToken, version, supplierName, 'CountVoucherSupplier');
    counts[supplierName] = count_seeded_voucher_po_lines(bearerToken, version, windows, '0', key);
  }
  return counts;
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

export default function seed_purchase_orders(data: PurchaseOrderSeedSetup) {
  const iter = exec.scenario.iterationInTest;
  if (iter >= data.shortfall) return;
  const { bearerToken, version, encUserId, windowVersion } = seed_session(data);
  const supplier = data.supplierPlan[iter];
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
