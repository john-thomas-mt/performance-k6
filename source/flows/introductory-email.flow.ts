import { check, group, sleep } from 'k6';
import { login_to_momentus_assistant } from './login.flow.ts';
import { submit_manual_entry, poll_for_opportunity, open_opportunity_detail, get_tasks } from '../utils/exports/apis.exp.ts';
import { manualEntryPayload } from '../utils/exports/data.exp.ts';
import { User, SetupData, Opportunity, TasksResponse } from '../utils/exports/types.exp.ts';

export const introductoryEmailThresholds = {
  'http_req_duration{name:ManualEntry}': ['p(95)<3000'],
  'http_req_duration{name:GetOpportunityDetail}': ['p(95)<3000'],
  'http_req_duration{name:GetTasks}': ['p(95)<3000'],
};

export function introductory_email_journey(user: User, data: SetupData) {
  const runToken = crypto.randomUUID().split('-')[0];
  const entry = manualEntryPayload(runToken);

  const { salesAiJwt } = login_to_momentus_assistant(user, data.version);

  group('3. Create Opportunity (Manual Entry)', () => {
    submit_manual_entry(salesAiJwt, entry, user.username.toUpperCase());
    console.log(`[VU ${__VU}] Manual entry accepted — token: ${runToken}`);
  });

  let opportunity: Opportunity | null = null;
  group('4. Poll for Created Opportunity', () => {
    opportunity = poll_for_opportunity(salesAiJwt, runToken, 60);
  });
  const created = opportunity!;

  group('5. Open Opportunity Detail', () => {
    open_opportunity_detail(salesAiJwt, created.id);
  });

  group('6. Verify Introduce Yourself Task', () => {
    const res = get_tasks(salesAiJwt, created.id);
    check(res, {
      'Introduce Yourself task auto-created': (r) => {
        try {
          const body = r.json() as TasksResponse;
          return body.totalCount >= 1 && body.items.some((t) => t.category === 'IntroductoryEmail');
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}
