import { group } from 'k6';
import { run_payment_receipt_report } from '../utils/exports/apis.exp.ts';
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
  paymentPayloads,
  paymentReceiptReportChrome,
  paymentReceiptReportStatic,
  paymentReceiptReportTransport,
} from '../utils/exports/data.exp.ts';
import { ApiSetup, FidelityLevel } from '../utils/exports/types.exp.ts';

export const paymentReceiptReportThresholds = {
  'http_req_duration{name:RunPaymentReceiptReport}': ['avg<20000'],
};

function chrome_and_static(apiJwt: string, version: string, level: FidelityLevel, step: string) {
  if (include_ui(level)) fire_ui_chrome(apiJwt, version, paymentReceiptReportChrome[step] ?? []);
  if (include_static(level)) {
    fire_static_assets(paymentReceiptReportStatic[step] ?? []);
    fire_transport(apiJwt, version, paymentReceiptReportTransport[step] ?? []);
  }
}

export function payment_receipt_report_journey(data: ApiSetup) {
  const level = fidelity_level();
  const apiJwt = mint_api_jwt(data.apiCredentials);
  const row = pick_pool_value(paymentPayloads);

  group('T005_PaymentReceipt_Report', () => {
    run_payment_receipt_report(apiJwt, row);
    chrome_and_static(apiJwt, data.version, level, '01');
  });
  think();
}
