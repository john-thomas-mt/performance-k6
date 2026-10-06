import { JSONObject } from 'k6';

export type PurchaseOrderDefaults = {
  date: string;
  status: string;
  billTo: string;
  buyer: string;
  shipTo: string;
  space: string;
  requestor: string;
};

export type PurchaseOrderWindows = {
  addWdwid: string;
  editWdwid: string;
  itemWdwid: string;
  itemEditWdwid: string;
  listWdwid: string;
  accountWdwid: string;
};

export type PurchaseOrderSupplierFields = {
  tableName: string;
  description: string;
  supplierName: string;
};

export type PurchaseOrderItemCells = {
  itemDesc: string;
  quantity: string;
  taxesAmtEx: string;
  taxesAmtIn: string;
  extCost: string;
  major: string;
  unitCost: string;
  unitCostInc: string;
  cUnitCost: string;
  cExtCost: string;
};

export type PurchaseOrderContext = {
  defaults: PurchaseOrderDefaults;
  windows: PurchaseOrderWindows;
  supplierKey: string;
  departmentKey: string;
  itemKey: string;
  poNbr: string;
  tableName: string;
};

export type PurchaseOrderComboRow = {
  Key: string;
};

export type PurchaseOrderSaveResult = {
  ResultValue: number;
  ErrorCodes: string[] | null;
  AddedRowKeys: string[] | null;
  MessageInfoList?: JSONObject[] | null;
};

export type PurchaseOrderCells = {
  [cell: string]: string;
};

export type PurchaseOrderApprovalFields = {
  poNbr: string;
  description: string;
  supplierKey: string;
  supplierName: string;
  orderDate: string;
  status: string;
  buyer: string;
  totalCost: string;
};

export type PurchaseOrderReceiveFields = {
  poNbr: string;
  description: string;
  supplierKey: string;
  supplierName: string;
  orderDate: string;
  buyer: string;
  billTo: string;
  shipTo: string;
  space: string;
  itemKey: string;
  itemDesc: string;
  quantity: string;
  unitCost: string;
  totalCost: string;
};

export type PurchaseOrderAccessResult = {
  AccessResult?: number;
};

export type PurchaseOrderDetail = {
  stamp: string;
  searchKey: string;
  record: PurchaseOrderCells;
};
