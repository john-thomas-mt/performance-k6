import { group, sleep } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  open_service_order_detail,
  edit_service_order_general,
  save_service_order_items,
  cache_document_file,
  open_document_form,
  save_document,
  save_and_close_service_order,
  read_order_header_stamps,
} from '../utils/exports/apis.exp.ts';
import { today_midnight_utc } from '../utils/exports/helpers.exp.ts';
import { User, ServiceOrderSetup } from '../utils/exports/types.exp.ts';

const DAY = 24 * 60 * 60 * 1000;
const ITEM_QUANTITY = Number(__ENV.ITEM_QUANTITY || 2);
const DOCUMENT_FILE_NAME = 'sample-document.txt';

export const editServiceOrdersThresholds = {
  'http_req_duration{name:OpenServiceOrderDetail}': ['p(95)<5000'],
  'http_req_duration{name:EditServiceOrderGeneral}': ['p(95)<5000'],
  'http_req_duration{name:SaveServiceOrderItems}': ['p(95)<5000'],
  'http_req_duration{name:CacheFiles}': ['p(95)<5000'],
  'http_req_duration{name:SaveDocument}': ['p(95)<5000'],
  'http_req_duration{name:SaveAndCloseServiceOrder}': ['p(95)<5000'],
};

export function edit_service_orders_journey(user: User, data: ServiceOrderSetup, documentFile: ArrayBuffer) {
  const { bearerToken } = login_to_events(user, data.version);

  /* Optimistic-concurrency: two iterations editing one order header make the second fail with
     "PrimaryKeyRecordChanged", so give each iteration its own seeded row via a globally-unique index. */
  const serviceOrder = data.soPool[exec.scenario.iterationInTest % data.soPool.length];

  let stamps: { entDateIso: string; updDateIso: string } | null = null;
  group('3. Open Service Order', () => {
    const res = open_service_order_detail(bearerToken, data.version, serviceOrder);
    stamps = read_order_header_stamps(res);
  });
  const orderStamps = stamps!;

  /* Order dates >30 days out trigger an "OrderDateGreaterThan30Days" confirm prompt; stay inside
     the window so the save commits without a proceed round-trip. */
  const orderDate = today_midnight_utc() + 7 * DAY;

  group('4. Edit General (rate & order date)', () => {
    edit_service_order_general(bearerToken, data.version, serviceOrder, orderDate, orderStamps);
  });

  group('5. Add & Save Service Order Items', () => {
    save_service_order_items(bearerToken, data.version, serviceOrder, ITEM_QUANTITY);
  });

  group('6. Upload & Import Document', () => {
    const fileKey = cache_document_file(bearerToken, data.version, DOCUMENT_FILE_NAME, documentFile);
    const doc = open_document_form(bearerToken, data.version, serviceOrder, fileKey, DOCUMENT_FILE_NAME);
    save_document(bearerToken, data.version, serviceOrder, doc);
  });

  group('7. Save & Close', () => {
    /* Each save bumps the header's update stamp, so re-read detail to refresh the concurrency
       token before the final commit. */
    const res = open_service_order_detail(bearerToken, data.version, serviceOrder);
    const fresh = read_order_header_stamps(res);
    save_and_close_service_order(bearerToken, data.version, serviceOrder, orderDate, fresh);
  });

  sleep(1);
}
