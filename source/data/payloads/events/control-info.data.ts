import { EventRow, TransportTable } from '../../../utils/exports/types.exp.ts';

/* Window the grid opens the selected event's control info against; a captured constant for this
   window (client-allocated, server-echoed — see rules/scripting.md). GetControlInfo is a
   fire-and-forget read whose response is discarded, so this id is never correlated back. */
const CONTROL_INFO_WINDOW_ID = 'EM8059';
/* Row-access mask the recording sent for the selected row; opaque control-permission bits, echoed
   in a read whose response is discarded, so kept as the captured constant. */
const ROW_ACCESS_MASK = 116;

export const eventControlInfoPayload = (row: EventRow) => [
  '10',
  1,
  0,
  0,
  1,
  0,
  1,
  [
    { Key: 'OrgCode', Value: '10' },
    { Key: 'WindowObjectID', Value: 1 },
    { Key: 'wdwid', Value: CONTROL_INFO_WINDOW_ID },
    { Key: 'WdwType', Value: 1 },
    { Key: 'wdwMode', Value: 0 },
    { Key: 'RemoveEditLayoutLink', Value: false },
    { Key: 'ContextObjectID', Value: 0 },
    { Key: 'MenuType', Value: 1 },
    { Key: 'MenuObjectID', Value: 0 },
    { Key: 'MenuContextObjectID', Value: 0 },
  ],
  { TransportDataTables: [eventControlInfoRow(row)] },
  { [row.rowKey]: [ROW_ACCESS_MASK] },
  [],
  11,
];

const eventControlInfoRow = (row: EventRow): TransportTable => ({
  TableName: String(Date.now()),
  TransportDataColumns: [
    { ColumnName: 'EV200_EVT_DESC', DataType: 'System.String', DefaultValue: null, ColumnID: 0 },
    { ColumnName: 'EV200_EVT_START_DATE', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 1 },
    { ColumnName: 'EV200_EVT_START_TIME', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 2 },
    { ColumnName: 'EV200_EVT_END_DATE', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 3 },
    { ColumnName: 'EV200_EVT_END_TIME', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 4 },
    { ColumnName: 'EV200_CUST_NBR', DataType: 'System.String', DefaultValue: null, ColumnID: 5 },
    { ColumnName: 'EventAccount_EV870_NAME', DataType: 'System.String', DefaultValue: null, ColumnID: 6 },
    { ColumnName: 'EV200_PLN_ATTEND', DataType: 'System.Int32', DefaultValue: null, ColumnID: 7 },
    { ColumnName: 'EV200_EVT_TYPE', DataType: 'System.String', DefaultValue: null, ColumnID: 8 },
    { ColumnName: 'cEVT_TYPE', DataType: 'System.String', DefaultValue: null, ColumnID: 9 },
    { ColumnName: 'EV200_EVT_ID', DataType: 'System.Int32', DefaultValue: null, ColumnID: 10 },
    { ColumnName: 'EV200_EVT_DESIGNATION', DataType: 'System.String', DefaultValue: null, ColumnID: 11 },
    { ColumnName: 'EV200_EVT_STATUS', DataType: 'System.String', DefaultValue: null, ColumnID: 12 },
    { ColumnName: 'cPARENT_EVT_ID', DataType: 'System.Int32', DefaultValue: null, ColumnID: 13 },
    { ColumnName: 'EventAccount_EV870_CLASS', DataType: 'System.String', DefaultValue: null, ColumnID: 14 },
    { ColumnName: 'EV200_LINKED_FUNCS', DataType: 'System.String', DefaultValue: null, ColumnID: 15 },
    { ColumnName: 'EV200_EVT_IN_DATE', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 16 },
    { ColumnName: 'EV200_EVT_IN_TIME', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 17 },
    { ColumnName: 'EV200_PURGE_IND', DataType: 'System.String', DefaultValue: null, ColumnID: 18 },
    { ColumnName: 'EV200_ORG_CODE', DataType: 'System.String', DefaultValue: null, ColumnID: 19 },
    { ColumnName: 'cExcluded_Resource_Categories_Desc', DataType: 'System.String', DefaultValue: null, ColumnID: 20 },
    { ColumnName: 'cExcluded_Resource_Departments_Desc', DataType: 'System.String', DefaultValue: null, ColumnID: 21 },
    { ColumnName: 'cEVT_TYPE__SORT', DataType: 'System.Decimal', DefaultValue: null, ColumnID: 22 },
    { ColumnName: 'cROW_KEY', DataType: 'System.String', DefaultValue: null, ColumnID: 23 },
    { ColumnName: 'GrandTotal', DataType: 'System.String', DefaultValue: null, ColumnID: 24 },
    { ColumnName: 'COMP_EV200_CUST_NBR', DataType: 'System.String', DefaultValue: null, ColumnID: 25 },
    { ColumnName: 'COMP_EV200_EVT_TYPE', DataType: 'System.String', DefaultValue: null, ColumnID: 26 },
  ],
  TransportDataRows: [
    {
      Values: {
        /* Only the cells the recording sent as ${…} tokens are re-correlated from the selected event
           row; the excluded-resource and grand-total cells were null/empty in the recording and are
           left as constants. The response is discarded, so these values are context echo, not identity
           the server persists. DateTime/Int/Decimal columns are coerced from the parsed string. */
        '0': row.desc,
        '1': Number(row.evtStartDate),
        '2': Number(row.evtStartTime),
        '3': Number(row.evtEndDate),
        '4': Number(row.evtEndTime),
        '5': row.acct,
        '6': row.acctName,
        '7': Number(row.plnAttend),
        '8': row.evtType,
        '9': row.cEvtType,
        '10': Number(row.evtId),
        '11': row.desig,
        '12': row.status,
        '13': Number(row.parentEvtId),
        '14': row.acctClass,
        '15': row.linkedFuncs,
        '16': Number(row.evtInDate),
        '17': Number(row.evtInTime),
        '18': row.purgeInd,
        '19': row.orgCode,
        '20': null,
        '21': '',
        '22': Number(row.cEvtTypeSort),
        '23': row.rowKey,
        '24': null,
        '25': row.acct,
        '26': row.evtType,
      },
    },
  ],
});
