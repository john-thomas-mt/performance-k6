/* Lead-source search combo on the Add Lead form: combo 39, field 97658, searched by source code. */
export const leadSourceSearchPayload = (sourceCode: string) => [
  '10',
  39,
  0,
  97658,
  sourceCode,
  [{ Key: 'OrgCode', Value: '10' }],
  201,
  '',
  0,
  0,
  true,
];

/* Account-rep search combo (combo 3, window object 615, field 85321); the recording searches the ADMIN USI rep. */
export const accountRepSearchPayload = (repName: string) => [
  '10',
  3,
  615,
  85321,
  repName,
  [
    { Key: 'OrgCode', Value: '10' },
    { Key: 'PersDesig', Value: '1' },
    { Key: 'IsSelectingAccountRep', Value: true },
    { Key: 'AcctDesig', Value: 'P' },
  ],
  201,
  '',
  0,
  0,
  true,
];

export const accountRepRecentlyUsedPayload = (repKey: string) => ['10', 3, 615, null, [repKey]];
