import { set_cell, save2_envelope } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable } from '../../../utils/exports/types.exp.ts';

/* Runtime-correlated create-account save (window OA8253, AcctDesig 'C'). The column table is no
   longer hardcoded: the flow fetches it live via GetInitialData2 (accountCreateFormPayload) and
   this builder echoes it back with only the business cell (EV870_NAME) set. Every load-bearing
   default the old capture pinned (org 10, rep, cACCOUNT_CODE '*AUTO', class, desig, id -1) arrives
   pre-populated in the fetched row, so the server assigns the account number and recomputes the
   materialized columns itself. */
const ORG_CODE = '10';
const WINDOW_OBJECT_ID = 285;
const LIST_PAGE_OBJECT_ID = 609;

export const accountCreateFormPayload = () => [
  formContext,
  'OA8253',
  1,
  WINDOW_OBJECT_ID,
  LIST_PAGE_OBJECT_ID,
  0,
  '',
  '',
  null,
  { TransportDataColumns: [], TransportDataRows: [], TableName: '' },
  [],
  true,
];

const SAVE_HEAD = [1, ORG_CODE, WINDOW_OBJECT_ID, LIST_PAGE_OBJECT_ID, 0, 4, 1];

export const accountSavePayload = (table: TransportTable, accountName: string) => {
  set_cell(table, 'EV870_NAME', accountName);
  table.TableName = `${Date.now()}`;
  return save2_envelope(SAVE_HEAD, saveContext, table);
};

const formContext = [
  { Key: 'OrgCode', Value: ORG_CODE },
  { Key: 'WindowObjectID', Value: WINDOW_OBJECT_ID },
  { Key: 'wdwid', Value: 'OA8253' },
  { Key: 'WdwType', Value: 4 },
  { Key: 'wdwMode', Value: 1 },
  { Key: 'RemoveEditLayoutLink', Value: false },
  { Key: 'ContextObjectID', Value: 0 },
  { Key: 'AcctDesig', Value: 'C' },
  { Key: 'MenuType', Value: 1 },
  { Key: 'MenuObjectID', Value: 0 },
  { Key: 'MenuContextObjectID', Value: 0 },
  { Key: 'EditWdwID', Value: 'OA8754' },
  { Key: 'ForceOneColumnLayout', Value: false },
  { Key: 'ShowHelpTextInfo', Value: true },
  { Key: 'MoveGeneralSectionToNewTab', Value: true },
  { Key: 'ShowQuickInfoHeader', Value: true },
];

const saveContext = [
  { Key: 'OrgCode', Value: ORG_CODE },
  { Key: 'WindowObjectID', Value: WINDOW_OBJECT_ID },
  { Key: 'wdwid', Value: 'OA8253' },
  { Key: 'WdwType', Value: 4 },
  { Key: 'wdwMode', Value: 0 },
  { Key: 'RemoveEditLayoutLink', Value: false },
  { Key: 'ContextObjectID', Value: 0 },
  { Key: 'MenuType', Value: 6 },
  { Key: 'AcctDesig', Value: 'C' },
  { Key: 'MenuObjectID', Value: 0 },
  { Key: 'MenuContextObjectID', Value: 0 },
  { Key: 'ListPageObjectID', Value: 3 },
  { Key: 'EditWdwID', Value: 'OA8754' },
  { Key: 'ForceOneColumnLayout', Value: false },
  { Key: 'ShowHelpTextInfo', Value: true },
  { Key: 'MoveGeneralSectionToNewTab', Value: true },
  { Key: 'ShowQuickInfoHeader', Value: true },
  { Key: 'SectionUDFSets', Value: '' },
];
