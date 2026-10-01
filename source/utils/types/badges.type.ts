export type BadgeReportRow = {
  organization: string;
  badgeType: string;
  badgeSeq: string;
  badgeDataType: string;
  order: string;
  registration: string;
  sortSequence: string;
  formatCode: string;
};

export type BadgeReportResult = { MimeType: string; Description: string; ReportData: string };
