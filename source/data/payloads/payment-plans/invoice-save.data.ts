import { coerce_transport_types, save2_envelope } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable } from '../../../utils/exports/types.exp.ts';

/* Captured Issue Invoices Save2 (window AR2056) for the first payment plan step. Submits the dialog table the
   HandleDependentFields2 refresh returned; ModifiedRowKeys is the org code, as in the order invoice save. */
export const paymentPlanInvoiceSavePayload = (payPlanId: string, refreshKey: number, table: TransportTable) =>
  save2_envelope(
    [1, '10', 677, 229, 0, 4, 2],
    [
      { Key: 'OrgCode', Value: '10' },
      { Key: 'RowKeyList', Value: `10|${payPlanId}|1` },
      { Key: 'InvoiceTransSource', Value: 'PP' },
      { Key: 'ActualsOnly', Value: false },
      { Key: 'wdwid', Value: 'AR2056' },
      { Key: 'WindowObjectID', Value: 677 },
      { Key: 'WdwType', Value: 4 },
      { Key: 'QuickInvoice', Value: false },
      { Key: 'RefreshDependentKey', Value: refreshKey },
      { Key: 'ForceOneColumnLayout', Value: false },
      { Key: 'ShowHelpTextInfo', Value: true },
      { Key: 'MoveGeneralSectionToNewTab', Value: true },
      { Key: 'ShowQuickInfoHeader', Value: true },
      { Key: 'SaveSettingsViewID', Value: 0 },
      { Key: 'SaveSettingsViewObject', Value: '' },
      { Key: 'SaveSettingsSearchObject', Value: '' },
    ],
    coerce_transport_types(table),
    paymentPlanInvoiceSaveChangeTracking,
  );

const paymentPlanInvoiceSaveChangeTracking = {
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
