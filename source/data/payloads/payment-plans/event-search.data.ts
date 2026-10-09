/* The event combo resolves a typed event name to its key, which feeds the order filter. */
export const paymentPlanEventSearchPayload = (eventName: string) => [
  '10',
  1,
  0,
  2753,
  eventName,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'MultiSelect',
      Value: 'Y',
    },
    {
      Key: 'ShowCancelledEvents',
      Value: 'N',
    },
  ],
  201,
  "EV200_EVT_STATUS >= '0' AND EV200_EVT_STATUS < '90' ",
  0,
  0,
  true,
];
