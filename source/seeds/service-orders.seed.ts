import { check } from 'k6';
import { Options } from 'k6/options';
import { loginToEvents } from '../utils/exports/flows.exp.ts';
import { createEvent, createServiceOrder } from '../utils/exports/apis.exp.ts';
import { fetchServerVersion, decryptUsers } from '../utils/exports/helpers.exp.ts';
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
  const users = await decryptUsers(userCredentials, cryptoKey);
  if (users.length === 0) {
    throw new Error('data/creds/users.data.ts is empty — add at least one user entry');
  }
  const version = fetchServerVersion();
  const { bearerToken, encUserId } = loginToEvents(users[0], version);
  if (!bearerToken || !encUserId) {
    throw new Error('seed login failed — cannot create the marker event');
  }

  const seedEventDesc = `${config.seedEventDesc} ${crypto.randomUUID().split('-')[0]}`;
  const evtId = createEvent(bearerToken, version, seedEventDesc);
  if (!evtId) {
    throw new Error('createEvent failed — aborting seed');
  }

  console.log(`Server version: ${version}`);
  console.log(`Seed event "${seedEventDesc}" created: ${evtId}`);
  console.log(`Creating ${SEED_COUNT} service order(s) with ${SEED_VUS} VU(s)`);
  return { version, evtId, bearerToken, encUserId };
}

export default function seedServiceOrders(data: ServiceOrderSeedSetup) {
  const orderNbr = createServiceOrder(data.bearerToken, data.version, data.encUserId, data.evtId);
  if (orderNbr) console.log(`[VU ${__VU}] Created service order ${orderNbr} under event ${data.evtId}`);
  check(null, {
    'Service order seeded': () => Boolean(orderNbr),
  });
}
