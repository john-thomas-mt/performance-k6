import http from 'k6/http';
import { check } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { salesAiHeaders } from '../utils/exports/helpers.exp.ts';
import { ManualEntryResult } from '../utils/exports/types.exp.ts';

export function submitManualEntry(
  salesAiJwt: string,
  entry: Record<string, unknown>,
  userId: string
): ManualEntryResult | null {
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

  const res = http.post(
    `${config.salesAiUrl}/api/manual-entry`,
    JSON.stringify(payload),
    {
      headers: salesAiHeaders(salesAiJwt, 'application/json'),
      tags: { name: 'ManualEntry' },
    }
  );

  const ok = check(res, {
    'ManualEntry: status is 202': (r) => r.status === 202,
    'ManualEntry: status is Processing': (r) => {
      try { return (r.json() as ManualEntryResult).status === 'Processing'; } catch { return false; }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] submitManualEntry failed — HTTP ${res.status}: ${res.body}`);
    return null;
  }

  return res.json() as ManualEntryResult;
}
