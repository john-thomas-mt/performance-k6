import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { public_api_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { dailyWorkOrderReportPayload } from '../utils/exports/data.exp.ts';
import { DailyWorkOrderReportResult } from '../utils/exports/types.exp.ts';

export function run_daily_work_order_report(
  apiJwt: string,
  userId: string,
  fromDate: string,
  toDate: string,
  name = 'RunDailyWorkOrderReport',
) {
  const res = http.put(
    `${config.baseUrl}/api/v1/Reports/10/12/RunReport`,
    JSON.stringify(dailyWorkOrderReportPayload(userId, fromDate, toDate)),
    { headers: public_api_headers(apiJwt), tags: { name }, timeout: '300s' },
  );
  const isJson = res.status === 200 && (res.headers['Content-Type']?.includes('application/json') ?? false);
  const report = isJson ? (res.json() as DailyWorkOrderReportResult) : null;
  const ok = check(res, {
    [`${name}: status is 200`]: (r) => r.status === 200,
    [`${name}: report is a PDF`]: () => report?.MimeType === 'application/pdf',
    [`${name}: report data present`]: () => Boolean(report?.ReportData),
  });
  if (!ok) {
    console.error(
      `[VU ${__VU}] run_daily_work_order_report failed for user ${userId} ${fromDate} to ${toDate} — HTTP ${res.status}: ${body_text(res).slice(0, 500)}`,
    );
    fail('run_daily_work_order_report did not succeed');
  }
}
