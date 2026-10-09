import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { public_api_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { detailGeneralLedgerReportPayload } from '../utils/exports/data.exp.ts';
import { DetailGeneralLedgerResult, DetailGeneralLedgerRow } from '../utils/exports/types.exp.ts';

export function run_detail_general_ledger_report(apiJwt: string, row: DetailGeneralLedgerRow, name = 'RunDetailGeneralLedgerReport') {
  const res = http.put(`${config.baseUrl}/api/v1/Reports/10/105/RunReport`, JSON.stringify(detailGeneralLedgerReportPayload(row)), {
    headers: public_api_headers(apiJwt),
    tags: { name },
  });
  const isJson = res.status === 200 && (res.headers['Content-Type']?.includes('application/json') ?? false);
  const report = isJson ? (res.json() as DetailGeneralLedgerResult) : null;
  const ok = check(res, {
    [`${name}: status is 200`]: (r) => r.status === 200,
    [`${name}: report is a PDF`]: () => report?.MimeType === 'application/pdf',
    [`${name}: report data present`]: () => Boolean(report?.ReportData),
  });
  if (!ok) {
    console.error(
      `[VU ${__VU}] run_detail_general_ledger_report failed for user ${row.userId} format ${row.reportFormat} summary ${row.summary} periods ${row.fiscalFrom}-${row.fiscalThru} accounts ${row.accountFrom}-${row.accountThru} — HTTP ${res.status}: ${body_text(res).slice(0, 500)}`,
    );
    fail('run_detail_general_ledger_report did not succeed');
  }
}
