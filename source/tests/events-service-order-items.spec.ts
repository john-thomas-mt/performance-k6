import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { loginToEvents } from '../utils/exports/flows.exp.ts';
import { pickUser, fetchServerVersion } from '../utils/exports/helpers.exp.ts';
import { searchEvents, loadServiceOrders, openServiceOrderDetail, saveServiceOrderItems } from '../utils/exports/apis.exp.ts';
import { loadProfile, commonThresholds, config } from '../utils/exports/config.exp.ts';
import { User, ServiceOrderPoolSetup } from '../utils/exports/types.exp.ts';
import { users as userData } from '../utils/exports/data.exp.ts';

const users = new SharedArray<User>('users', () => userData);

const ITEM_QUANTITY = Number(__ENV.ITEM_QUANTITY || 2);

export const options: Options = {
  ...loadProfile(),
  thresholds: {
    ...commonThresholds,
    'http_req_duration{name:SignIn}': ['p(95)<2000'],
    'http_req_duration{name:OpenServiceOrderDetail}': ['p(95)<5000'],
    'http_req_duration{name:SaveServiceOrderItems}': ['p(95)<5000'],
    checks: ['rate>0.95'],
  },
};

// Discover the pre-seeded service-order pool (created by source/seeds/service-orders.seed.ts
// after the snapshot reset). Cleanup is owned by the snapshot, so the journey itself stays
// pure — it only measures the add-items save against a distinct seeded order per VU/iteration.
export function setup(): ServiceOrderPoolSetup {
  if (users.length === 0) {
    throw new Error('data/users.data.ts is empty — add at least one user entry');
  }
  const version = fetchServerVersion();
  const { bearerToken } = loginToEvents(users[0], version);
  if (!bearerToken) {
    throw new Error('setup login failed — cannot discover the seeded pool');
  }

  const seedEvent =
    searchEvents(bearerToken, version, config.seedEventDesc).find((e) => e.desc === config.seedEventDesc) || null;
  if (!seedEvent) {
    throw new Error(
      `seed event "${config.seedEventDesc}" not found — run source/seeds/service-orders.seed.ts after the snapshot reset`
    );
  }

  const pool = loadServiceOrders(bearerToken, version, seedEvent);
  if (pool.length === 0) {
    throw new Error(`seed event "${config.seedEventDesc}" has no service orders — reseed with a larger SEED_COUNT`);
  }

  console.log(`Server version: ${version}`);
  console.log(`Discovered ${pool.length} seeded service order(s) under "${config.seedEventDesc}"`);
  return { version, pool };
}

export default function serviceOrderItemsTest(data: ServiceOrderPoolSetup) {
  const user = pickUser(users);
  const { bearerToken } = loginToEvents(user, data.version);
  if (!bearerToken) return;

  // Distinct seeded order per VU/iteration so concurrent saves never contend on one row.
  const serviceOrder = data.pool[(__VU - 1 + __ITER) % data.pool.length];

  group('3. Edit Service Order', () => {
    openServiceOrderDetail(bearerToken, data.version, serviceOrder);
  });

  group('4. Add & Save Service Order Items', () => {
    const result = saveServiceOrderItems(bearerToken, data.version, serviceOrder, ITEM_QUANTITY);
    if (result) console.log(`[VU ${__VU}] Added items to service order ${serviceOrder.orderNbr}`);
    check(null, {
      'Service order items saved': () => Boolean(result),
    });
  });

  sleep(1);
}
