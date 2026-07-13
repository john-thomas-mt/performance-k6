import { set_cell, save2_envelope, today_midnight_utc } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable } from '../../../utils/exports/types.exp.ts';

/* Runtime-correlated create-event save (window EB8073). The 164-column table is no longer hardcoded:
   the caller fetches it live via GetInitialData2 (eventCreateFormPayload) and this builder echoes it
   back with only the business cells set. Server defaults that arrive pre-populated in the fetched row
   (status 26, price list, sensitivity, issue classes, designation, org) are left untouched; the server
   assigns the event id and recomputes the materialized columns. Business values mirror the original
   capture so the seeded event is unchanged (account 00159220, contact 00167764, sales rep 00154232). */
const ORG_CODE = '10';
const DAY = 24 * 60 * 60 * 1000;
const SAVE_HEAD = [1, ORG_CODE, 1, 0, 0, 4, 1];

export const eventCreateFormPayload = () => [
  formContext,
  'EB8073',
  1,
  1,
  0,
  0,
  '',
  '',
  null,
  { TransportDataColumns: [], TransportDataRows: [], TableName: '' },
  [],
  true,
];

export const eventSavePayload = (table: TransportTable, description: string) => {
  const start = today_midnight_utc() + 30 * DAY;
  const end = today_midnight_utc() + 365 * DAY;
  for (const col of [
    'EV200_EVT_DESC',
    'EV200_ALT_EVT_DESC',
    'EV200_ALT_EVT_DESC2',
    'EV200_ALT_EVT_DESC3',
    'EV200_ALT_EVT_DESC4',
    'EV200_EVT_LEGAL_NAME',
  ]) {
    set_cell(table, col, description);
  }
  set_cell(table, 'EV200_EVT_ABBREV_NAME', description.slice(0, 20));
  set_cell(table, 'EV200_CUST_NBR', '00159220');
  set_cell(table, 'EV200_BILLTO_ACCT', '00159220');
  set_cell(table, 'EV200_NG_EVT_CONTACT', '00167764');
  set_cell(table, 'EV200_NG_BILLTO_CONTACT', '00167764');
  set_cell(table, 'EV200_EVT_SEARCH', '*EVTYR');
  set_cell(table, 'EV200_SLSPER', '00154232');
  set_cell(table, 'EV200_EVT_START_DATE', start);
  set_cell(table, 'EV200_EVT_END_DATE', end);
  set_cell(table, 'EV200_EVT_IN_DATE', start);
  set_cell(table, 'EV200_EVT_OUT_DATE', end);
  set_cell(table, 'EV200_ADV_CUTOFF_DATE', start);
  set_cell(table, 'EV200_STD_CUTOFF_DATE', start);
  table.TableName = `${Date.now()}`;
  return save2_envelope(SAVE_HEAD, saveContext, table);
};

const formContext = [
  { Key: 'OrgCode', Value: ORG_CODE },
  { Key: 'WindowObjectID', Value: 1 },
  { Key: 'wdwid', Value: 'EB8073' },
  { Key: 'WdwType', Value: 4 },
  { Key: 'wdwMode', Value: 1 },
  { Key: 'RemoveEditLayoutLink', Value: false },
  { Key: 'ContextObjectID', Value: 0 },
  { Key: 'MenuType', Value: 1 },
  { Key: 'MenuObjectID', Value: 0 },
  { Key: 'MenuContextObjectID', Value: 0 },
  { Key: 'EditWdwID', Value: 'EB8074' },
  { Key: 'ForceOneColumnLayout', Value: false },
  { Key: 'ShowHelpTextInfo', Value: true },
  { Key: 'MoveGeneralSectionToNewTab', Value: true },
  { Key: 'ShowQuickInfoHeader', Value: true },
];

const saveContext = [
  { Key: 'OrgCode', Value: ORG_CODE },
  { Key: 'WindowObjectID', Value: 1 },
  { Key: 'wdwid', Value: 'EB8073' },
  { Key: 'WdwType', Value: 4 },
  { Key: 'wdwMode', Value: 1 },
  { Key: 'RemoveEditLayoutLink', Value: false },
  { Key: 'ContextObjectID', Value: 0 },
  { Key: 'MenuType', Value: 1 },
  { Key: 'MenuObjectID', Value: 0 },
  { Key: 'MenuContextObjectID', Value: 0 },
  { Key: 'EditWdwID', Value: 'EB8074' },
  { Key: 'ForceOneColumnLayout', Value: false },
  { Key: 'ShowHelpTextInfo', Value: true },
  { Key: 'MoveGeneralSectionToNewTab', Value: true },
  { Key: 'ShowQuickInfoHeader', Value: true },
  { Key: 'SectionUDFSets', Value: '' },
  { Key: 'LinkedFuncs', Value: 'Y' },
];
