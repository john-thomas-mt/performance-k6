import { Options, Scenario } from 'k6/options';
import {
  book_event_journey,
  bookEventThresholds,
  copy_event_journey,
  copyEventThresholds,
  copy_service_orders_journey,
  copyServiceOrdersThresholds,
  crystal_report_journey,
  crystalReportThresholds,
  room_diagram_upload_journey,
  roomDiagramUploadThresholds,
  discover_service_order_pool,
  loginThresholds,
} from '../utils/exports/flows.exp.ts';
import { pick_user, fetch_server_version, decrypt_users, pace } from '../utils/exports/helpers.exp.ts';
import { commonThresholds, config, load_profile } from '../utils/exports/config.exp.ts';
import { SmokeSetup } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';
import { roomDiagramFiles } from '../data/uploads/events/room-diagrams.index.ts';

const PACING = Number(__ENV.PACING) || 300;

const profile = load_profile('neoload');
if (!profile.stages) {
  throw new Error(`PROFILE "${__ENV.PROFILE ?? 'neoload'}" has no stages — neoload.spec.ts needs a ramping profile`);
}
const stages = profile.stages;

const scenario = (exec: string): Scenario => ({
  executor: 'ramping-vus',
  startVUs: 0,
  stages,
  exec,
});

export const options: Options = {
  batchPerHost: Number(__ENV.BATCH_PER_HOST) || 6,
  noConnectionReuse: __ENV.NO_CONN_REUSE === 'true',
  scenarios: {
    book_event: scenario('book_event'),
    copy_event: scenario('copy_event'),
    copy_service_orders: scenario('copy_service_orders'),
    crystal_report: scenario('crystal_report'),
    room_diagram_upload: scenario('room_diagram_upload'),
  },
  thresholds: {
    ...commonThresholds,
    ...loginThresholds,
    ...bookEventThresholds,
    ...copyEventThresholds,
    ...copyServiceOrdersThresholds,
    ...crystalReportThresholds,
    ...roomDiagramUploadThresholds,
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
  console.log(`NeoLoad: ${soPool.length} seeded service order(s) discovered`);
  return { version, users, soPool };
}

export function book_event(data: SmokeSetup) {
  pace(PACING, () => book_event_journey(pick_user(data.users), data));
}

export function copy_event(data: SmokeSetup) {
  pace(PACING, () => copy_event_journey(pick_user(data.users), data));
}

export function copy_service_orders(data: SmokeSetup) {
  pace(PACING, () => copy_service_orders_journey(pick_user(data.users), data));
}

export function crystal_report(data: SmokeSetup) {
  pace(PACING, () => crystal_report_journey(pick_user(data.users), data));
}

export function room_diagram_upload(data: SmokeSetup) {
  pace(PACING, () => room_diagram_upload_journey(pick_user(data.users), data, roomDiagramFiles));
}
