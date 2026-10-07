import { Options, Scenario } from 'k6/options';
import {
  discover_service_order_pool,
  discover_payment_plan_pool,
  copy_event_journey,
  copyEventThresholds,
  copy_service_orders_journey,
  copyServiceOrdersThresholds,
  crystal_report_journey,
  crystalReportThresholds,
  room_diagram_upload_journey,
  roomDiagramUploadThresholds,
  book_event_journey,
  bookEventThresholds,
  lead_account_journey,
  leadAccountThresholds,
  contact_service_order_journey,
  contactServiceOrderThresholds,
  payment_receipt_report_journey,
  paymentReceiptReportThresholds,
  badge_report_journey,
  badgeReportThresholds,
  invoice_events_journey,
  invoiceEventsThresholds,
  purchase_orders_journey,
  purchaseOrdersThresholds,
  voucher_processing_journey,
  voucherProcessingThresholds,
  payment_plan_journey,
  paymentPlanThresholds,
  launch_and_login_journey,
  launchAndLoginThresholds,
  detail_general_ledger_report_journey,
  detailGeneralLedgerReportThresholds,
  loginThresholds,
} from '../utils/exports/flows.exp.ts';
import { pick_user, fetch_server_version, decrypt_users, decrypt_api_credentials } from '../utils/exports/helpers.exp.ts';
import { commonThresholds, config } from '../utils/exports/config.exp.ts';
import { SmokeSetup } from '../utils/exports/types.exp.ts';
import { userCredentials, publicApiCredentials } from '../utils/exports/data.exp.ts';
import { roomDiagramFiles } from '../data/uploads/events/room-diagrams.index.ts';

const VUS = Number(__ENV.VUS) || 1;
const ITERS = Number(__ENV.ITERS) || 1;

const once = (exec: string): Scenario => ({
  executor: 'per-vu-iterations',
  vus: VUS,
  iterations: ITERS,
  exec,
});

const allScenarios: { [scenario: string]: Scenario } = {
  copy_event: once('copy_event'),
  copy_service_orders: once('copy_service_orders'),
  crystal_report: once('crystal_report'),
  room_diagram_upload: once('room_diagram_upload'),
  book_event: once('book_event'),
  lead_account: once('lead_account'),
  contact_service_order: once('contact_service_order'),
  payment_receipt_report: once('payment_receipt_report'),
  badge_report: once('badge_report'),
  invoice_events: once('invoice_events'),
  purchase_orders: once('purchase_orders'),
  voucher_processing: once('voucher_processing'),
  payment_plan: once('payment_plan'),
  launch_and_login: once('launch_and_login'),
  detail_general_ledger_report: once('detail_general_ledger_report'),
};

const allThresholds: { [scenario: string]: { [metric: string]: string[] } } = {
  copy_event: copyEventThresholds,
  copy_service_orders: copyServiceOrdersThresholds,
  crystal_report: crystalReportThresholds,
  room_diagram_upload: roomDiagramUploadThresholds,
  book_event: bookEventThresholds,
  lead_account: leadAccountThresholds,
  contact_service_order: contactServiceOrderThresholds,
  payment_receipt_report: paymentReceiptReportThresholds,
  badge_report: badgeReportThresholds,
  invoice_events: invoiceEventsThresholds,
  purchase_orders: purchaseOrdersThresholds,
  voucher_processing: voucherProcessingThresholds,
  payment_plan: paymentPlanThresholds,
  launch_and_login: launchAndLoginThresholds,
  detail_general_ledger_report: detailGeneralLedgerReportThresholds,
};

const selected = __ENV.SCENARIO;
if (selected && !allScenarios[selected]) {
  throw new Error(`Unknown SCENARIO "${selected}" — valid: ${Object.keys(allScenarios).join(', ')}`);
}

const soPoolScenarios = new Set(['copy_service_orders']);
const needsSoPool = !selected || soPoolScenarios.has(selected);
const needsPlanPool = !selected || selected === 'payment_plan';
const apiCredentialScenarios = new Set(['payment_receipt_report', 'badge_report', 'detail_general_ledger_report']);
const needsApiCredentials = !selected || apiCredentialScenarios.has(selected);

const activeThresholds: { [metric: string]: string[] } = selected
  ? allThresholds[selected]
  : Object.values(allThresholds).reduce<{ [metric: string]: string[] }>((merged, t) => ({ ...merged, ...t }), {});

export const options: Options = {
  scenarios: selected ? { [selected]: allScenarios[selected] } : allScenarios,
  thresholds: {
    ...commonThresholds,
    ...loginThresholds,
    ...activeThresholds,
    checks: ['rate>0.95'],
  },
};

export async function setup() {
  const cryptoKey = config.cryptoKey;
  if (!cryptoKey) {
    throw new Error('No decryption key — write temp/secret.json (npm run secret -- --key <pass>)');
  }
  const users = await decrypt_users(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const apiCredentials = needsApiCredentials ? await decrypt_api_credentials(publicApiCredentials, cryptoKey) : null;
  const version = fetch_server_version();
  const soPool = needsSoPool ? discover_service_order_pool(version, users[0]) : [];
  const planPool = needsPlanPool ? discover_payment_plan_pool(version, users[0]) : [];
  console.log(`Server version: ${version}`);
  if (needsSoPool) {
    console.log(`Smoke: ${soPool.length} seeded service order(s) discovered`);
  }
  return { version, users, soPool, planPool, apiCredentials };
}

export function copy_event(data: SmokeSetup) {
  copy_event_journey(pick_user(data.users), data);
}

export function copy_service_orders(data: SmokeSetup) {
  copy_service_orders_journey(pick_user(data.users), data);
}

export function crystal_report(data: SmokeSetup) {
  crystal_report_journey(pick_user(data.users), data);
}

export function room_diagram_upload(data: SmokeSetup) {
  room_diagram_upload_journey(pick_user(data.users), data, roomDiagramFiles);
}

export function book_event(data: SmokeSetup) {
  book_event_journey(pick_user(data.users), data);
}

export function lead_account(data: SmokeSetup) {
  lead_account_journey(pick_user(data.users), data);
}

export function contact_service_order(data: SmokeSetup) {
  contact_service_order_journey(pick_user(data.users), data);
}

export function payment_receipt_report(data: SmokeSetup) {
  payment_receipt_report_journey(data);
}

export function badge_report(data: SmokeSetup) {
  badge_report_journey(data);
}

export function invoice_events(data: SmokeSetup) {
  invoice_events_journey(pick_user(data.users), data);
}

export function purchase_orders(data: SmokeSetup) {
  purchase_orders_journey(pick_user(data.users), data);
}

export function voucher_processing(data: SmokeSetup) {
  voucher_processing_journey(pick_user(data.users), data);
}

export function payment_plan(data: SmokeSetup) {
  payment_plan_journey(pick_user(data.users), data);
}

export function launch_and_login(data: SmokeSetup) {
  launch_and_login_journey(pick_user(data.users), data);
}

export function detail_general_ledger_report(data: SmokeSetup) {
  detail_general_ledger_report_journey(data);
}
