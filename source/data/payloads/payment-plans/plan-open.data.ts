/* Opens the saved Payment Plan (window 229 / EM9999, WdwMode 1) for the new plan id. */
export const paymentPlanOpenPayload = (orderNbr: string, payPlanId: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 229,
    },
    {
      Key: 'wdwid',
      Value: 'EM9999',
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 1,
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
      Key: 'PayScheduleCode',
      Value: '',
    },
    {
      Key: 'OrderRowKeys',
      Value: `10|${orderNbr}`,
    },
    {
      Key: 'ContractSeq',
      Value: 0,
    },
    {
      Key: 'OrderType',
      Value: 'SO',
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
      Key: 'PayPlanID',
      Value: Number(payPlanId),
    },
  ],
  'EM9999',
  2,
  229,
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
  [],
  true,
];
