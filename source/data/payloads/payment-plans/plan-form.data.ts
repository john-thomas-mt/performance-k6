/* Opens the Payment Plan form (window 229 / EM9965, WdwMode 1) for the order. */
export const paymentPlanFormPayload = (orderNbr: string) => [
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
      Value: 'EM9965',
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
      Key: 'EditWdwID',
      Value: 'EM9999',
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
  'EM9965',
  1,
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
