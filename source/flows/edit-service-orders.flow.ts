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

export const editServiceOrdersThresholds: Record<string, string[]> = {
  'http_req_duration{name:OpenServiceOrderDetail}': ['p(95)<5000'],
  'http_req_duration{name:EditServiceOrderGeneral}': ['p(95)<5000'],
  'http_req_duration{name:SaveServiceOrderItems}': ['p(95)<5000'],
  'http_req_duration{name:CacheFiles}': ['p(95)<5000'],
  'http_req_duration{name:SaveDocument}': ['p(95)<5000'],
  'http_req_duration{name:SaveAndCloseServiceOrder}': ['p(95)<5000'],
};

export function editServiceOrdersJourney(user: User, data: ServiceOrderSetup, documentFile: ArrayBuffer): void {
  const { bearerToken } = loginToEvents(user, data.version);
  if (!bearerToken) return;

  // Each iteration edits its OWN order. This journey modifies the order header, which the
  // server guards with an optimistic-concurrency check — so two concurrent iterations sharing
  // one row would make the second fail with "PrimaryKeyRecordChanged". A globally-unique
  // iteration index (not the __VU+__ITER formula, which collides across VU/iter pairs) keeps
  // every concurrent iteration on a distinct seeded row.
  const serviceOrder = data.soPool[exec.scenario.iterationInTest % data.soPool.length];

  let stamps: { entDateIso: string; updDateIso: string } | null = null;
  group('3. Open Service Order', () => {
    const res = openServiceOrderDetail(bearerToken, data.version, serviceOrder);
    if (res) stamps = readOrderHeaderStamps(res);
  });
  if (!stamps) return;

  // The order date is validated against today: >30 days out triggers an
  // "OrderDateGreaterThan30Days" confirmation prompt (ResultValue 1). Keep the edit
  // inside that window so the save commits without a proceed round-trip.
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
    // Each prior save bumps the header's update timestamp, so re-read detail to refresh the
    // concurrency token before the final commit (mirrors NeoLoad re-reading detail per save).
    const res = openServiceOrderDetail(bearerToken, data.version, serviceOrder);
    const fresh = res ? readOrderHeaderStamps(res) : null;
    if (!fresh) return;
    const result = saveAndCloseServiceOrder(bearerToken, data.version, serviceOrder, orderDate, fresh);
    check(null, { 'Order saved & closed': () => Boolean(result) });
  });

  sleep(1);
}
