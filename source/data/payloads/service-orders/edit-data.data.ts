import { ServiceOrderRow } from '../../../utils/exports/types.exp.ts';

export const serviceOrderEditDataPayload = (row: ServiceOrderRow, wdwid: string, refreshKey: number) => [
  [
    {
      Key: 'OrgCode',
      Value: row.orgCode,
    },
    {
      Key: 'WindowObjectID',
      Value: 4,
    },
    {
      Key: 'wdwid',
      Value: wdwid,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 2,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 0,
    },
    {
      Key: 'MenuType',
      Value: 4,
    },
    {
      Key: 'OrdAcct',
      Value: row.ordAcct,
    },
    {
      Key: 'EvtID',
      Value: Number(row.evtId),
    },
    {
      Key: 'OrdBillTo',
      Value: row.billTo,
    },
    {
      Key: 'ExhibitorID',
      Value: Number(row.exhibitorId),
    },
    {
      Key: 'FuncID',
      Value: Number(row.funcId),
    },
    {
      Key: 'InvoiceNbr',
      Value: Number(row.invoice),
    },
    {
      Key: 'OrdCntct',
      Value: row.ordContact,
    },
    {
      Key: 'OrdReqCntct',
      Value: row.reqContact,
    },
    {
      Key: 'OrdSalesPer',
      Value: row.salesPer,
    },
    {
      Key: 'Occurrence',
      Value: Number(row.occurrence),
    },
    {
      Key: 'OrderType',
      Value: row.orderType,
    },
    {
      Key: 'PriceList',
      Value: row.priceList,
    },
    {
      Key: 'OrdReq',
      Value: row.reqCust,
    },
    {
      Key: 'OrderPhase',
      Value: row.resPhase,
    },
    {
      Key: 'OrdShipTo',
      Value: row.shipTo,
    },
    {
      Key: 'OrdShipToCntct',
      Value: row.shipToContact,
    },
    {
      Key: 'OrdCatSeq',
      Value: row.ordCatSeq,
    },
    {
      Key: 'EvtDesig',
      Value: row.evtDesig,
    },
    {
      Key: 'AcctClass',
      Value: row.acctClass,
    },
    {
      Key: 'EvtStatus',
      Value: row.evtStatus,
    },
    {
      Key: 'RowKeyList',
      Value: `${row.orgCode}|${row.orderNbr}`,
    },
    {
      Key: 'RefreshDependentKey',
      Value: refreshKey,
    },
    {
      Key: 'OrderNbr',
      Value: row.orderNbr,
    },
    {
      Key: 'ForceOneColumnLayout',
      Value: false,
    },
    {
      Key: 'ShowHelpTextInfo',
      Value: true,
    },
    {
      Key: 'MoveGeneralSectionToNewTab',
      Value: true,
    },
    {
      Key: 'ShowQuickInfoHeader',
      Value: true,
    },
    {
      Key: 'SectionUDFSets',
      Value: '41|-125|10|C|25',
    },
    {
      Key: 'Status',
      Value: row.status,
    },
    {
      Key: 'RateType',
      Value: 'AD',
    },
  ],
  wdwid,
  4,
  2,
  39492,
  5451,
  4,
  0,
  0,
  {
    '0': [],
    '1': [
      73395, 11317, 54123, 55876, 2753, 4311, 54258, 4348, 4315, 440, 21101, 54269, 622, 4314, 91980, 1603, 11003, 18066, 1604, 6044, 74041,
      623,
    ],
    '10': [34640, 124119, 11885, 11007, 23698, 54270, 4313, 54271, 4316, 4317],
    '16': [3426],
    '21': [1634],
    '23': [40305],
    '26': [5026],
    '27': [21393],
    '41': [-1090125001, -1090125003, -1090125002, -1090125004, -1090125005],
    '52': [25002],
    '122': [441, 103540, 51274, 67149, 18064, 26896, 56646, 4312, 32223],
    '145': [],
    '174': [36334],
    '280': [],
    '314': [],
    '421': [43262],
    '439': [],
    '1123': [94116],
    '1716': [],
    '1717': [],
  },
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  true,
];
