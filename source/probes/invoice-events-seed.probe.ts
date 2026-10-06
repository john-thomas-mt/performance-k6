import { fail } from 'k6';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import { read_non_invoiced_orders, search_events, load_service_orders } from '../utils/exports/apis.exp.ts';
import {
  fetch_server_version,
  decrypt_users,
  get_cell,
  compare_record_fields,
  compare_record_count,
  eventIdentityFields,
  serviceOrderIdentityFields,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { PoolProbeSetup, NonInvoicedOrderRow } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const REF_PREFIX = __ENV.REF_PREFIX || 'Performance BookingEvent ';

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

function event_desc(row: NonInvoicedOrderRow) {
  return get_cell(row.table, 'OrderEvent_EV200_EVT_DESC');
}

function read_record(data: PoolProbeSetup, row: NonInvoicedOrderRow, side: string) {
  const desc = event_desc(row);
  const event = search_events(data.bearerToken, data.version, desc, `ProbeSeedEvent${side}`).find((e) => e.desc === desc);
  if (!event) fail(`${side}: event "${desc}" not found by search`);
  const orders = load_service_orders(data.bearerToken, data.version, event, `ProbeSeedOrders${side}`);
  const order = orders.find((o) => o.orderNbr === row.orderNbr);
  if (!order) fail(`${side}: order ${row.orderNbr} not under event "${desc}"`);
  return { event, orders, order };
}

export default function probe_invoice_events_seed(data: PoolProbeSetup) {
  const rows = read_non_invoiced_orders(data.bearerToken, data.version, 'ProbeNonInvoicedOrders');
  const reference = rows.find((r) => event_desc(r).startsWith(REF_PREFIX));
  const seeded = rows.find((r) => event_desc(r).startsWith(config.seedInvoiceEventPrefix));
  if (!reference) fail(`no non-invoiced order under a "${REF_PREFIX}" event: compare on an env NeoLoad's data run covered`);
  if (!seeded)
    fail(`no non-invoiced order under a "${config.seedInvoiceEventPrefix}" event: run source/seeds/invoice-events.seed.ts first`);

  console.log(
    `Comparing NeoLoad "${event_desc(reference)}" (order ${reference.orderNbr}) with k6 "${event_desc(seeded)}" (order ${seeded.orderNbr})`,
  );
  const neoload = read_record(data, reference, 'NeoLoad');
  const k6 = read_record(data, seeded, 'Seed');
  compare_record_fields('Event', neoload.event, k6.event, eventIdentityFields);
  compare_record_count('Service orders per event', neoload.orders.length, k6.orders.length);
  compare_record_fields('Service order', neoload.order, k6.order, serviceOrderIdentityFields);
}
