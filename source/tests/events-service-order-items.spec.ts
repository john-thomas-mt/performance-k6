import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { loginToEvents } from '../flows/login.flow.ts';
import { pickUser } from '../helpers/users.helper.ts';
import { searchEvents } from '../apis/events.api.ts';
import { loadServiceOrders, openServiceOrderDetail, saveServiceOrderItems } from '../apis/service-orders.api.ts';
import { fetchServerVersion } from '../helpers/version.helper.ts';
import { loadProfile, commonThresholds } from '../config/profiles.config.ts';
import { User, SetupData } from '../types/common.type.ts';
import { EventRow } from '../types/events.type.ts';
import { ServiceOrderRow } from '../types/service-orders.type.ts';
import { users as userData } from '../data/users.data.ts';

const users = new SharedArray<User>('users', () => userData);

const SOURCE_EVENT = __ENV.SOURCE_EVENT || 'Manual Test Event 1';
const ITEM_QUANTITY = Number(__ENV.ITEM_QUANTITY || 2);

export const options: Options = {
  ...loadProfile(),
  thresholds: {
    ...commonThresholds,
    'http_req_duration{name:SignIn}': ['p(95)<2000'],
    'http_req_duration{name:SearchEvents}': ['p(95)<3000'],
    'http_req_duration{name:LoadServiceOrders}': ['p(95)<5000'],
    'http_req_duration{name:OpenServiceOrderDetail}': ['p(95)<5000'],
    'http_req_duration{name:SaveServiceOrderItems}': ['p(95)<5000'],
    checks: ['rate>0.95'],
  },
};

export function setup(): SetupData {
  if (users.length === 0) {
    throw new Error('data/users.ts is empty — add at least one user entry');
  }
  const version = fetchServerVersion();
  console.log(`Server version: ${version}`);
  console.log(`Test starting with ${users.length} user(s) in pool`);
  return { version };
}

// An addable service order: a standard SO on the same price list as the
// templated items, with a billing contact (matches the explored save shape).
function isAddable(so: ServiceOrderRow): boolean {
  return so.orderType === 'SO' && so.priceList === '2022SPL' && so.btoContact.length > 0;
}

export default function serviceOrderItemsTest(data: SetupData) {
  const user = pickUser(users);

  const { bearerToken, encUserId } = loginToEvents(user, data.version);
  if (!bearerToken || !encUserId) return;

  let sourceRef: EventRow | null = null;
  group('3. Search Source Event', () => {
    const rows = searchEvents(bearerToken, data.version, SOURCE_EVENT);
    sourceRef = rows.find((r) => r.desc === SOURCE_EVENT) || null;
    check(null, {
      'Source event found': () => Boolean(sourceRef && sourceRef.evtId),
    });
  });
  const event = sourceRef as EventRow | null;
  if (!event || !event.evtId) return;

  let serviceOrderRef: ServiceOrderRow | null = null;
  group('4. Load Service Orders', () => {
    const orders = loadServiceOrders(bearerToken, data.version, event);
    const candidates = orders.filter(isAddable);
    // Distinct order per VU/iteration to keep concurrent saves off the same order.
    if (candidates.length > 0) {
      serviceOrderRef = candidates[(__VU - 1 + __ITER) % candidates.length];
    }
    check(null, {
      'Addable service order found': () => Boolean(serviceOrderRef && serviceOrderRef.orderNbr),
    });
  });
  const serviceOrder = serviceOrderRef as ServiceOrderRow | null;
  if (!serviceOrder || !serviceOrder.orderNbr) return;

  group('5. Edit Service Order', () => {
    openServiceOrderDetail(bearerToken, data.version, serviceOrder);
  });

  group('6. Add & Save Service Order Items', () => {
    const result = saveServiceOrderItems(bearerToken, data.version, serviceOrder, ITEM_QUANTITY);
    if (result) console.log(`[VU ${__VU}] Added items to service order ${serviceOrder.orderNbr}`);
    check(null, {
      'Service order items saved': () => Boolean(result),
    });
  });

  sleep(1);
}

export function teardown() {
  console.log('Service order items test complete');
}
