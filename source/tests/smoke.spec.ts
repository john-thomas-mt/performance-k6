import { Options, Scenario } from 'k6/options';
import {
  serviceOrderItemsJourney,
  serviceOrderItemsThresholds,
  discoverServiceOrderPool,
  copyEventJourney,
  copyEventThresholds,
  opportunitiesJourney,
  opportunitiesThresholds,
  fileUploadJourney,
  fileUploadThresholds,
  introductoryEmailJourney,
  introductoryEmailThresholds,
  loginThresholds,
} from '../utils/exports/flows.exp.ts';
import { pickUser, fetchServerVersion, decryptUsers } from '../utils/exports/helpers.exp.ts';
import { commonThresholds, config } from '../utils/exports/config.exp.ts';
import { SmokeSetup } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const opportunityTemplate = open('../data/uploads/momentus-assistant/file-upload/sample-opportunity.txt');

const VUS = Number(__ENV.VUS) || 1;
const ITERS = Number(__ENV.ITERS) || 1;

const once = (exec: string): Scenario => ({
  executor: 'per-vu-iterations',
  vus: VUS,
  iterations: ITERS,
  exec,
});

const allScenarios: Record<string, Scenario> = {
  opportunities: once('opportunities'),
  fileUpload: once('fileUpload'),
  introductoryEmail: once('introductoryEmail'),
  copyEvent: once('copyEvent'),
  serviceOrderItems: once('serviceOrderItems'),
};

const allThresholds: Record<string, Record<string, string[]>> = {
  opportunities: opportunitiesThresholds,
  fileUpload: fileUploadThresholds,
  introductoryEmail: introductoryEmailThresholds,
  copyEvent: copyEventThresholds,
  serviceOrderItems: serviceOrderItemsThresholds,
};

const selected = __ENV.SCENARIO;
if (selected && !allScenarios[selected]) {
  throw new Error(`Unknown SCENARIO "${selected}" — valid: ${Object.keys(allScenarios).join(', ')}`);
}

const activeThresholds: Record<string, string[]> = selected
  ? allThresholds[selected]
  : Object.assign({}, ...Object.values(allThresholds));

export const options: Options = {
  scenarios: selected ? { [selected]: allScenarios[selected] } : allScenarios,
  thresholds: {
    ...commonThresholds,
    ...loginThresholds,
    ...activeThresholds,
    checks: ['rate>0.95'],
  },
};

export async function setup(): Promise<SmokeSetup> {
  const cryptoKey = config.cryptoKey;
  if (!cryptoKey) {
    throw new Error('No decryption key — write temp/secret.json (npm run secret -- --key <pass>)');
  }
  const users = await decryptUsers(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/users.data.ts is empty — add at least one user entry');
  }
  const version = fetchServerVersion();
  const soPool = discoverServiceOrderPool(version, users[0]);
  console.log(`Server version: ${version}`);
  console.log(`Smoke: ${soPool.length} seeded service order(s) discovered`);
  return { version, users, soPool };
}

export function opportunities(data: SmokeSetup) {
  opportunitiesJourney(pickUser(data.users), data);
}

export function fileUpload(data: SmokeSetup) {
  fileUploadJourney(pickUser(data.users), data, opportunityTemplate);
}

export function introductoryEmail(data: SmokeSetup) {
  introductoryEmailJourney(pickUser(data.users), data);
}

export function copyEvent(data: SmokeSetup) {
  copyEventJourney(pickUser(data.users), data);
}

export function serviceOrderItems(data: SmokeSetup) {
  serviceOrderItemsJourney(pickUser(data.users), data);
}
