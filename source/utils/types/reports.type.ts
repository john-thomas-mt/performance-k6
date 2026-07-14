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
