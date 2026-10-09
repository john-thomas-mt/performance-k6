/* Opens the Issue Invoices dialog (window 677 / AR2056) on the first payment plan step; RefreshDependentKey is a client Date.now() echoed through the dialog refresh and save. */
export const paymentPlanInvoiceDialogPayload = (payPlanId: string, refreshKey: number) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'RowKeyList',
      Value: `10|${payPlanId}|1`,
    },
    {
      Key: 'InvoiceTransSource',
      Value: 'PP',
    },
    {
      Key: 'ActualsOnly',
      Value: false,
    },
    {
      Key: 'wdwid',
      Value: 'AR2056',
    },
    {
      Key: 'WindowObjectID',
      Value: 677,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'QuickInvoice',
      Value: false,
    },
    {
      Key: 'RefreshDependentKey',
      Value: refreshKey,
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
  'AR2056',
  2,
  677,
  229,
  0,
  new Date().toISOString().slice(0, 19).replace('T', ' '),
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [10860],
  true,
];
