import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { public_api_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { badgeReportPayload } from '../utils/exports/data.exp.ts';
import { BadgeReportResult, BadgeReportRow } from '../utils/exports/types.exp.ts';

export function run_badge_report(apiJwt: string, row: BadgeReportRow, name = 'RunBadgeReport') {
  const res = http.put(`${config.baseUrl}/api/v1/Reports/10/6044/RunReport`, JSON.stringify(badgeReportPayload(row)), {
    headers: public_api_headers(apiJwt),
    tags: { name },
  });
  const isJson = res.status === 200 && (res.headers['Content-Type']?.includes('application/json') ?? false);
  const report = isJson ? (res.json() as BadgeReportResult) : null;
  const ok = check(res, {
    [`${name}: status is 200`]: (r) => r.status === 200,
    [`${name}: report is a PDF`]: () => report?.MimeType === 'application/pdf',
    [`${name}: report data present`]: () => Boolean(report?.ReportData),
  });
  if (!ok) {
    console.error(
      `[VU ${__VU}] run_badge_report failed for order ${row.order} registration ${row.registration} — HTTP ${res.status}: ${body_text(res).slice(0, 500)}`,
    );
    fail('run_badge_report did not succeed');
  }
}
