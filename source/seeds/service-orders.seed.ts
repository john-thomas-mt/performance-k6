import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { loginToEvents } from '../utils/exports/flows.exp.ts';
import { createEvent, createServiceOrder } from '../utils/exports/apis.exp.ts';
import { fetchServerVersion } from '../utils/exports/helpers.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { User, ServiceOrderSeedSetup } from '../utils/exports/types.exp.ts';
import { users as userData } from '../utils/exports/data.exp.ts';

// Bulk prerequisite-data seeder for the service-order-items test. Run once after a snapshot
// reset and before the test: it creates one marker event and SEED_COUNT service orders under it.
// The snapshot owns cleanup, so this script never deletes. SEED_COUNT must be >= the test's peak
// concurrent VUs x iterations so every iteration gets its own order.
//   k6 run -e SEED_COUNT=50 source/seeds/service-orders.seed.ts

const users = new SharedArray<User>('users', () => userData);

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

export function setup(): ServiceOrderSeedSetup {
  if (users.length === 0) {
    throw new Error('data/users.data.ts is empty — add at least one user entry');
  }
  const version = fetchServerVersion();
  const { bearerToken, encUserId } = loginToEvents(users[0], version);
  if (!bearerToken || !encUserId) {
    throw new Error('seed login failed — cannot create the marker event');
  }

  const evtId = createEvent(bearerToken, version, config.seedEventDesc);
  if (!evtId) {
    throw new Error('createEvent failed — aborting seed');
  }

  console.log(`Server version: ${version}`);
  console.log(`Seed event "${config.seedEventDesc}" created: ${evtId}`);
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
