import { coerce_transport_types, save2_envelope } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable } from '../../../utils/exports/types.exp.ts';

/* Captured Issue Invoices Save2 (window AR2056). Submits the table HandleDependentFields2 returned; the
   server hands DateTime/Int32 cells back as strings but the save needs them native, hence the coercion.
   ModifiedRowKeys is the org code, not the order: the dialog row is a synthetic single-row table. */
export const invoiceSavePayload = (orderNbr: string, transSource: string, refreshKey: string, table: TransportTable) =>
  save2_envelope(
    [1, '10', 677, 0, 0, 4, 2],
    [
      { Key: 'OrgCode', Value: '10' },
      { Key: 'RowKeyList', Value: `10|${orderNbr}` },
      { Key: 'InvoiceTransSource', Value: transSource },
      { Key: 'ActualsOnly', Value: false },
      { Key: 'wdwid', Value: 'AR2056' },
      { Key: 'WindowObjectID', Value: 677 },
      { Key: 'WdwType', Value: 4 },
      { Key: 'QuickInvoice', Value: false },
      { Key: 'RefreshDependentKey', Value: Number(refreshKey) },
      { Key: 'ForceOneColumnLayout', Value: false },
      { Key: 'ShowHelpTextInfo', Value: true },
      { Key: 'MoveGeneralSectionToNewTab', Value: true },
      { Key: 'ShowQuickInfoHeader', Value: true },
      { Key: 'SaveSettingsViewID', Value: 0 },
      { Key: 'SaveSettingsViewObject', Value: '' },
      { Key: 'SaveSettingsSearchObject', Value: '' },
    ],
    coerce_transport_types(table),
    INVOICE_SAVE_CHANGE_TRACKING,
  );

const INVOICE_SAVE_CHANGE_TRACKING = {
  SaveMode: 4,
  Delete: false,
  Tag: {},
  MessageInfoList: [],
  WorkflowToolbarButtonID: 0,
  AddedRowKeys: [],
  ModifiedRowKeys: ['10'],
  DeletedRowKeys: [],
  UnchangedRowKeys: [],
  AdditionalTableKeyAddedRowKeys: [],
  AdditionalTableKeyModifiedRowKeys: [],
  AdditionalTableKeyDeletedRowKeys: [],
  AdditionalTableKeyUnchangedRowKeys: [],
};
