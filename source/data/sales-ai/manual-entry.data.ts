export const manualEntryPayload = (runToken: string) => ({
  companyName: 'NB Events Global Inc.',
  contactName: 'Michelle Venture',
  contactEmail: `michelle.venture.${runToken}@nbevents.com`,
  eventStartDate: '2030-03-15',
  eventEndDate: '2030-03-16',
  contactPhone: '9876543210',
  expectedAttendees: 200,
  budgetRange: '100000',
});
