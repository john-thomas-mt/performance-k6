import { set_cell, coerce_transport_types, save2_envelope, save2CreateChangeTracking } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable } from '../../../utils/exports/types.exp.ts';
import { bookingSaveContext, functionSaveContext } from './save-context.data.ts';

/* Two-table booking Save2 (GenericDetailServer, windows EB8073/EB8074). The event header table is
   fetched live (bookingFormPayload → GetInitialData2, dates arrive populated from the windowBag) and
   the booked-space child table (ObjectID_15) is fetched from stage_booking_space; this echoes both
   back, setting only the business cells the user would type. AddedRowKeys 10|-1 (event) plus the
   ObjectID_15 additional-table key mark both new rows. Business values mirror create_event so the
   created data is consistent (search *EVTYR). */
export const bookingSavePayload = (
  header: TransportTable,
  space: TransportTable,
  date: string,
  description: string,
  account: string,
  contact: string,
) => {
  for (const col of [
    'EV200_EVT_DESC',
    'EV200_ALT_EVT_DESC',
    'EV200_ALT_EVT_DESC2',
    'EV200_ALT_EVT_DESC3',
    'EV200_ALT_EVT_DESC4',
    'EV200_EVT_LEGAL_NAME',
  ]) {
    set_cell(header, col, description);
  }
  set_cell(header, 'EV200_EVT_ABBREV_NAME', description.slice(0, 20));
  set_cell(header, 'EV200_CUST_NBR', account);
  set_cell(header, 'EV200_BILLTO_ACCT', account);
  set_cell(header, 'EV200_NG_EVT_CONTACT', contact);
  set_cell(header, 'EV200_NG_BILLTO_CONTACT', contact);
  set_cell(header, 'EV200_EVT_SEARCH', '*EVTYR');
  header.TableName = `${Date.now()}`;
  /* The child table is linked to its change-tracking entry by name: it must equal the
     AdditionalTableKey key ('ObjectID_15'), not the epoch name CreateNewRows returns it under. */
  space.TableName = 'ObjectID_15';

  return [
    1,
    '10',
    1,
    0,
    0,
    4,
    1,
    bookingSaveContext(date),
    {
      SaveMode: 0,
      Delete: false,
      Tag: {},
      MessageInfoList: [],
      WorkflowToolbarButtonID: 0,
      AddedRowKeys: ['10|-1'],
      ModifiedRowKeys: [],
      DeletedRowKeys: [],
      UnchangedRowKeys: [],
      AdditionalTableKeyAddedRowKeys: [{ Key: 'ObjectID_15', Value: ['10|-1|-1'] }],
      AdditionalTableKeyModifiedRowKeys: [],
      AdditionalTableKeyDeletedRowKeys: [],
      AdditionalTableKeyUnchangedRowKeys: [],
    },
    { TransportDataTables: [header] },
    { TransportDataTables: [space] },
    save2Refresh,
  ];
};

/* Function Save2 (USIDataGridServer, window EM9685). The function row is fetched live
   (functionRowsPayload → CreateNewRowsWithDefaultValues, populated with the event context) and echoed
   back with the run-unique description set. SaveMode 7; AddedRowKeys carries the event row key. */
export const functionSavePayload = (
  table: TransportTable,
  funcDesc: string,
  space: string,
  account: string,
  evtId: string,
  addedRowKey: string,
  encUserId: string,
  windowVersion: string,
) => {
  /* The CreateNewRows response encodes every cell as a string; the grid Save2 requires each column's
     native type (Int32/Decimal/DateTime as numbers), so coerce the echoed row before sending it back.
     The retrieve stamp, event/function ids and row key already ride through correctly from the response. */
  coerce_transport_types(table);
  set_cell(table, 'EV700_FUNC_DESC', funcDesc);
  set_cell(table, 'EV700_FUNC_SEARCH', funcDesc.toUpperCase());
  /* The app flags the row dirty when the description is typed over the staged default; without it the
     save is treated as unchanged. */
  set_cell(table, 'cDESC_CHANGED', true);
  /* The USIDataGridServer grid Save2 envelope leads with a mode flag then OrgCode/ObjectID
     ([2, '10', 23, 1, 0, 1, 0]); the change-tracking key is the event row key with the new-row suffix
     ('<addedRowKey>|-1'), matching the staged cROW_KEY the server assigned. */
  return save2_envelope(
    [2, '10', 23, 1, 0, 1, 0],
    functionSaveContext(space, account, evtId, addedRowKey, encUserId, windowVersion),
    table,
    { ...save2CreateChangeTracking, SaveMode: 7, AddedRowKeys: [`${addedRowKey}|-1`] },
  );
};

const save2Refresh = {
  AutoRefresh: 'Y',
  EnterUserID: '',
  FilterCriteria: '',
  ID: 0,
  ObjectID: 0,
  OrgCode: null,
  ResultsCount: 0,
  ResultsLimit: 0,
  ResultsTime: 0,
  SearchDesc: '',
  SearchFilters: [],
  ThemeID: 0,
  USIID: 0,
  UpdateUserID: '',
  UserID: '',
  SourceUSIID: 0,
  ConvertToUserDisplayTimeZone: false,
};
