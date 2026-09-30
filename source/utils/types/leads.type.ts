import { TransportTable } from './common.type.ts';

export type LeadSaveResult = {
  ResultValue: number;
  MessageInfoList?: { MessageKey?: string; MessageMode?: number }[] | null;
};

export type LeadSaveEcho = {
  TransportDataTables: TransportTable[];
};

export type LeadSaveResponse = [LeadSaveResult, LeadSaveEcho];

export type LeadConvertResult = {
  LeadID: string;
  SaveResult: {
    ResultValue: number;
    MessageInfoList: { MessageKey?: string; MessageMode?: number }[] | null;
    SaveResultData: { InvalidResults?: { TransportDataTables: TransportTable[] } } | null;
  };
};

export type LeadSearchComboRow = {
  Key: string;
  Value: string;
};

export type LeadFormLayout = {
  d1: number;
  d3: number;
};

export type LeadFields = {
  companyName: string;
  lastName: string;
  leadSource: string;
  accountRep: string;
  email: string;
  phone: string;
};

export type LeadFormSession = {
  formWdwid: string;
  editWdwid: string;
  layoutId: string;
  tableName: string;
};
