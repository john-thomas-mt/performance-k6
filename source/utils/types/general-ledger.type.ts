export type DetailGeneralLedgerRow = {
  userId: string;
  fiscalFrom: string;
  fiscalThru: string;
  accountFrom: string;
  accountThru: string;
  reportFormat: string;
  summary: string;
};

export type DetailGeneralLedgerResult = { MimeType: string; Description: string; ReportData: string };
