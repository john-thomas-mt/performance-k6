import { Options, Scenario, Stage } from 'k6/options';
import {
  discover_service_order_pool,
  discover_payment_plan_pool,
  discover_copy_paste_function_pool,
  discover_edit_service_order_pool,
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
  event_revenue_metric_report_journey,
  eventRevenueMetricReportThresholds,
  space_utilization_report_journey,
  spaceUtilizationReportThresholds,
  opportunity_conversion_report_journey,
  opportunityConversionReportThresholds,
  copy_paste_event_function_journey,
  copyPasteEventFunctionThresholds,
  edit_service_orders_journey,
  editServiceOrdersThresholds,
  loginThresholds,
} from '../utils/exports/flows.exp.ts';
import { pick_user, fetch_server_version, decrypt_users, decrypt_api_credentials, pace } from '../utils/exports/helpers.exp.ts';
import { commonThresholds, config, load_profile } from '../utils/exports/config.exp.ts';
import { SmokeSetup } from '../utils/exports/types.exp.ts';
import { userCredentials, publicApiCredentials } from '../utils/exports/data.exp.ts';
import { roomDiagramFiles } from '../data/uploads/events/room-diagrams.index.ts';
import { sampleDocument } from '../data/uploads/service-orders/sample-document.index.ts';

const PACING = Number(__ENV.PACING) || 300;
const GRACEFUL_STOP = '60s';

const profile = load_profile('neoload');
if (!profile.stages) {
  throw new Error(`PROFILE "${__ENV.PROFILE ?? 'neoload'}" has no stages — neoload.spec.ts needs a ramping profile`);
}
const stages = profile.stages;

const flowShares: { [exec: string]: number } = {
  lead_account: 10,
  book_event: 5,
  contact_service_order: 5,
  copy_event: 5,
  payment_receipt_report: 1,
  badge_report: 1,
  invoice_events: 10,
  purchase_orders: 5,
  voucher_processing: 5,
  payment_plan: 10,
  launch_and_login: 8,
  detail_general_ledger_report: 1,
  copy_paste_event_function: 5,
  event_revenue_metric_report: 1,
  space_utilization_report: 1,
  opportunity_conversion_report: 1,
  edit_service_orders: 5,
  crystal_report: 1,
  room_diagram_upload: 10,
  copy_service_orders: 10,
};

const totalShare = Object.values(flowShares).reduce((sum, share) => sum + share, 0);
if (totalShare !== 100) {
  throw new Error(`flowShares must total 100 (the population's VU split), got ${totalShare}`);
}

const UNIT_MS: { [unit: string]: number } = { ms: 1, s: 1000, m: 60000, h: 3600000 };

const duration_ms = (duration: string) =>
  [...duration.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)].reduce((sum, [, value, unit]) => sum + Number(value) * UNIT_MS[unit], 0);

function interleaved_flows() {
  const flows = Object.keys(flowShares);
  const credit: { [exec: string]: number } = Object.fromEntries(flows.map((exec) => [exec, 0]));
  return Array.from({ length: totalShare }, () => {
    for (const exec of flows) credit[exec] += flowShares[exec];
    const next = flows.reduce((best, exec) => (credit[exec] > credit[best] ? exec : best));
    credit[next] -= totalShare;
    return next;
  });
}

const vuOrder = interleaved_flows();

const flow_vus = (exec: string, total: number) =>
  Math.floor(total / totalShare) * flowShares[exec] + vuOrder.slice(0, total % totalShare).filter((owner) => owner === exec).length;

function staggered_stages(exec: string) {
  const out: Stage[] = [];
  let level = 0;
  for (const stage of stages) {
    const target = stage.target ?? 0;
    if (target <= level) {
      out.push({ duration: stage.duration, target: flow_vus(exec, target) });
      level = target;
      continue;
    }
    const stageMs = duration_ms(stage.duration);
    const step = stageMs / (target - level);
    let vus = flow_vus(exec, level);
    let cursor = 0;
    for (let slot = level; slot < target; slot++) {
      if (vuOrder[slot % totalShare] !== exec) continue;
      const at = Math.round((slot - level) * step);
      if (at > cursor) out.push({ duration: `${at - cursor}ms`, target: vus });
      vus += 1;
      out.push({ duration: '0s', target: vus });
      cursor = at;
    }
    if (stageMs > cursor) out.push({ duration: `${stageMs - cursor}ms`, target: vus });
    level = target;
  }
  return out;
}

const scenario = (exec: string): Scenario => ({
  executor: 'ramping-vus',
  startVUs: 0,
  stages: staggered_stages(exec),
  gracefulRampDown: GRACEFUL_STOP,
  gracefulStop: GRACEFUL_STOP,
  exec,
});

export const options: Options = {
  scenarios: Object.fromEntries(Object.keys(flowShares).map((exec) => [exec, scenario(exec)])),
  thresholds: {
    ...commonThresholds,
    ...loginThresholds,
    ...copyEventThresholds,
    ...copyServiceOrdersThresholds,
    ...crystalReportThresholds,
    ...roomDiagramUploadThresholds,
    ...bookEventThresholds,
    ...leadAccountThresholds,
    ...contactServiceOrderThresholds,
    ...paymentReceiptReportThresholds,
    ...badgeReportThresholds,
    ...invoiceEventsThresholds,
    ...purchaseOrdersThresholds,
    ...voucherProcessingThresholds,
    ...paymentPlanThresholds,
    ...launchAndLoginThresholds,
    ...detailGeneralLedgerReportThresholds,
    ...eventRevenueMetricReportThresholds,
    ...spaceUtilizationReportThresholds,
    ...opportunityConversionReportThresholds,
    ...copyPasteEventFunctionThresholds,
    ...editServiceOrdersThresholds,
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
  const apiCredentials = await decrypt_api_credentials(publicApiCredentials, cryptoKey);
  const version = fetch_server_version();
  const soPool = discover_service_order_pool(version, users[0]);
  const planPool = discover_payment_plan_pool(version, users[0]);
  const copyPastePool = discover_copy_paste_function_pool(version, users[0]);
  const editOrderPool = discover_edit_service_order_pool(version, users[0]);
  console.log(`Server version: ${version}`);
  console.log(`NeoLoad: ${soPool.length} seeded service order(s) discovered`);
  return { version, users, soPool, planPool, copyPastePool, editOrderPool, apiCredentials };
}

export function lead_account(data: SmokeSetup) {
  pace(PACING, () => lead_account_journey(pick_user(data.users), data));
}

export function book_event(data: SmokeSetup) {
  pace(PACING, () => book_event_journey(pick_user(data.users), data));
}

export function contact_service_order(data: SmokeSetup) {
  pace(PACING, () => contact_service_order_journey(pick_user(data.users), data));
}

export function copy_event(data: SmokeSetup) {
  pace(PACING, () => copy_event_journey(pick_user(data.users), data));
}

export function payment_receipt_report(data: SmokeSetup) {
  pace(PACING, () => payment_receipt_report_journey(data));
}

export function badge_report(data: SmokeSetup) {
  pace(PACING, () => badge_report_journey(data));
}

export function invoice_events(data: SmokeSetup) {
  pace(PACING, () => invoice_events_journey(pick_user(data.users), data));
}

export function purchase_orders(data: SmokeSetup) {
  pace(PACING, () => purchase_orders_journey(pick_user(data.users), data));
}

export function voucher_processing(data: SmokeSetup) {
  pace(PACING, () => voucher_processing_journey(pick_user(data.users), data));
}

export function payment_plan(data: SmokeSetup) {
  pace(PACING, () => payment_plan_journey(pick_user(data.users), data));
}

export function launch_and_login(data: SmokeSetup) {
  pace(PACING, () => launch_and_login_journey(pick_user(data.users), data));
}

export function detail_general_ledger_report(data: SmokeSetup) {
  pace(PACING, () => detail_general_ledger_report_journey(data));
}

export function copy_paste_event_function(data: SmokeSetup) {
  pace(PACING, () => copy_paste_event_function_journey(pick_user(data.users), data));
}

export function event_revenue_metric_report(data: SmokeSetup) {
  pace(PACING, () => event_revenue_metric_report_journey(data));
}

export function space_utilization_report(data: SmokeSetup) {
  pace(PACING, () => space_utilization_report_journey(data));
}

export function opportunity_conversion_report(data: SmokeSetup) {
  pace(PACING, () => opportunity_conversion_report_journey(data));
}

export function edit_service_orders(data: SmokeSetup) {
  pace(PACING, () => edit_service_orders_journey(pick_user(data.users), data, sampleDocument));
}

export function crystal_report(data: SmokeSetup) {
  pace(PACING, () => crystal_report_journey(pick_user(data.users), data));
}

export function room_diagram_upload(data: SmokeSetup) {
  pace(PACING, () => room_diagram_upload_journey(pick_user(data.users), data, roomDiagramFiles));
}

export function copy_service_orders(data: SmokeSetup) {
  pace(PACING, () => copy_service_orders_journey(pick_user(data.users), data));
}
