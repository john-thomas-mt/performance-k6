import { check, group, sleep } from 'k6';
import { loginToEvents } from './login.flow.ts';
import { searchEvents, loadServiceOrders, openServiceOrderDetail, saveServiceOrderItems } from '../utils/exports/apis.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import { User, ServiceOrderSetup, EventRow } from '../utils/exports/types.exp.ts';

const ITEM_QUANTITY = Number(__ENV.ITEM_QUANTITY || 2);

export function discoverServiceOrderPool(version: string, user: User) {
  const { bearerToken } = loginToEvents(user, version);
  if (!bearerToken) {
    throw new Error('setup login failed — cannot discover the seeded pool');
  }

  const seedEvent = searchEvents(bearerToken, version, config.seedEventDesc)
    .filter((e) => e.desc.startsWith(config.seedEventDesc))
    .reduce<EventRow | null>((newest, e) => (newest && Number(newest.evtId) >= Number(e.evtId) ? newest : e), null);
  if (!seedEvent) {
    throw new Error(`seed event "${config.seedEventDesc}" not found — run source/seeds/service-orders.seed.ts after the snapshot reset`);
  }

  const pool = loadServiceOrders(bearerToken, version, seedEvent);
  if (pool.length === 0) {
    throw new Error(`seed event "${config.seedEventDesc}" has no service orders — reseed with a larger SEED_COUNT`);
  }
  return pool;
}

export const serviceOrderItemsThresholds = {
  'http_req_duration{name:OpenServiceOrderDetail}': ['p(95)<5000'],
  'http_req_duration{name:SaveServiceOrderItems}': ['p(95)<5000'],
};

export function serviceOrderItemsJourney(user: User, data: ServiceOrderSetup) {
  const { bearerToken } = loginToEvents(user, data.version);
  if (!bearerToken) return;

  const serviceOrder = data.soPool[(__VU - 1 + __ITER) % data.soPool.length];

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
