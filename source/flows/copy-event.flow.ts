import { check, group, sleep } from 'k6';
import { loginToEvents } from './login.flow.ts';
import { searchEvents, openCopyForm, saveEventCopy, openEventDetail } from '../utils/exports/apis.exp.ts';
import { User, SetupData, EventRow } from '../utils/exports/types.exp.ts';

const SOURCE_EVENT = __ENV.SOURCE_EVENT || 'Manual Test Event 1';

export const copyEventThresholds: Record<string, string[]> = {
  'http_req_duration{name:SearchEvents}': ['p(95)<3000'],
  'http_req_duration{name:OpenCopyForm}': ['p(95)<5000'],
  'http_req_duration{name:SaveEventCopy}': ['p(95)<5000'],
  'http_req_duration{name:SearchNewEvent}': ['p(95)<3000'],
  'http_req_duration{name:OpenEventDetail}': ['p(95)<5000'],
};

export function copyEventJourney(user: User, data: SetupData) {
  const runToken = crypto.randomUUID().split('-')[0];
  const newDescription = `Manual Event Perf Test - ${runToken}`;

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
  const source = sourceRef as EventRow | null;
  if (!source || !source.evtId) return;

  group('4. Open Copy Event Form', () => {
    openCopyForm(bearerToken, data.version, encUserId, source);
  });

  let newEvtIdRef: string | null = null;
  group('5. Save Event Copy', () => {
    newEvtIdRef = saveEventCopy(bearerToken, data.version, encUserId, source, newDescription);
    if (newEvtIdRef) console.log(`[VU ${__VU}] Created event ${newEvtIdRef} — ${newDescription}`);
    check(null, {
      'New event created': () => Boolean(newEvtIdRef),
    });
  });
  const newEvtId = newEvtIdRef as string | null;
  if (!newEvtId) return;

  group('6. Confirm New Event in List', () => {
    const rows = searchEvents(bearerToken, data.version, newDescription, 'SearchNewEvent');
    const match = rows.find((r) => r.desc === newDescription);
    check(null, {
      'New event appears in search': () => Boolean(match),
      'New event id matches saved id': () => Boolean(match && String(match.evtId) === String(newEvtId)),
    });
  });

  group('7. Open New Event & Verify Details', () => {
    openEventDetail(bearerToken, data.version, newEvtId, newDescription);
  });

  sleep(1);
}
