import { group, sleep } from 'k6';
import { login_to_events } from './login.flow.ts';
import {
  search_events,
  load_service_orders,
  open_service_order_detail,
  load_order_item_catalog,
  save_service_order_items,
} from '../utils/exports/apis.exp.ts';
import { catalogItems, pickCatalogItemRow } from '../utils/exports/data.exp.ts';
import { config } from '../utils/exports/config.exp.ts';
import {
  User,
  ServiceOrderSetup,
  ServiceOrderRow,
  EventRow,
  TransportRow,
  TransportColumn,
  TransportTable,
} from '../utils/exports/types.exp.ts';

const ITEM_QUANTITY = Number(__ENV.ITEM_QUANTITY || 2);

export function discover_service_order_pool(version: string, user: User) {
  const { bearerToken } = login_to_events(user, version);

  const seedEvent = search_events(bearerToken, version, config.seedEventDesc)
    .filter((e) => e.desc.startsWith(config.seedEventDesc))
    .reduce<EventRow | null>((newest, e) => (newest && Number(newest.evtId) >= Number(e.evtId) ? newest : e), null);
  if (!seedEvent) {
    throw new Error(`seed event "${config.seedEventDesc}" not found — run source/seeds/service-orders.seed.ts after the snapshot reset`);
  }

  const pool = load_service_orders(bearerToken, version, seedEvent);
  if (pool.length === 0) {
    throw new Error(`seed event "${config.seedEventDesc}" has no service orders — reseed with a larger SEED_COUNT`);
  }
  return pool;
}

export const serviceOrderItemsThresholds = {
  'http_req_duration{name:OpenServiceOrderDetail}': ['p(95)<5000'],
  'http_req_duration{name:LoadItemCatalog}': ['p(95)<5000'],
  'http_req_duration{name:SaveServiceOrderItems}': ['p(95)<5000'],
};

export function add_service_order_items(token: string, version: string, so: ServiceOrderRow, quantity: number) {
  const rows: TransportRow[] = [];
  const rowKeys: string[] = [];
  let columns: TransportColumn[] = [];
  for (const item of catalogItems) {
    const catalog = load_order_item_catalog(token, version, so, item.filter);
    rows.push(pickCatalogItemRow(catalog, item.seq, quantity));
    columns = catalog.TransportDataColumns;
    rowKeys.push(`${so.orgCode}|${so.priceList}|${item.seq}`);
  }
  const itemsTable: TransportTable = { TableName: 'ObjectID_457', TransportDataColumns: columns, TransportDataRows: rows };
  save_service_order_items(token, version, so, itemsTable, rowKeys);
}

export function service_order_items_journey(user: User, data: ServiceOrderSetup) {
  const { bearerToken } = login_to_events(user, data.version);

  const serviceOrder = data.soPool[(__VU - 1 + __ITER) % data.soPool.length];

  group('3. Edit Service Order', () => {
    open_service_order_detail(bearerToken, data.version, serviceOrder);
  });

  group('4. Add & Save Service Order Items', () => {
    add_service_order_items(bearerToken, data.version, serviceOrder, ITEM_QUANTITY);
    console.log(`[VU ${__VU}] Added items to service order ${serviceOrder.orderNbr}`);
  });

  sleep(1);
}
