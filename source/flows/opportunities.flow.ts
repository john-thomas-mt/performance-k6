import { group, sleep } from 'k6';
import { login_to_momentus_assistant } from './login.flow.ts';
import { get_opportunities } from '../utils/exports/apis.exp.ts';
import { User, SetupData } from '../utils/exports/types.exp.ts';

export const opportunitiesThresholds = {
  'http_req_duration{name:GetOpportunities}': ['p(95)<3000'],
};

export function opportunities_journey(user: User, data: SetupData) {
  const { salesAiJwt } = login_to_momentus_assistant(user, data.version);

  group('3. Load Opportunities', () => {
    get_opportunities(salesAiJwt);
  });

  sleep(1);
}
