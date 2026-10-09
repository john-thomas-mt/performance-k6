import { check, fail } from 'k6';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import { search_events, get_window_version, read_event_function_rows } from '../utils/exports/apis.exp.ts';
import {
  fetch_server_version,
  decrypt_users,
  compare_record_fields,
  eventIdentityFields,
  eventFunctionIdentityFields,
} from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { EventRow, PoolProbeSetup } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const REF_NAME = __ENV.REF_NAME || '';

export const options: Options = {
  scenarios: { probe: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '10m' } },
  thresholds: { checks: ['rate==1'] },
};

export async function setup() {
  if (!REF_NAME) {
    throw new Error(
      "No reference event — pass -e REF_NAME='<an eventName from variables/version_<ver>/P_<ver>_CopyPasteFunction.txt or Data_MultipleFunctionsEventNames.txt>'",
    );
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

export default function probe_copy_paste_functions_seed(data: PoolProbeSetup & { encUserId: string; windowVersion: string }) {
  const prefix = config.seedCopyPasteFunctionPrefix;
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
  if (!seeded) abort('k6 seeded event found', `no "${prefix}" event: run source/seeds/copy-paste-functions.seed.ts first`);

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
  const neoloadFunctions = read_functions(reference, 'ProbeSeedFunctionsNeoLoad');
  const seededFunctions = read_functions(seeded, 'ProbeSeedFunctionsSeed');
  const neoloadAdded = neoloadFunctions.find((f) => f.desc.includes('NeoLoadFunction_'));
  const neoloadAddedCount = neoloadFunctions.filter((f) => f.desc.includes('NeoLoadFunction_')).length;
  const seededAddedCount = seededFunctions.filter((f) => f.desc.startsWith(`${config.seedCopyPasteFunctionDescPrefix}-`)).length;
  const seededAdded = seededFunctions.find((f) => f.desc.startsWith(`${config.seedCopyPasteFunctionDescPrefix}-`));
  compare_record_fields('Event', reference, seeded, eventIdentityFields);
  check(seededAddedCount, { 'Added functions per event: within the seed range (2-10)': (n) => n >= 2 && n <= 10 });
  console.log(`Added functions: NeoLoad ${neoloadAddedCount}, k6 seed ${seededAddedCount}`);
  if (!neoloadAdded) {
    abort(
      'NeoLoad function found',
      `no NeoLoadFunction_ function on "${reference.desc}": pick a REF_NAME the data script ran to completion on`,
    );
  }
  if (!seededAdded)
    abort(
      'k6 seeded function found',
      `no ${config.seedCopyPasteFunctionDescPrefix}- function on "${seeded.desc}": the seed's function save did not land`,
    );
  compare_record_fields('Function', neoloadAdded, seededAdded, eventFunctionIdentityFields);
}
