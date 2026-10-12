import { check, fail } from 'k6';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import { search_events, load_service_orders, get_window_version, read_event_function_rows } from '../utils/exports/apis.exp.ts';
import {
  fetch_server_version,
  decrypt_users,
  compare_record_fields,
  compare_record_count,
  eventIdentityFields,
  eventFunctionIdentityFields,
  serviceOrderIdentityFields,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { PoolProbeSetup, EventRow } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const REF_NAME = __ENV.REF_NAME || '';
const orderIdentityFields = serviceOrderIdentityFields.filter((field) => field !== 'priceList');

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
  if (!REF_NAME) {
    throw new Error("No reference event — pass -e REF_NAME='<an eventName from variables/version_<ver>/P_<ver>_EditServiceOrders.txt>'");
  }
  const cryptoKey = config.cryptoKey;
  if (!cryptoKey) {
    throw new Error('No decryption key — write temp/secret.json (npm run secret -- --key <pass>)');
  }
  const users = await decrypt_users(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const version = fetch_server_version();
  const { bearerToken, encUserId } = login_to_events(users[0], version);
  return { version, bearerToken, encUserId, windowVersion: get_window_version(bearerToken, version, 'EB8776', 'ProbeWindowInfo') };
}

function abort(label: string, message: string): never {
  check(null, { [label]: () => false });
  return fail(message);
}

function newest(events: EventRow[]) {
  return events.reduce<EventRow | undefined>((a, e) => (!a || Number(e.evtId) > Number(a.evtId) ? e : a), undefined);
}

export default function probe_edit_service_orders_seed(data: PoolProbeSetup & { encUserId: string; windowVersion: string }) {
  const prefix = config.seedEditServiceOrderPrefix;
  const functionPrefix = `${config.seedEditServiceOrderFunctionDescPrefix}-`;
  const reference = search_events(data.bearerToken, data.version, REF_NAME, 'ProbeSeedEventNeoLoad').find((e) => e.desc === REF_NAME);
  if (!reference) {
    abort(
      'NeoLoad reference event found',
      `no event named "${REF_NAME}" on this env: pick a name from the variables/ file of the version this env runs`,
    );
  }
  const seeded = newest(
    search_events(data.bearerToken, data.version, prefix, 'ProbeSeedEventSeed').filter((e) => e.desc.startsWith(prefix)),
  );
  if (!seeded) abort('k6 seeded event found', `no "${prefix}" event: run source/seeds/edit-service-orders.seed.ts first`);

  const read_functions = (event: EventRow, name: string) =>
    read_event_function_rows(
      data.bearerToken,
      data.version,
      '',
      event.acct,
      event.evtId,
      event.rowKey,
      data.encUserId,
      data.windowVersion,
      name,
    );

  console.log(`Comparing NeoLoad "${reference.desc}" (${reference.evtId}) with k6 "${seeded.desc}" (${seeded.evtId})`);
  const neoloadFunctions = read_functions(reference, 'ProbeSeedFunctionsNeoLoad').filter((f) => f.desc.includes('NeoLoadFunction_'));
  const seededFunctions = read_functions(seeded, 'ProbeSeedFunctionsSeed').filter((f) => f.desc.startsWith(functionPrefix));
  const neoloadOrders = load_service_orders(data.bearerToken, data.version, reference, 'ProbeSeedOrdersNeoLoad');
  const seededOrders = load_service_orders(data.bearerToken, data.version, seeded, 'ProbeSeedOrdersSeed');

  compare_record_fields('Event', reference, seeded, eventIdentityFields);
  if (neoloadFunctions.length === 0) {
    abort(
      'NeoLoad function found',
      `no NeoLoadFunction_ function on "${reference.desc}": pick a REF_NAME the data script ran to completion on`,
    );
  }
  if (seededFunctions.length === 0) {
    abort('k6 seeded function found', `no ${functionPrefix} function on "${seeded.desc}": the seed's function save did not land`);
  }
  compare_record_count('Added functions per event', neoloadFunctions.length, seededFunctions.length);
  compare_record_fields('Function', neoloadFunctions[0], seededFunctions[0], eventFunctionIdentityFields);
  compare_record_count('Service orders per event', neoloadOrders.length, seededOrders.length);
  if (neoloadOrders.length && seededOrders.length) {
    compare_record_fields('Service order', neoloadOrders[0], seededOrders[0], orderIdentityFields);
  }
}
