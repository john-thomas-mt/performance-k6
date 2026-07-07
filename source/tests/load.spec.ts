import { Options } from 'k6/options';
import { navigation_journey, navigationThresholds, loginThresholds } from '../utils/exports/flows.exp.ts';
import { pick_user, fetch_server_version, decrypt_users } from '../utils/exports/helpers.exp.ts';
import { commonThresholds, config, load_profile } from '../utils/exports/config.exp.ts';
import { NavLoadSetup } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const profile = load_profile('load');
if (!profile.stages) {
  throw new Error(`load.spec requires a profile with stages (e.g. PROFILE=load|stress) — "${__ENV.PROFILE}" has none`);
}

export const options: Options = {
  scenarios: {
    navigation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: profile.stages,
      exec: 'navigation',
    },
  },
  thresholds: {
    ...commonThresholds,
    ...loginThresholds,
    ...navigationThresholds,
    checks: ['rate>0.95'],
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
  console.log(`Server version: ${version}`);
  return { version, users };
}

export function navigation(data: NavLoadSetup) {
  navigation_journey(pick_user(data.users), data);
}
