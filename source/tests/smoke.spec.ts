import { Options, Scenario } from 'k6/options';
import {
  service_order_items_journey,
  serviceOrderItemsThresholds,
  edit_service_orders_journey,
  editServiceOrdersThresholds,
  discover_service_order_pool,
  copy_event_journey,
  copyEventThresholds,
  opportunities_journey,
  opportunitiesThresholds,
  file_upload_journey,
  fileUploadThresholds,
  introductory_email_journey,
  introductoryEmailThresholds,
  navigation_journey,
  navigationThresholds,
  loginThresholds,
} from '../utils/exports/flows.exp.ts';
import { pick_user, fetch_server_version, decrypt_users } from '../utils/exports/helpers.exp.ts';
import { commonThresholds, config } from '../utils/exports/config.exp.ts';
import { SmokeSetup } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const opportunityTemplate = open('../data/uploads/opportunities/sample-opportunity.txt');
const sampleDocument = open('../data/uploads/service-orders/sample-document.txt', 'b');

const VUS = Number(__ENV.VUS) || 1;
const ITERS = Number(__ENV.ITERS) || 1;

const once = (exec: string): Scenario => ({
  executor: 'per-vu-iterations',
  vus: VUS,
  iterations: ITERS,
  exec,
});

const allScenarios: { [scenario: string]: Scenario } = {
  opportunities: once('opportunities'),
  file_upload: once('file_upload'),
  introductory_email: once('introductory_email'),
  copy_event: once('copy_event'),
  service_order_items: once('service_order_items'),
  edit_service_orders: once('edit_service_orders'),
  navigation: once('navigation'),
};

const allThresholds: { [scenario: string]: { [metric: string]: string[] } } = {
  opportunities: opportunitiesThresholds,
  file_upload: fileUploadThresholds,
  introductory_email: introductoryEmailThresholds,
  copy_event: copyEventThresholds,
  service_order_items: serviceOrderItemsThresholds,
  edit_service_orders: editServiceOrdersThresholds,
  navigation: navigationThresholds,
};

const selected = __ENV.SCENARIO;
if (selected && !allScenarios[selected]) {
  throw new Error(`Unknown SCENARIO "${selected}" — valid: ${Object.keys(allScenarios).join(', ')}`);
}

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
  const version = fetch_server_version();
  const soPool = discover_service_order_pool(version, users[0]);
  console.log(`Server version: ${version}`);
  console.log(`Smoke: ${soPool.length} seeded service order(s) discovered`);
  return { version, users, soPool };
}

export function opportunities(data: SmokeSetup) {
  opportunities_journey(pick_user(data.users), data);
}

export function file_upload(data: SmokeSetup) {
  file_upload_journey(pick_user(data.users), data, opportunityTemplate);
}

export function introductory_email(data: SmokeSetup) {
  introductory_email_journey(pick_user(data.users), data);
}

export function copy_event(data: SmokeSetup) {
  copy_event_journey(pick_user(data.users), data);
}

export function service_order_items(data: SmokeSetup) {
  service_order_items_journey(pick_user(data.users), data);
}

export function edit_service_orders(data: SmokeSetup) {
  edit_service_orders_journey(pick_user(data.users), data, sampleDocument);
}

export function navigation(data: SmokeSetup) {
  navigation_journey(pick_user(data.users), data);
}
