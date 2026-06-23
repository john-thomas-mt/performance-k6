import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { loginToMomentusAssistant } from '../flows/login.flow.ts';
import { pickUser } from '../helpers/users.helper.ts';
import { submitManualEntry } from '../apis/manual-entry.api.ts';
import { manualEntryPayload } from '../data/sales-ai/manual-entry.data.ts';
import { pollForOpportunity, openOpportunityDetail } from '../apis/opportunities.api.ts';
import { getTasks } from '../apis/tasks.api.ts';
import { fetchServerVersion } from '../helpers/version.helper.ts';
import { loadProfile, commonThresholds } from '../config/profiles.config.ts';
import { User, SetupData } from '../types/common.type.ts';
import { Opportunity } from '../types/opportunities.type.ts';
import { TasksResponse } from '../types/tasks.type.ts';
import { users as userData } from '../data/users.data.ts';

const users = new SharedArray<User>('users', () => userData);

export const options: Options = {
  ...loadProfile(),
  thresholds: {
    ...commonThresholds,
    'http_req_duration{name:SignIn}': ['p(95)<2000'],
    'http_req_duration{name:MAAuthenticate}': ['p(95)<2000'],
    'http_req_duration{name:ManualEntry}': ['p(95)<3000'],
    'http_req_duration{name:GetOpportunityDetail}': ['p(95)<3000'],
    'http_req_duration{name:GetTasks}': ['p(95)<3000'],
    checks: ['rate>0.95'],
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

export default function opportunityIntroductoryEmailTest(data: SetupData) {
  const user = pickUser(users);

  const runToken = crypto.randomUUID().split('-')[0];
  const entry = manualEntryPayload(runToken);

  const { salesAiJwt } = loginToMomentusAssistant(user, data.version);
  if (!salesAiJwt) return;

  let accepted = false;

  group('3. Create Opportunity (Manual Entry)', () => {
    accepted = Boolean(submitManualEntry(salesAiJwt, entry, user.username.toUpperCase()));
    if (accepted) {
      console.log(`[VU ${__VU}] Manual entry accepted — token: ${runToken}`);
    }
  });

  if (!accepted) return;

  let opportunity: Opportunity | null = null;

  group('4. Poll for Created Opportunity', () => {
    opportunity = pollForOpportunity(salesAiJwt, runToken, 60);

    check(null, {
      'Opportunity appears in list after manual entry': () => Boolean(opportunity),
    });
  });

  if (!opportunity) return;

  group('5. Open Opportunity Detail', () => {
    openOpportunityDetail(salesAiJwt, opportunity!.id);
  });

  group('6. Verify Introduce Yourself Task', () => {
    const res = getTasks(salesAiJwt, opportunity!.id);

    check(res, {
      'Introduce Yourself task auto-created': (r) => {
        try {
          const body = r.json() as unknown as TasksResponse;
          return body.totalCount >= 1 && body.items.some((t) => t.category === 'IntroductoryEmail');
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

export function teardown() {
  console.log('Create opportunity test complete');
}
