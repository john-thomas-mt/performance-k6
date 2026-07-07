import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { loginToEvents } from './login.flow.ts';
import {
  openServiceOrderDetail,
  editServiceOrderGeneral,
  saveServiceOrderItems,
  cacheDocumentFile,
  openDocumentForm,
  saveDocument,
  saveAndCloseServiceOrder,
  readOrderHeaderStamps,
} from '../utils/exports/apis.exp.ts';
import { todayMidnightUtc } from '../utils/exports/helpers.exp.ts';
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

export function editServiceOrdersJourney(user: User, data: ServiceOrderSetup, documentFile: ArrayBuffer) {
  const { bearerToken } = loginToEvents(user, data.version);
  if (!bearerToken) return;

  /* Optimistic-concurrency: two iterations editing one order header make the second fail with
     "PrimaryKeyRecordChanged", so give each iteration its own seeded row via a globally-unique index. */
  const serviceOrder = data.soPool[exec.scenario.iterationInTest % data.soPool.length];

  let stamps: { entDateIso: string; updDateIso: string } | null = null;
  group('3. Open Service Order', () => {
    const res = openServiceOrderDetail(bearerToken, data.version, serviceOrder);
    if (res) stamps = readOrderHeaderStamps(res);
  });
  if (!stamps) return;

  /* Order dates >30 days out trigger an "OrderDateGreaterThan30Days" confirm prompt; stay inside
     the window so the save commits without a proceed round-trip. */
  const orderDate = todayMidnightUtc() + 7 * DAY;

  group('4. Edit General (rate & order date)', () => {
    const result = editServiceOrderGeneral(bearerToken, data.version, serviceOrder, orderDate, stamps!);
    check(null, { 'General edit saved': () => Boolean(result) });
  });

  group('5. Add & Save Service Order Items', () => {
    const result = saveServiceOrderItems(bearerToken, data.version, serviceOrder, ITEM_QUANTITY);
    check(null, { 'Service order items saved': () => Boolean(result) });
  });

  group('6. Upload & Import Document', () => {
    const fileKey = cacheDocumentFile(bearerToken, data.version, DOCUMENT_FILE_NAME, documentFile);
    if (!fileKey) return;
    const doc = openDocumentForm(bearerToken, data.version, serviceOrder, fileKey, DOCUMENT_FILE_NAME);
    if (!doc) return;
    const result = saveDocument(bearerToken, data.version, serviceOrder, doc);
    check(null, { 'Document imported': () => Boolean(result) });
  });

  group('7. Save & Close', () => {
    /* Each save bumps the header's update stamp, so re-read detail to refresh the concurrency
       token before the final commit. */
    const res = openServiceOrderDetail(bearerToken, data.version, serviceOrder);
    const fresh = res ? readOrderHeaderStamps(res) : null;
    if (!fresh) return;
    const result = saveAndCloseServiceOrder(bearerToken, data.version, serviceOrder, orderDate, fresh);
    check(null, { 'Order saved & closed': () => Boolean(result) });
  });

  sleep(1);
}
