import { TransportTable } from './common.type.ts';

export type VoucherProcessingWindows = {
  listWdwid: string;
  batchAddWdwid: string;
  batchEditWdwid: string;
  voucherAddWdwid: string;
  voucherEditWdwid: string;
  poSelectWdwid: string;
  postWdwid: string;
};

export type VoucherBatchDefaults = {
  glDate: string;
  fiscalPeriod: string;
};

export type VoucherSupplier = {
  key: string;
  name: string;
};

export type VoucherPurchaseOrderLine = {
  table: TransportTable;
  rowKey: string;
};

export type VoucherSaveResult = {
  ResultValue: number;
  ErrorCodes: string[] | null;
  AddedRowKeys: string[] | null;
};

export type VoucherPostForm = {
  table: TransportTable;
  refreshKey: string;
};

export type VoucherComboRow = {
  Key: string;
  Value: string;
};
