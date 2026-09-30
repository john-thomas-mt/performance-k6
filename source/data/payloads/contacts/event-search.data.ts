/* Event search combo on the Add Service Order form (combo 1, field 33600), limited to open events (status 0-79) as recorded. */
export const serviceOrderEventSearchPayload = (eventName: string) => [
  '10',
  1,
  0,
  33600,
  eventName,
  [{ Key: 'OrgCode', Value: '10' }],
  201,
  "EV200_EVT_STATUS >= '0' AND EV200_EVT_STATUS < '80' ",
  0,
  0,
  true,
];

/* Records the picked event in the combo's recently-used list, as the browser does on selection. */
export const serviceOrderEventRecentlyUsedPayload = (eventKey: string) => ['10', 1, 0, null, [eventKey]];
