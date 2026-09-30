import { JSONValue } from 'k6';

export type ContactRow = {
  name: string;
  email: string;
  acctClass: string;
  evtSalesDesig: string;
  pubRelDesig: string;
  memberDesig: string;
  arDesig: string;
  apDesig: string;
  visitorDesig: string;
  regisDesig: string;
  persDesig: string;
  spkrDesig: string;
  attendeeDesig: string;
  primaryAcct: string;
  acctCode: string;
  orgCode: string;
  rowKey: string;
};

export type ServiceOrderForm = {
  layoutId: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type ServiceOrderFormLayout = {
  d1: number;
  d3: number;
};

export type ServiceOrderFormBag = {
  StartDate?: string;
  EndDate?: string;
  Status?: string;
};

export type ServiceOrderEventMatch = {
  Key: string;
  Value: string;
};

export type ServiceOrderPrompt = {
  MessageKey?: string;
  MessageMode?: number;
  MessageAnswer?: number;
  MessageData?: JSONValue;
};

export type ContactServiceOrderSaveResult = {
  ResultValue: number;
  MessageInfoList?: ServiceOrderPrompt[] | null;
};
