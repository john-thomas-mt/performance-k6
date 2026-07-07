import { Options } from 'k6/options';
import { login_to_events } from '../utils/exports/flows.exp.ts';
import { create_event, create_service_order } from '../utils/exports/apis.exp.ts';
import { fetch_server_version, decrypt_users } from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { ServiceOrderSeedSetup } from '../utils/exports/types.exp.ts';
import { userCredentials } from '../utils/exports/data.exp.ts';

const SEED_COUNT = Number(__ENV.SEED_COUNT || 20);
const SEED_VUS = Number(__ENV.SEED_VUS || 5);

export const options: Options = {
  scenarios: {
    seed: {
      executor: 'shared-iterations',
      vus: SEED_VUS,
      iterations: SEED_COUNT,
      maxDuration: '10m',
    },
  },
};

export async function setup() {
  const cryptoKey = config.cryptoKey;
  if (!cryptoKey) {
    throw new Error('No decryption key — write temp/secret.json (npm run secret -- --key <pass>) or pass -e CRYPTO_KEY=...');
  }
  const users = await decrypt_users(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const version = fetch_server_version();
  const { bearerToken, encUserId } = login_to_events(users[0], version);

  const seedEventDesc = `${config.seedEventDesc} ${crypto.randomUUID().split('-')[0]}`;
  const evtId = create_event(bearerToken, version, seedEventDesc);

  console.log(`Server version: ${version}`);
  console.log(`Seed event "${seedEventDesc}" created: ${evtId}`);
  console.log(`Creating ${SEED_COUNT} service order(s) with ${SEED_VUS} VU(s)`);
  return { version, evtId, bearerToken, encUserId };
}

export default function seed_service_orders(data: ServiceOrderSeedSetup) {
  const orderNbr = create_service_order(data.bearerToken, data.version, data.encUserId, data.evtId);
  console.log(`[VU ${__VU}] Created service order ${orderNbr} under event ${data.evtId}`);
}
