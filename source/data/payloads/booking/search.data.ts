/* USISearchComboServer/GetDynamicSearchResults for the billing/event account (window 116). The UI fires
   this when the user picks the account on the booking form; its result key feeds HandleDependentFields2.
   SearchNameOnly is 'N' so the account resolves by code (the runtime value we hold), not its display name. */
export const bookingAccountSearchPayload = (account: string) => [
  '10',
  3,
  0,
  116,
  account,
  [
    { Key: 'SearchNameOnly', Value: 'N' },
    { Key: 'EvtSalesDesig', Value: 'C' },
    { Key: 'AcctDesig', Value: 'C' },
    { Key: 'OrgCode', Value: '10' },
  ],
  201,
  '',
  0,
  0,
  true,
];
