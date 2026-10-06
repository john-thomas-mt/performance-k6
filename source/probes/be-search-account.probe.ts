import exec from 'k6/execution';
import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import { search_booking_account } from '../utils/exports/apis.exp.ts';
import { fetch_server_version, decrypt_users } from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { PoolProbeSetup } from '../utils/exports/types.exp.ts';
import { userCredentials, bookingAccountNames } from '../utils/exports/data.exp.ts';

const PROBE_VUS = Number(__ENV.PROBE_VUS || 4);

export const options: Options = {
  scenarios: {
    probe: {
      executor: 'shared-iterations',
      vus: PROBE_VUS,
      iterations: bookingAccountNames.length,
      maxDuration: '60m',
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

  console.log(`Searching ${bookingAccountNames.length} booking account name(s) with ${PROBE_VUS} VU(s)`);
  return { version, bearerToken };
}

export default function probe_booking_accounts(data: PoolProbeSetup) {
  search_booking_account(data.bearerToken, data.version, bookingAccountNames[exec.scenario.iterationInTest], 'ProbeBookingAccount');
}
