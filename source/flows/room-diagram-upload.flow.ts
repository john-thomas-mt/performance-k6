import { check, group, fail } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  search_events,
  open_event_detail,
  cache_document_file,
  open_event_document_form,
  save_event_document,
  report_application_unloading,
  signalr_negotiate,
} from '../utils/exports/apis.exp.ts';
import {
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
  fetch_bundle_versions,
  think,
} from '../utils/exports/helpers.exp.ts';
import { roomDiagramUploadChrome, roomDiagramUploadStatic, roomDiagramUploadTransport } from '../utils/exports/data.exp.ts';
import { User, SetupData, EventRow, EventDocumentContext, EventDocumentFixture, FidelityLevel } from '../utils/exports/types.exp.ts';

const SEARCH_KEYWORDS = [
  'performance',
  'venue',
  'event',
  'sport',
  'concert',
  'hall',
  'function',
  'center',
  'party',
  'wedding',
  'conference',
  'seminar',
  'class',
  'lunch',
  'dinner',
  'football',
  'soccer',
  'basketball',
  'booking',
  'contract',
  'exhibition',
  'dates',
  'show',
  'club',
  'demo',
];

export const roomDiagramUploadThresholds = {
  'http_req_duration{name:SearchEvents}': ['p(95)<3000'],
  'http_req_duration{name:OpenEventDetail}': ['p(95)<5000'],
  'http_req_duration{name:CacheFiles}': ['p(95)<10000'],
  'http_req_duration{name:OpenEventDocumentForm}': ['p(95)<5000'],
  'http_req_duration{name:SaveEventDocument}': ['p(95)<10000'],
  'http_req_duration{name:ApplicationUnloading}': ['p(95)<3000'],
};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, roomDiagramUploadChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(roomDiagramUploadStatic[step] ?? []);
      fire_transport(token, version, roomDiagramUploadTransport[step] ?? [], subs);
    }
  }
}

export function room_diagram_upload_journey(user: User, data: SetupData, files: EventDocumentFixture[]) {
  const level = fidelity_level();
  const iter = exec.scenario.iterationInTest;
  const wdwid = `AA${90310 + iter}`;
  const keyword = SEARCH_KEYWORDS[iter % SEARCH_KEYWORDS.length];
  const fixture = files[iter % files.length];

  const subs: Subs = {
    'C_USI_Version': data.version,
    'C_EnterpriseVersion': data.version,
    'P_SearchRandomEvent.keyword': keyword,
    'P_IterationNumber': String(iter),
    'NL-VirtualUserId': String(__VU),
    'P_EpochTimestamp': String(Date.now()),
  };

  group('T31_RoomDiagramFileStorage_01_Launch', () => {
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
    }
    chrome_and_static('', data.version, level, ['01'], subs);
  });
  think();

  const { bearerToken } = login_to_events(user, data.version, 'T31_RoomDiagramFileStorage_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T31_RoomDiagramFileStorage_03_ClickOn_Events', () => {
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  let eventRef: EventRow | null = null;
  group('T31_RoomDiagramFileStorage_04_Search_RandomEvents', () => {
    let rows = search_events(bearerToken, data.version, keyword);
    if (rows.length === 0) rows = search_events(bearerToken, data.version, 'event', 'SearchEventsFallback');
    if (!check(null, { 'Event found to attach document': () => rows.some((r) => !!r.evtId) })) {
      fail('no event found to attach a document to');
    }
    const chosen = rows[Math.floor(Math.random() * rows.length)];
    eventRef = chosen;
    subs.C_CUST_NBR_1 = chosen.acct;
    subs.C_EVT_ID_1 = chosen.evtId;
    subs.C_EVT_DESIGNATION_1 = chosen.desig;
    subs.C_EVT_STATUS_1 = chosen.status;
    subs.C_ORG_CODE_1 = chosen.orgCode;
    subs.C_ROW_KEY_1 = chosen.rowKey;
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
  });
  const event = eventRef!;
  think();

  let ctxRef: EventDocumentContext | null = null;
  group('T31_RoomDiagramFileStorage_05_Select_OneRandomEvent', () => {
    const detail = open_event_detail(bearerToken, data.version, event.evtId);
    ctxRef = {
      evtAcct: event.acct,
      evtId: event.evtId,
      evtDesig: event.desig,
      evtStatus: event.status,
      orgCode: event.orgCode,
      rowKey: event.rowKey,
      ...detail,
    };
    subs.C_EV200_NG_EVT_CONTACT = detail.evtCntct;
    subs.C_EV200_SLSPER = detail.evtSalesPer;
    subs.C_EV200_EVT_CATEGORY = detail.evtCategory;
    subs.C_EV200_PRICE_LIST = detail.evtPriceList;
    subs.C_EV200_COORD_1 = detail.coord1;
    subs.C_EV200_COORD_2 = detail.coord2;
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  const ctx = ctxRef!;
  think();

  group('T31_RoomDiagramFileStorage_06_Open_EventDocumentsTab', () => {
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  group('T31_RoomDiagramFileStorage_07_ClickOn_ImportDocument(s)', () => {
    const fileKey = cache_document_file(bearerToken, data.version, fixture.name, fixture.content);
    subs.C_FileKey = fileKey;
    subs['random_file_name'] = fixture.name;
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();

  group('T31_RoomDiagramFileStorage_08_SelectAndClickOn_Import', () => {
    const doc = open_event_document_form(bearerToken, data.version, ctx, subs.C_FileKey, fixture.name, wdwid);
    subs.C_MM446_DOC_DESC = doc.docDesc;
    subs.C_docEvents_EV200_EVT_DESC = doc.evtDesc;
    subs.C_DocAccount_EV870_NAME = doc.acctName;
    save_event_document(bearerToken, data.version, ctx, doc, wdwid);
    console.log(`[VU ${__VU}] Uploaded "${fixture.name}" to event ${event.evtId} (${event.desc})`);
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();

  group('T31_RoomDiagramFileStorage_09_LogOut', () => {
    report_application_unloading(bearerToken, data.version, 'ApplicationUnloading');
    chrome_and_static(bearerToken, data.version, level, ['09'], subs);
  });
  think();
}
