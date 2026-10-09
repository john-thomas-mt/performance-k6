export type ReportSaveResult = {
  ResultValue: number;
  AddedRowKeys: string[] | null;
  MessageInfoList?: { MessageKey?: string; MessageMode?: number }[];
};

export type ReportListWindowInfo = {
  ContextObjectID: number;
};

export type ReportListContext = {
  superboxWdwid: string;
  contextObjectId: number;
  encUserId: string;
  version: string;
  reportSeq: string;
  reportName: string;
  reportId: string;
};

export type ReportListRow = {
  rptList: string;
  desc: string;
  entStamp: string;
};

export type ReportDateRange = {
  startDate: string;
  endDate: string;
};

export type EventRevenueMetricReportResult = {
  MimeType: string;
  Description: string;
  ReportData: string;
};

export type SpaceUtilizationReportResult = EventRevenueMetricReportResult;

export type OpportunityConversionReportResult = EventRevenueMetricReportResult;
