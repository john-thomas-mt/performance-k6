import { ServiceOrderRow } from '../../../utils/exports/types.exp.ts';

/* Opens the service order detail (window 4 / EM8066, WdwType 3); the context carries the order row the grid returned. */
export const paymentPlanOrderDetailPayload = (row: ServiceOrderRow) => [
  [
    {
      Key: 'OrdAcct',
      Value: row.ordAcct,
    },
    {
      Key: 'EvtID',
      Value: Number(row.evtId),
    },
    {
      Key: 'OrderNbr',
      Value: Number(row.orderNbr),
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
      Value: Number(row.ordCatSeq),
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
      Key: 'OrgCode',
      Value: row.orgCode,
    },
    {
      Key: 'RowKeyList',
      Value: `10|${row.orderNbr}`,
    },
    {
      Key: 'WindowObjectID',
      Value: 4,
    },
    {
      Key: 'WdwType',
      Value: 3,
    },
    {
      Key: 'SplitterOrientation1',
      Value: 0,
    },
    {
      Key: 'wdwid',
      Value: 'EM8066',
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
  ],
  'EM8066',
  0,
  4,
  0,
  0,
  new Date().toISOString().slice(0, 19).replace('T', ' '),
  '',
  '',
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];
