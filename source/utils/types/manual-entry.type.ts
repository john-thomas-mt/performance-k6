export type ManualEntryPayload = {
  eventName: string;
  companyName: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  eventStartDate: string;
  eventEndDate: string;
  contactPhone: string;
  expectedAttendees: number;
  budgetRange: string;
};

export type ManualEntryResult = {
  status: string;
  timestamp: string;
};
