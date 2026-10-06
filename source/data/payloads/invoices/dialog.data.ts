/* Captured Issue Invoices dialog open (GenericDetailServer/GetInitialData2, window AR2056 / object 677). RefreshDependentKey is the client's Date.now() and is echoed back by HandleDependentFields2 and Save2. */
export const invoiceDialogPayload = (orderNbr: string, transSource: string, refreshKey: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'RowKeyList',
      Value: `10|${orderNbr}`,
    },
    {
      Key: 'InvoiceTransSource',
      Value: transSource,
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
      Value: Number(refreshKey),
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
  0,
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
