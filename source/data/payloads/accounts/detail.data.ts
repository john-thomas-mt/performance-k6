/* Captured account-detail GetInitialData2 (edit window OA8754). The builder rewrites only the
   AcctCode key to the server-assigned account number from the create response; the request-time
   stamp at [6] is a captured constant the server does not correlate. */
export const accountDetailPayload = (acctCode: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 285,
    },
    {
      Key: 'wdwid',
      Value: 'OA8754',
    },
    {
      Key: 'WdwType',
      Value: 4,
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
      Value: 6,
    },
    {
      Key: 'AcctDesig',
      Value: 'C',
    },
    {
      Key: 'MenuObjectID',
      Value: 0,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 0,
    },
    {
      Key: 'ListPageObjectID',
      Value: 3,
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
      Value: '',
    },
    {
      Key: 'AcctCode',
      Value: acctCode,
    },
  ],
  'OA8754',
  2,
  285,
  609,
  0,
  '2026-07-08 23:37:47',
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
