import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { sales_ai_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { ManualEntryPayload, ManualEntryResult } from '../utils/exports/types.exp.ts';

export function submit_manual_entry(salesAiJwt: string, entry: ManualEntryPayload, userId: string) {
  const payload = {
    ...entry,
    metadata: {
      source: 'manual-entry',
      submittedAt: new Date().toISOString(),
      sessionId: crypto.randomUUID(),
      userId,
      referrer: `${config.salesAiUrl}/dashboard`,
    },
  };

  const res = http.post(`${config.salesAiUrl}/api/manual-entry`, JSON.stringify(payload), {
    headers: sales_ai_headers(salesAiJwt, 'application/json'),
    tags: { name: 'ManualEntry' },
  });

  const ok = check(res, {
    'ManualEntry: status is 202': (r) => r.status === 202,
    'ManualEntry: status is Processing': (r) => {
      try {
        return (r.json() as ManualEntryResult).status === 'Processing';
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] submit_manual_entry failed — HTTP ${res.status}: ${body_text(res)}`);
    fail('submit_manual_entry did not succeed');
  }
}
