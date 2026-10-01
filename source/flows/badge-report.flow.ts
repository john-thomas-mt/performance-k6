import { group } from 'k6';
import { run_badge_report } from '../utils/exports/apis.exp.ts';
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
import { badgeReports, badgeReportChrome, badgeReportStatic, badgeReportTransport } from '../utils/exports/data.exp.ts';
import { ApiSetup, FidelityLevel } from '../utils/exports/types.exp.ts';

export const badgeReportThresholds = {
  'http_req_duration{name:RunBadgeReport}': ['avg<20000'],
};

function chrome_and_static(apiJwt: string, version: string, level: FidelityLevel, step: string) {
  if (include_ui(level)) fire_ui_chrome(apiJwt, version, badgeReportChrome[step] ?? []);
  if (include_static(level)) {
    fire_static_assets(badgeReportStatic[step] ?? []);
    fire_transport(apiJwt, version, badgeReportTransport[step] ?? []);
  }
}

export function badge_report_journey(data: ApiSetup) {
  const level = fidelity_level();
  const apiJwt = mint_api_jwt(data.apiCredentials);
  const row = pick_pool_value(badgeReports);

  group('T006_Badge_Report', () => {
    run_badge_report(apiJwt, row);
    chrome_and_static(apiJwt, data.version, level, '01');
  });
  think();
}
