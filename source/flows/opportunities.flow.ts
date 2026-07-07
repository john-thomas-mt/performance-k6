import { group, sleep } from 'k6';
import { loginToMomentusAssistant } from './login.flow.ts';
import { getOpportunities } from '../utils/exports/apis.exp.ts';
import { User, SetupData } from '../utils/exports/types.exp.ts';

export const opportunitiesThresholds = {
  'http_req_duration{name:GetOpportunities}': ['p(95)<3000'],
};

export function opportunitiesJourney(user: User, data: SetupData) {
  const { salesAiJwt } = loginToMomentusAssistant(user, data.version);
  if (!salesAiJwt) return;

  group('3. Load Opportunities', () => {
    getOpportunities(salesAiJwt);
  });

  sleep(1);
}
