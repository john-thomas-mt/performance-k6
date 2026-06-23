import { group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { loginToMomentusAssistant } from '../flows/login.flow.ts';
import { pickUser } from '../helpers/users.helper.ts';
import { getOpportunities } from '../apis/opportunities.api.ts';
import { fetchServerVersion } from '../helpers/version.helper.ts';
import { loadProfile, commonThresholds } from '../config/profiles.config.ts';
import { User, SetupData } from '../types/common.type.ts';
import { users as userData } from '../data/users.data.ts';

const users = new SharedArray<User>('users', () => userData);

export const options: Options = {
  ...loadProfile(),
  thresholds: {
    ...commonThresholds,
    'http_req_duration{name:SignIn}': ['p(95)<2000'],
    'http_req_duration{name:MAAuthenticate}': ['p(95)<2000'],
    'http_req_duration{name:GetOpportunities}': ['p(95)<3000'],
  },
};

export function setup(): SetupData {
  if (users.length === 0) {
    throw new Error('data/users.ts is empty — add at least one user entry');
  }

  const version = fetchServerVersion();
  console.log(`Server version: ${version}`);
  console.log(`Test starting with ${users.length} user(s) in pool`);

  return { version };
}

export default function opportunitiesTest(data: SetupData) {
  const user = pickUser(users);

  const { salesAiJwt } = loginToMomentusAssistant(user, data.version);
  if (!salesAiJwt) return;

  group('3. Load Opportunities', () => {
    getOpportunities(salesAiJwt);
  });

  sleep(1);
}

export function teardown() {
  console.log('Test complete');
}
