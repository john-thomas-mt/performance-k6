import { group } from 'k6';
import { run_event_revenue_metric_report } from '../utils/exports/apis.exp.ts';
import {
  mint_api_jwt,
  random_date_range,
  think,
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
} from '../utils/exports/helpers.exp.ts';
import {
  eventRevenueMetricReportChrome,
  eventRevenueMetricReportStatic,
  eventRevenueMetricReportTransport,
} from '../utils/exports/data.exp.ts';
import { ApiSetup, FidelityLevel } from '../utils/exports/types.exp.ts';

export const eventRevenueMetricReportThresholds = {
  'http_req_duration{name:RunEventRevenueMetricReport}': ['avg<20000'],
};

function chrome_and_static(apiJwt: string, version: string, level: FidelityLevel, step: string) {
  if (include_ui(level)) fire_ui_chrome(apiJwt, version, eventRevenueMetricReportChrome[step] ?? []);
  if (include_static(level)) {
    fire_static_assets(eventRevenueMetricReportStatic[step] ?? []);
    fire_transport(apiJwt, version, eventRevenueMetricReportTransport[step] ?? []);
  }
}

export function event_revenue_metric_report_journey(data: ApiSetup) {
  const level = fidelity_level();
  const apiJwt = mint_api_jwt(data.apiCredentials);
  const range = random_date_range();

  group('T017_EventRevenueMetric_Report', () => {
    run_event_revenue_metric_report(apiJwt, range);
    chrome_and_static(apiJwt, data.version, level, '01');
  });
  think();
}
