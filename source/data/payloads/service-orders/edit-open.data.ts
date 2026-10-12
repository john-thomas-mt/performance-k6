import { format_retrieve_stamp } from '../../../utils/exports/helpers.exp.ts';
import { ServiceOrderRow } from '../../../utils/exports/types.exp.ts';

export const serviceOrderEditOpenPayload = (row: ServiceOrderRow, wdwid: string, refreshKey: number) => [
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
  ],
  wdwid,
  2,
  4,
  0,
  0,
  format_retrieve_stamp(String(refreshKey)),
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];

export const serviceOrderEditReopenPayload = (row: ServiceOrderRow, wdwid: string, refreshKey: number) => [
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
  2,
  4,
  0,
  0,
  format_retrieve_stamp(String(refreshKey)),
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];

export const serviceOrderEditItemsFormPayload = (row: ServiceOrderRow, wdwid: string, refreshKey: number) => [
  [
    {
      Key: 'OrgCode',
      Value: row.orgCode,
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
      Key: 'RowKeyList',
      Value: `${row.orgCode}|${row.orderNbr}`,
    },
    {
      Key: 'RefreshDependentKey',
      Value: refreshKey,
    },
    {
      Key: 'OrderNbr',
      Value: Number(row.orderNbr),
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
    {
      Key: 'MenuObjectID',
      Value: 5,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 4,
    },
    {
      Key: 'EventSuiteID',
      Value: Number(row.eventSuiteId),
    },
    {
      Key: 'DeptCode',
      Value: '',
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
      Key: 'WindowObjectID',
      Value: 456,
    },
  ],
  wdwid,
  2,
  456,
  0,
  0,
  format_retrieve_stamp(String(refreshKey)),
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];

export const serviceOrderEditDocumentFormPayload = (
  row: ServiceOrderRow,
  fileKey: string,
  fileName: string,
  wdwid: string,
  refreshKey: number,
) => [
  [
    {
      Key: 'OrgCode',
      Value: row.orgCode,
    },
    {
      Key: 'WindowObjectID',
      Value: 26,
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
      Key: 'RowKeyList',
      Value: `${row.orgCode}|${row.orderNbr}`,
    },
    {
      Key: 'RefreshDependentKey',
      Value: refreshKey,
    },
    {
      Key: 'OrderNbr',
      Value: Number(row.orderNbr),
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
    {
      Key: 'MenuObjectID',
      Value: 26,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 4,
    },
    {
      Key: 'EventSuiteID',
      Value: Number(row.eventSuiteId),
    },
    {
      Key: 'DeptCode',
      Value: '',
    },
    {
      Key: 'IsExternalDropFile',
      Value: false,
    },
    {
      Key: 'documentSubject',
      Value: 'ORD',
    },
    {
      Key: 'Mode',
      Value: 'IMPORT',
    },
    {
      Key: 'FileKey',
      Value: fileKey,
    },
    {
      Key: 'FileName',
      Value: fileName,
    },
    {
      Key: 'IsWebAddinInstalled',
      Value: false,
    },
  ],
  wdwid,
  1,
  26,
  4,
  0,
  format_retrieve_stamp(String(refreshKey)),
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];
