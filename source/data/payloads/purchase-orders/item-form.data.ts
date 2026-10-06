import { PurchaseOrderDefaults, PurchaseOrderWindows } from '../../../utils/exports/types.exp.ts';

/* Captured Add PO Item form open (GenericDetailServer/GetInitialData2, window object 89). root[6] is the stamp the order re-read (05) returned. */
export const purchaseOrderItemFormPayload = (
  defaults: PurchaseOrderDefaults,
  windows: PurchaseOrderWindows,
  supplierKey: string,
  poNbr: string,
  itemFormStamp: string,
) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 89,
    },
    {
      Key: 'wdwid',
      Value: windows.itemWdwid,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 0,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 0,
    },
    {
      Key: 'MenuType',
      Value: 6,
    },
    {
      Key: 'ParentWindowType',
      Value: 10,
    },
    {
      Key: 'PWindowObjectID',
      Value: 94,
    },
    {
      Key: 'ParentWindowID',
      Value: 'WB8108',
    },
    {
      Key: 'ParentWindowTitle',
      Value: 'Home Ã¢â€”ï¿½ Alex W - manager dash',
    },
    {
      Key: 'AssemblyName',
      Value: '',
    },
    {
      Key: 'ClassName',
      Value: 'home',
    },
    {
      Key: 'documentSubject',
      Value: 'PUR',
    },
    {
      Key: 'MenuObjectID',
      Value: 89,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 81,
    },
    {
      Key: 'ForceOneColumnLayout',
      Value: false,
    },
    {
      Key: 'ShowHelpTextInfo',
      Value: true,
    },
    {
      Key: 'MoveGeneralSectionToNewTab',
      Value: true,
    },
    {
      Key: 'ShowQuickInfoHeader',
      Value: true,
    },
    {
      Key: 'SectionUDFSets',
      Value: '',
    },
    {
      Key: 'PurchaseOrderNbr',
      Value: Number(poNbr),
    },
    {
      Key: 'POSupplierAcctCode',
      Value: supplierKey,
    },
    {
      Key: 'POSupplierCntctCode',
      Value: '',
    },
    {
      Key: 'EvtID',
      Value: 0,
    },
    {
      Key: 'POBillToAcctCode',
      Value: defaults.billTo,
    },
    {
      Key: 'POBillToCntctCode',
      Value: '',
    },
    {
      Key: 'POBuyerAcctCode',
      Value: defaults.buyer,
    },
    {
      Key: 'POShipToAcctCode',
      Value: defaults.shipTo,
    },
    {
      Key: 'POShipToCntctCode',
      Value: '',
    },
    {
      Key: 'FuncID',
      Value: 0,
    },
    {
      Key: 'OrderNbr',
      Value: 0,
    },
    {
      Key: 'PORequesterAcctCode',
      Value: defaults.requestor,
    },
    {
      Key: 'POContractID',
      Value: 0,
    },
    {
      Key: 'RowKeyList',
      Value: `10|${poNbr}`,
    },
    {
      Key: 'Status',
      Value: 'E',
    },
    {
      Key: 'EditWdwID',
      Value: windows.itemEditWdwid,
    },
  ],
  windows.itemWdwid,
  1,
  89,
  81,
  0,
  itemFormStamp,
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];
