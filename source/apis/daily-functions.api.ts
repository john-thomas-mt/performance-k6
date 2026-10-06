import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { public_api_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { dailyFunctionReportPayload } from '../utils/exports/data.exp.ts';
import { DailyFunctionReportResult, DailyFunctionRow, DailyFunctionWindow } from '../utils/exports/types.exp.ts';

export function run_daily_function_report(
  apiJwt: string,
  row: DailyFunctionRow,
  window: DailyFunctionWindow,
  name = 'RunDailyFunctionReport',
) {
  const res = http.put(`${config.baseUrl}/api/v1/Reports/10/212/RunReport`, JSON.stringify(dailyFunctionReportPayload(row, window)), {
    headers: public_api_headers(apiJwt),
    tags: { name },
  });
  const isJson = res.status === 200 && (res.headers['Content-Type']?.includes('application/json') ?? false);
  const report = isJson ? (res.json() as DailyFunctionReportResult) : null;
  const ok = check(res, {
    [`${name}: status is 200`]: (r) => r.status === 200,
    [`${name}: report is a PDF`]: () => report?.MimeType === 'application/pdf',
    [`${name}: report data present`]: () => Boolean(report?.ReportData),
  });
  if (!ok) {
    console.error(
      `[VU ${__VU}] run_daily_function_report failed for ${window.startDate}..${window.endDate} user ${row.UserID} — HTTP ${res.status}: ${body_text(res).slice(0, 500)}`,
    );
    fail('run_daily_function_report did not succeed');
  }
}
