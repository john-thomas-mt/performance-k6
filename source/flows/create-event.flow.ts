import { check, group, sleep } from 'k6';
import { login_to_events } from './login.flow.ts';
import { open_event_create_form, create_event, search_events, open_event_detail } from '../utils/exports/apis.exp.ts';
import { User, SetupData, TransportTable } from '../utils/exports/types.exp.ts';

export const createEventThresholds = {
  'http_req_duration{name:OpenEventCreateForm}': ['p(95)<5000'],
  'http_req_duration{name:CreateEvent}': ['p(95)<5000'],
  'http_req_duration{name:SearchEvents}': ['p(95)<3000'],
  'http_req_duration{name:OpenEventDetail}': ['p(95)<5000'],
};

export function create_event_journey(user: User, data: SetupData) {
  const runToken = crypto.randomUUID().split('-')[0];
  const eventDesc = `Perf Test Event - ${runToken}`;

  const { bearerToken } = login_to_events(user, data.version);

  let formTableRef: TransportTable | null = null;
  group('3. Open Create Event Form', () => {
    formTableRef = open_event_create_form(bearerToken, data.version);
  });
  const formTable = formTableRef!;

  let newEvtIdRef: string | null = null;
  group('4. Create Event', () => {
    newEvtIdRef = create_event(bearerToken, data.version, formTable, eventDesc);
    console.log(`[VU ${__VU}] Created event ${newEvtIdRef} — ${eventDesc}`);
  });
  const newEvtId = newEvtIdRef!;

  group('5. Confirm Event in List', () => {
    const rows = search_events(bearerToken, data.version, eventDesc);
    const match = rows.find((r) => r.desc === eventDesc);
    check(null, {
      'New event appears in search': () => Boolean(match),
      'New event id matches saved id': () => Boolean(match && String(match.evtId) === String(newEvtId)),
    });
  });

  group('6. Open Event & Verify Details', () => {
    open_event_detail(bearerToken, data.version, newEvtId, eventDesc);
  });

  sleep(1);
}
