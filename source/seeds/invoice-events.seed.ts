import exec from 'k6/execution';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import {
  get_window_version,
  stage_booking_space,
  open_booking_form,
  search_booking_account,
  refresh_booking_account_fields,
  save_booking,
  read_event_functions,
  stage_event_function,
  save_event_function,
  get_contact_column_stamp,
  open_service_order_form,
  refresh_service_order_event_fields,
  save_contact_service_order,
  confirm_contact_service_order,
  can_complete_work_orders,
  complete_work_orders,
  close_service_order,
  read_non_invoiced_orders,
} from '../utils/exports/apis.exp.ts';
import {
  fetch_server_version,
  decrypt_users,
  pick_user,
  pick_pool_value,
  format_retrieve_stamp,
  stamp_to_epoch,
  today_midnight_utc,
  get_cell,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { SeedSetup, SeedSession } from '../utils/exports/types.exp.ts';
import { userCredentials, bookingAccountNames, bookingSpaces, random_future_date } from '../utils/exports/data.exp.ts';

const SEED_ADD = __ENV.SEED_ADD ? Number(__ENV.SEED_ADD) : undefined;
const SEED_COUNT = SEED_ADD ?? Number(__ENV.SEED_COUNT || 250);
const SEED_VUS = Number(__ENV.SEED_VUS || 10);
const SERVICE_ORDER_OBJECT_ID = 456;

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
  const users = await decrypt_users(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const version = fetch_server_version();
  const { bearerToken } = login_to_events(users[0], version);
  const existing = read_non_invoiced_orders(bearerToken, version, 'CountSeedOrders').filter((r) =>
    get_cell(r.table, 'OrderEvent_EV200_EVT_DESC').startsWith(config.seedInvoiceEventPrefix),
  ).length;
  const shortfall = SEED_ADD ?? Math.max(0, SEED_COUNT - existing);

  console.log(`Server version: ${version}`);
  console.log(
    `"${config.seedInvoiceEventPrefix}" non-invoiced orders: ${existing} found, ${SEED_ADD === undefined ? `target ${SEED_COUNT}` : 'adding'}, creating ${shortfall}`,
  );
  console.log(
    `Booking ${shortfall} event(s), each with a function and one completed, closed service order, with ${SEED_VUS} VU(s), each signed in as its own pool user`,
  );
  return { version, users, shortfall };
}

let vuSession: SeedSession | null = null;

function seed_session(data: SeedSetup) {
  if (!vuSession) {
    const { bearerToken, encUserId } = login_to_events(pick_user(data.users), data.version);
    vuSession = { version: data.version, bearerToken, encUserId, windowVersion: get_window_version(bearerToken, data.version, 'EB8776') };
  }
  return vuSession;
}

function add_service_order(data: SeedSession, evtId: string) {
  const formStamp = get_contact_column_stamp(data.bearerToken, data.version, SERVICE_ORDER_OBJECT_ID, 'GetServiceOrderObjectColumns');
  const form = open_service_order_form(data.bearerToken, data.version, formStamp);
  const header = refresh_service_order_event_fields(data.bearerToken, data.version, form, evtId, stamp_to_epoch(formStamp));
  const start = format_retrieve_stamp(header.start);
  const end = format_retrieve_stamp(header.end);
  const saved = save_contact_service_order(data.bearerToken, data.version, start, end, evtId, header.orderAcct);
  return saved.upsell
    ? confirm_contact_service_order(data.bearerToken, data.version, start, end, evtId, header.orderAcct, saved.upsell)
    : saved.orderNbr;
}

export default function seed_invoice_events(data: SeedSetup) {
  if (exec.scenario.iterationInTest >= data.shortfall) return;
  const session = seed_session(data);
  const { bearerToken, version, encUserId, windowVersion } = session;
  const iter = exec.scenario.iterationInTest;
  const epoch = Date.now();
  const date = random_future_date();
  const space = pick_pool_value(bookingSpaces);
  const description = `${config.seedInvoiceEventPrefix}-${__VU}${iter}${epoch}`;

  const spaceTable = stage_booking_space(bearerToken, version, date, space);
  const form = open_booking_form(bearerToken, version, date);
  const account = search_booking_account(bearerToken, version, pick_pool_value(bookingAccountNames));
  const contact = refresh_booking_account_fields(bearerToken, version, form, date, account);
  const booked = save_booking(bearerToken, version, form, spaceTable, date, description, account, contact);

  const stamp = read_event_functions(bearerToken, version, space, account, booked.evtId, booked.addedRowKey, encUserId, windowVersion);
  const funcTable = stage_event_function(
    bearerToken,
    version,
    date,
    space,
    account,
    booked.evtId,
    booked.addedRowKey,
    encUserId,
    windowVersion,
    format_retrieve_stamp(stamp),
  );
  save_event_function(
    bearerToken,
    version,
    funcTable,
    `k6-t8-function-${__VU}${iter}${epoch}`,
    space,
    account,
    booked.evtId,
    booked.addedRowKey,
    encUserId,
    windowVersion,
    epoch,
  );

  const orderNbr = add_service_order(session, booked.evtId);
  can_complete_work_orders(bearerToken, version);
  complete_work_orders(bearerToken, version, orderNbr);
  close_service_order(bearerToken, version, orderNbr, today_midnight_utc());
  console.log(`[VU ${__VU}] Booked "${description}" (${booked.evtId}) with closed service order ${orderNbr}`);
}
