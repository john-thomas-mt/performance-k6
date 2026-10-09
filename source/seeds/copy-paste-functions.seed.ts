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
  search_events,
} from '../utils/exports/apis.exp.ts';
import {
  fetch_server_version,
  decrypt_seed_users,
  pick_user,
  pick_pool_value,
  format_retrieve_stamp,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { SeedSetup, SeedSession } from '../utils/exports/types.exp.ts';
import { bookingAccountNames, bookingSpaces, random_future_date } from '../utils/exports/data.exp.ts';

const SEED_ADD = __ENV.SEED_ADD ? Number(__ENV.SEED_ADD) : undefined;
const SEED_COUNT = SEED_ADD ?? Number(__ENV.SEED_COUNT || 100);
const SEED_VUS = Number(__ENV.SEED_VUS || 10);
const MIN_FUNCTIONS = 2;
const MAX_FUNCTIONS = 10;

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
  const { bearerToken } = login_to_events(users[0], version);
  const existing = search_events(bearerToken, version, config.seedCopyPasteFunctionPrefix, 'CountSeedEvents').filter((e) =>
    e.desc.startsWith(config.seedCopyPasteFunctionPrefix),
  ).length;
  const shortfall = SEED_ADD ?? Math.max(0, SEED_COUNT - existing);

  console.log(`Server version: ${version}`);
  console.log(
    `"${config.seedCopyPasteFunctionPrefix}" events: ${existing} found, ${SEED_ADD === undefined ? `target ${SEED_COUNT}` : 'adding'}, creating ${shortfall}`,
  );
  console.log(
    `Booking ${shortfall} event(s), each with ${MIN_FUNCTIONS}-${MAX_FUNCTIONS} added functions, with ${SEED_VUS} VU(s), each on its own session as a seed user from temp/seed-users.json`,
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

export default function seed_copy_paste_functions(data: SeedSetup) {
  if (exec.scenario.iterationInTest >= data.shortfall) return;
  const { bearerToken, version, encUserId, windowVersion } = seed_session(data);
  const iter = exec.scenario.iterationInTest;
  const epoch = Date.now();
  const date = random_future_date();
  const space = pick_pool_value(bookingSpaces);
  const description = `${config.seedCopyPasteFunctionPrefix}-${__VU}${iter}${epoch}`;

  const spaceTable = stage_booking_space(bearerToken, version, date, space);
  const form = open_booking_form(bearerToken, version, date);
  const account = search_booking_account(bearerToken, version, pick_pool_value(bookingAccountNames));
  const contact = refresh_booking_account_fields(bearerToken, version, form, date, account);
  const booked = save_booking(bearerToken, version, form, spaceTable, date, description, account, contact);

  const functionCount = MIN_FUNCTIONS + Math.floor(Math.random() * (MAX_FUNCTIONS - MIN_FUNCTIONS + 1));
  const functions: string[] = [];
  for (let i = 0; i < functionCount; i++) {
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
    const funcDesc = `k6-t16-function-${__VU}${iter}${epoch}${i}`;
    save_event_function(
      bearerToken,
      version,
      funcTable,
      funcDesc,
      space,
      account,
      booked.evtId,
      booked.addedRowKey,
      encUserId,
      windowVersion,
      Date.now(),
    );
    functions.push(funcDesc);
  }
  console.log(`[VU ${__VU}] Booked "${description}" (${booked.evtId}) with function(s) ${functions.join(', ')}`);
}
