export const manualEntryPayload = (runToken: string) => ({
  eventName: `Perf Event ${runToken}`,
  companyName: 'NB Events Global Inc.',
  firstName: 'Michelle',
  lastName: 'Venture',
  contactEmail: `michelle.venture.${runToken}@nbevents.com`,
  eventStartDate: '2030-03-15',
  eventEndDate: '2030-03-16',
  contactPhone: '9876543210',
  expectedAttendees: 200,
  budgetRange: '100000',
});
