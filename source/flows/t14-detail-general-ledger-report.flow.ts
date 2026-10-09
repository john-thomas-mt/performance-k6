import { group } from 'k6';
import { run_detail_general_ledger_report } from '../utils/exports/apis.exp.ts';
import {
  mint_api_jwt,
  pick_pool_value,
  think,
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
} from '../utils/exports/helpers.exp.ts';
import {
  binaryValues,
  detail_general_ledger_row,
  detailGeneralLedgerFormats,
  detailGeneralLedgerReportChrome,
  detailGeneralLedgerReportStatic,
  detailGeneralLedgerReportTransport,
  reportUserIds,
} from '../utils/exports/data.exp.ts';
import { ApiSetup, FidelityLevel } from '../utils/exports/types.exp.ts';

export const detailGeneralLedgerReportThresholds = {
  'http_req_duration{name:RunDetailGeneralLedgerReport}': ['avg<20000'],
};

function chrome_and_static(apiJwt: string, version: string, level: FidelityLevel, step: string) {
  if (include_ui(level)) fire_ui_chrome(apiJwt, version, detailGeneralLedgerReportChrome[step] ?? []);
  if (include_static(level)) {
    fire_static_assets(detailGeneralLedgerReportStatic[step] ?? []);
    fire_transport(apiJwt, version, detailGeneralLedgerReportTransport[step] ?? []);
  }
}

// verify-envs 2026-10-07: main, 26_2 and 26_1 pass; on 26_3 (26.3.9747.38364) RunReport times out at ~59.5s on every run (HTTP 0, no body) — env-side, not payload drift.
export function detail_general_ledger_report_journey(data: ApiSetup) {
  const level = fidelity_level();
  const apiJwt = mint_api_jwt(data.apiCredentials);
  const row = detail_general_ledger_row(
    pick_pool_value(reportUserIds),
    pick_pool_value(detailGeneralLedgerFormats),
    pick_pool_value(binaryValues),
  );

  group('T014_DetailGeneralLedger_Report', () => {
    run_detail_general_ledger_report(apiJwt, row);
    chrome_and_static(apiJwt, data.version, level, '01');
  });
  think();
}
