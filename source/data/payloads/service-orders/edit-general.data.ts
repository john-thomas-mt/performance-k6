import { set_cell, save2_envelope } from '../../../utils/exports/helpers.exp.ts';
import { ServiceOrderRow, TransportTable } from '../../../utils/exports/types.exp.ts';

/* Edit General: re-save the order header with a new order date. Runtime-correlated — the caller passes
   the ER100 header table fetched live from the order's detail (GetInitialData2, EM9158); this builder
   echoes it back with only ER100_ORD_DATE changed. The optimistic-concurrency stamps
   (ER100_ENT_DATE_ISO/UPD_DATE_ISO) ride along in the fetched row, so no separate stamp correlation is
   needed — the frozen column table and the read_order_header_stamps step this replaced are both gone.
   SaveMode 7 = save & keep editing, 0 = save & close. */
const ORG_CODE = '10';
const SAVE_HEAD = [1, ORG_CODE, 4, 0, 0, 4, 2];

export const editGeneralSavePayload = (so: ServiceOrderRow, orderDate: number, table: TransportTable, saveMode = 7) => {
  set_cell(table, 'ER100_ORD_DATE', orderDate);
  table.TableName = `${Date.now()}`;
  return save2_envelope(SAVE_HEAD, editContext(so), table, editChangeTracking(so, saveMode));
};

const editContext = (so: ServiceOrderRow) => [
  { Key: 'OrgCode', Value: so.orgCode },
  { Key: 'WindowObjectID', Value: 4 },
  { Key: 'wdwid', Value: 'EM9158' },
  { Key: 'WdwType', Value: 4 },
  { Key: 'wdwMode', Value: 2 },
  { Key: 'RemoveEditLayoutLink', Value: false },
  { Key: 'ContextObjectID', Value: 0 },
  { Key: 'MenuType', Value: 4 },
  { Key: 'OrdAcct', Value: so.ordAcct },
  { Key: 'EvtID', Value: Number(so.evtId) },
  { Key: 'OrdBillTo', Value: so.billTo },
  { Key: 'ExhibitorID', Value: Number(so.exhibitorId) },
  { Key: 'FuncID', Value: Number(so.funcId) },
  { Key: 'InvoiceNbr', Value: Number(so.invoice) },
  { Key: 'OrdCntct', Value: so.ordContact },
  { Key: 'OrdReqCntct', Value: so.reqContact },
  { Key: 'OrdSalesPer', Value: so.salesPer },
  { Key: 'Occurrence', Value: Number(so.occurrence) },
  { Key: 'OrderType', Value: so.orderType },
  { Key: 'PriceList', Value: so.priceList },
  { Key: 'OrdReq', Value: so.reqCust },
  { Key: 'OrderPhase', Value: so.resPhase },
  { Key: 'OrdShipTo', Value: so.shipTo },
  { Key: 'OrdShipToCntct', Value: so.shipToContact },
  { Key: 'OrdCatSeq', Value: so.ordCatSeq },
  { Key: 'EvtDesig', Value: so.evtDesig },
  { Key: 'AcctClass', Value: so.acctClass },
  { Key: 'EvtStatus', Value: so.evtStatus },
  { Key: 'RowKeyList', Value: so.rowKey },
  { Key: 'RefreshDependentKey', Value: Date.now() },
  { Key: 'OrderNbr', Value: so.orderNbr },
  { Key: 'ForceOneColumnLayout', Value: false },
  { Key: 'ShowHelpTextInfo', Value: true },
  { Key: 'MoveGeneralSectionToNewTab', Value: true },
  { Key: 'ShowQuickInfoHeader', Value: true },
  { Key: 'SectionUDFSets', Value: '41|-125|10|C|25' },
  { Key: 'Status', Value: so.status },
];

const editChangeTracking = (so: ServiceOrderRow, saveMode: number) => ({
  SaveMode: saveMode,
  Delete: false,
  Tag: {},
  MessageInfoList: [],
  WorkflowToolbarButtonID: 0,
  AddedRowKeys: [],
  ModifiedRowKeys: [so.rowKey],
  DeletedRowKeys: [],
  UnchangedRowKeys: [],
  AdditionalTableKeyAddedRowKeys: [],
  AdditionalTableKeyModifiedRowKeys: [],
  AdditionalTableKeyDeletedRowKeys: [],
  AdditionalTableKeyUnchangedRowKeys: [],
});
