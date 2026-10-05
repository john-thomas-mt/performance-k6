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
} from '../utils/exports/apis.exp.ts';
import {
  fetch_server_version,
  decrypt_users,
  pick_pool_value,
  format_retrieve_stamp,
  stamp_to_epoch,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { ServiceOrderSeedSetup } from '../utils/exports/types.exp.ts';
import { userCredentials, bookingAccountNames, bookingSpaces, random_future_date } from '../utils/exports/data.exp.ts';

const SEED_COUNT = Number(__ENV.SEED_COUNT || 100);
const SEED_VUS = Number(__ENV.SEED_VUS || 5);
const ORDERS_PER_EVENT = 2;
const SERVICE_ORDER_OBJECT_ID = 456;

export const options: Options = {
  scenarios: {
    seed: {
      executor: 'shared-iterations',
      vus: SEED_VUS,
      iterations: SEED_COUNT,
      maxDuration: '60m',
    },
  },
};

export async function setup() {
  const cryptoKey = config.cryptoKey;
  if (!cryptoKey) {
    throw new Error('No decryption key — write temp/secret.json (npm run secret -- --key <pass>) or pass -e CRYPTO_KEY=...');
  }
  const users = await decrypt_users(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const version = fetch_server_version();
  const { bearerToken, encUserId } = login_to_events(users[0], version);
  const windowVersion = get_window_version(bearerToken, version, 'EB8776');

  console.log(`Server version: ${version}`);
  console.log(`Booking ${SEED_COUNT} event(s), each with a function and ${ORDERS_PER_EVENT} service orders, with ${SEED_VUS} VU(s)`);
  return { version, bearerToken, encUserId, windowVersion };
}

function add_service_order(data: ServiceOrderSeedSetup, evtId: string) {
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

export default function seed_service_orders(data: ServiceOrderSeedSetup) {
  const { bearerToken, version, encUserId, windowVersion } = data;
  const iter = exec.scenario.iterationInTest;
  const epoch = Date.now();
  const date = random_future_date();
  const space = pick_pool_value(bookingSpaces);
  const description = `${config.seedEventPrefix}-${__VU}${iter}${epoch}`;

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
    `k6-t34-function-${__VU}${iter}${epoch}`,
    space,
    account,
    booked.evtId,
    booked.addedRowKey,
    encUserId,
    windowVersion,
    epoch,
  );

  const orders: string[] = [];
  for (let i = 0; i < ORDERS_PER_EVENT; i++) orders.push(add_service_order(data, booked.evtId));
  console.log(`[VU ${__VU}] Booked "${description}" (${booked.evtId}) with service orders ${orders.join(', ')}`);
}
