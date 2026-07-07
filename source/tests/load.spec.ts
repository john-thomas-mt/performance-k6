import { Options } from 'k6/options';
import { navigationJourney, navigationThresholds, loginThresholds } from '../utils/exports/flows.exp.ts';
import { pickUser, fetchServerVersion, decryptUsers } from '../utils/exports/helpers.exp.ts';
import { commonThresholds, config, loadProfile } from '../utils/exports/config.exp.ts';
import { NavLoadSetup } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

// Ramp-up / sustain / ramp-down come from the selected profile (defaults to `load`, overridable
// with -e PROFILE=stress). ramping-vus has no iteration cap — VUs loop the journey for the duration.
const profile = loadProfile('load');
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
  const users = await decryptUsers(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const version = fetchServerVersion();
  console.log(`Server version: ${version}`);
  return { version, users };
}

export function navigation(data: NavLoadSetup) {
  navigationJourney(pickUser(data.users), data);
}
