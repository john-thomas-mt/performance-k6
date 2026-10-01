/* Captured order-upsell drawer open (window EM3883, object 2556, in-memory) the browser fires after the first Save2 returns the OrderUpsell prompt. SuggestedOrderUpsell is the prompt's own suggestion table, serialized; the column-cache stamp is correlated from GetObjectColumns(2556). 19853 is the drawer's 'Confirm Selections' dictionary phrase id. */
export const orderUpsellDrawerPayload = (suggestedUpsell: string, columnStamp: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'wdwid',
      Value: 'EM3883',
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
      Key: 'WindowObjectID',
      Value: 2556,
    },
    {
      Key: 'SuggestedOrderUpsell',
      Value: suggestedUpsell,
    },
    {
      Key: 'InMemorySave',
      Value: 'Y',
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
  'EM3883',
  2,
  2556,
  0,
  0,
  columnStamp,
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [19853],
  true,
];
