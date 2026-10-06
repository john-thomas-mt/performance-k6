import { fail } from 'k6';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import { search_events, load_service_orders } from '../utils/exports/apis.exp.ts';
import {
  fetch_server_version,
  decrypt_users,
  compare_record_fields,
  compare_record_count,
  eventIdentityFields,
  serviceOrderIdentityFields,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { PoolProbeSetup, EventRow } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const REF_NAME = __ENV.REF_NAME || '';

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
    throw new Error("No reference event — pass -e REF_NAME='<an eventName from variables/version_<ver>/P_<ver>_CopyServiceOrders.txt>'");
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
  const { bearerToken } = login_to_events(users[0], version);
  return { version, bearerToken };
}

function newest(events: EventRow[]) {
  return events.reduce<EventRow | undefined>((a, e) => (!a || Number(e.evtId) > Number(a.evtId) ? e : a), undefined);
}

export default function probe_service_orders_seed(data: PoolProbeSetup) {
  const prefix = config.seedEventPrefix;
  const reference = search_events(data.bearerToken, data.version, REF_NAME, 'ProbeSeedEventNeoLoad').find((e) => e.desc === REF_NAME);
  if (!reference) fail(`no event named "${REF_NAME}" on this env: pick a name from the variables/ file of the version this env runs`);
  const seeded = newest(
    search_events(data.bearerToken, data.version, prefix, 'ProbeSeedEventSeed').filter((e) => e.desc.startsWith(prefix)),
  );
  if (!seeded) fail(`no "${prefix}" event: run source/seeds/service-orders.seed.ts first`);

  console.log(`Comparing NeoLoad "${reference.desc}" (${reference.evtId}) with k6 "${seeded.desc}" (${seeded.evtId})`);
  const neoloadOrders = load_service_orders(data.bearerToken, data.version, reference, 'ProbeSeedOrdersNeoLoad');
  const seededOrders = load_service_orders(data.bearerToken, data.version, seeded, 'ProbeSeedOrdersSeed');
  compare_record_fields('Event', reference, seeded, eventIdentityFields);
  compare_record_count('Service orders per event', neoloadOrders.length, seededOrders.length);
  if (neoloadOrders.length && seededOrders.length) {
    compare_record_fields('Service order', neoloadOrders[0], seededOrders[0], serviceOrderIdentityFields);
  }
}
