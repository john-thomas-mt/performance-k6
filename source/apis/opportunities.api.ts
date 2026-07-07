import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { salesAiHeaders, tenantIdFromJwt } from '../utils/exports/helpers.exp.ts';
import { Opportunity } from '../utils/exports/types.exp.ts';

export function getOpportunities(salesAiJwt: string, name = 'GetOpportunities') {
  const tenantId = tenantIdFromJwt(salesAiJwt);
  const res = http.get(`${config.salesAiUrl}/api/opportunities?tenantId=${tenantId}`, {
    headers: salesAiHeaders(salesAiJwt),
    tags: { name },
  });

  check(res, {
    [`${name}: status is 200`]: (r) => r.status === 200,
    [`${name}: response is JSON`]: (r) => r.headers['Content-Type'] !== undefined && r.headers['Content-Type'].includes('application/json'),
    [`${name}: response body is non-empty`]: (r) => String(r.body ?? '').length > 0,
  });

  return res;
}

export function pollForOpportunity(salesAiJwt: string, searchToken: string, maxWaitSeconds = 120) {
  const intervalSeconds = 5;
  const maxAttempts = Math.ceil(maxWaitSeconds / intervalSeconds);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    sleep(intervalSeconds);

    const res = getOpportunities(salesAiJwt, 'PollOpportunities');

    if (res.status !== 200) {
      console.warn(`[VU ${__VU}] PollOpportunities attempt ${attempt}: HTTP ${res.status}`);
      continue;
    }

    try {
      const opportunities = res.json() as Opportunity[];
      if (Array.isArray(opportunities)) {
        const match = opportunities.find((o) => o.contactEmail.includes(searchToken));
        if (match) {
          console.log(`[VU ${__VU}] Opportunity ${match.id} found after ${attempt * intervalSeconds}s`);
          return match;
        }
      }
    } catch (e) {
      console.warn(`[VU ${__VU}] PollOpportunities attempt ${attempt}: parse error — ${e}`);
    }
  }

  console.error(`[VU ${__VU}] Opportunity with token "${searchToken}" not found after ${maxWaitSeconds}s`);
  check(null, { 'PollOpportunities: opportunity found before timeout': () => false });
  fail(`PollOpportunities: opportunity "${searchToken}" not found within ${maxWaitSeconds}s`);
}

type BatchReq = [string, string, null, { headers: { [header: string]: string }; tags: { name: string } }];

export function openOpportunityDetail(salesAiJwt: string, opportunityId: string) {
  const headers = salesAiHeaders(salesAiJwt);
  const get = (path: string, name: string): BatchReq => ['GET', `${config.salesAiUrl}${path}`, null, { headers, tags: { name } }];

  const responses = Object.values(
    http.batch([
      get(`/api/opportunities/${opportunityId}`, 'GetOpportunityDetail'),
      get('/api/tenant/features', 'GetTenantFeatures'),
      get('/api/opportunities/status-transitions', 'GetStatusTransitions'),
      get(`/api/opportunities/${opportunityId}/score-summary/events`, 'GetScoreEvents'),
      get(`/api/opportunities/scores/${opportunityId}`, 'GetOpportunityScore'),
      get(`/api/opportunities/${opportunityId}/communications/threads?pageSize=10`, 'GetCommThreads'),
      get(`/api/opportunities/${opportunityId}/deal-analysis`, 'GetDealAnalysis'),
    ]),
  );

  const detail = responses[0];
  const ok = check(detail, {
    'GetOpportunityDetail: status is 200': (r) => r.status === 200,
    'GetOpportunityDetail: id matches': (r) => {
      try {
        return (r.json() as Opportunity).id === opportunityId;
      } catch {
        return false;
      }
    },
  });

  check(null, {
    'OpportunityDetail: auxiliary requests all 200': () => responses.slice(1).every((r) => r.status === 200),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] openOpportunityDetail failed — HTTP ${detail.status}`);
    fail('openOpportunityDetail did not succeed');
  }
}
