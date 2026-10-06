import { PurchaseOrderWindows } from '../../../utils/exports/types.exp.ts';

/* Captured purchase order detail open (GenericDetailServer/GetInitialData2) that re-reads the saved order; root[6] is the object-81 column-cache stamp. */
export const purchaseOrderDetailPayload = (windows: PurchaseOrderWindows, poNbr: string, columnStamp: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 81,
    },
    {
      Key: 'wdwid',
      Value: windows.editWdwid,
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
      Value: 0,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 0,
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
  ],
  windows.editWdwid,
  2,
  81,
  0,
  0,
  columnStamp,
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
