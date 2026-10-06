import { fail } from 'k6';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import { get_contact_column_stamp, read_purchase_order_detail } from '../utils/exports/apis.exp.ts';
import { fetch_server_version, decrypt_users, compare_record_fields, purchaseOrderIdentityFields } from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { PoolProbeSetup, PurchaseOrderWindows } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const REF_PO = __ENV.REF_PO;
const SEED_PO = __ENV.SEED_PO;
const PURCHASE_ORDER_OBJECT_ID = 81;

export const options: Options = {
  scenarios: {
    probe: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '10m',
    },
  },
  thresholds: { checks: ['rate==1'] },
};

export async function setup() {
  const cryptoKey = config.cryptoKey;
  if (!cryptoKey) {
    throw new Error('No decryption key — write temp/secret.json (npm run secret -- --key <pass>)');
  }
  const users = await decrypt_users(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const version = fetch_server_version();
  const { bearerToken } = login_to_events(users[0], version);
  return { version, bearerToken };
}

function read_record(data: PoolProbeSetup, poNbr: string, side: string, base: number) {
  const windows: PurchaseOrderWindows = {
    addWdwid: `PO${base}`,
    editWdwid: `PO${base + 1}`,
    itemWdwid: `PO${base + 2}`,
    itemEditWdwid: `PO${base + 3}`,
    listWdwid: `PO${base + 4}`,
    accountWdwid: `OA${base + 5}`,
  };
  const stamp = get_contact_column_stamp(data.bearerToken, data.version, PURCHASE_ORDER_OBJECT_ID, `ProbeColumns${side}`);
  return read_purchase_order_detail(data.bearerToken, data.version, windows, poNbr, stamp, `ProbeOpenPurchaseOrder${side}`).record;
}

export default function probe_purchase_orders_seed(data: PoolProbeSetup) {
  if (!REF_PO || !SEED_PO) {
    fail(
      'pass -e REF_PO=<a purchase order NeoLoad received, e.g. from variables/version_<ver>/P_<ver>_Count_VoucherProcessing.txt> -e SEED_PO=<a purchase order the k6 seed logged as received>',
    );
  }
  console.log(`Comparing NeoLoad purchase order ${REF_PO} with k6 seed purchase order ${SEED_PO}`);
  const neoload = read_record(data, REF_PO, 'NeoLoad', 9500000);
  const k6 = read_record(data, SEED_PO, 'Seed', 9500010);
  compare_record_fields('Purchase order', neoload, k6, purchaseOrderIdentityFields);
}
