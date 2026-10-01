export type PaymentReceiptRow = {
  UserID: string;
  Account: string;
  Payseq: string;
  CC: string;
};

export type PaymentReceiptReportResult = {
  MimeType: string;
  Description: string;
  ReportData: string;
};
