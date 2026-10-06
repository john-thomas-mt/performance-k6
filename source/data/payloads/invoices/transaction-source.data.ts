/* Captured Non-Invoiced Orders By Event row action (USIDataGridServer/AccessServerUI, GetInvoiceTransactionSource). The response names the transaction source (EV) the invoice dialog opens with. */
export const invoiceTransactionSourcePayload = (orderNbr: string) => [
  '10',
  280,
  744,
  0,
  1,
  0,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 280,
    },
    {
      Key: 'wdwid',
      Value: 'AR2245',
    },
    {
      Key: 'WdwType',
      Value: 1,
    },
    {
      Key: 'wdwMode',
      Value: 0,
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
      Value: 1,
    },
    {
      Key: 'ParentWindowType',
      Value: 10,
    },
    {
      Key: 'ParentWindowID',
      Value: 'WB8108',
    },
    {
      Key: 'AssemblyName',
      Value: '',
    },
    {
      Key: 'ClassName',
      Value: 'home',
    },
    {
      Key: 'WdwContextObjectIDForFav',
      Value: 744,
    },
  ],
  'GetInvoiceTransactionSource',
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'SelectedRowKeys',
      Value: [`10|${orderNbr}`],
    },
  ],
];
