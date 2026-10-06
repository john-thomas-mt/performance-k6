import { PurchaseOrderWindows } from '../../../utils/exports/types.exp.ts';

/* Captured purchase order items search open (GenericSearchServer/GetInitialData2). ResultsCount is the row count the browser held from the previous items search: 0 before the item is saved, 1 after. */
export const purchaseOrderItemsSearchPayload = (windows: PurchaseOrderWindows, poNbr: string, resultsCount: number) => [
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
      Value: 2,
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
      Value: 81,
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
      Value: true,
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
      Key: 'IsUsedForSectionFiltering',
      Value: 'Y',
    },
  ],
  windows.editWdwid,
  0,
  89,
  81,
  0,
  {
    AutoRefresh: 'N',
    EnterUserID: 'USISETTING',
    FilterCriteria: '',
    ID: 2365,
    ObjectID: 89,
    OrgCode: null,
    ResultsCount: resultsCount,
    ResultsLimit: 0,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [
      {
        ID: 1344839,
        SearchID: 2365,
        ThemeID: 0,
        UserID: '',
        ObjectID: 89,
        ObjectColumnID: 3398,
        FilterType: 1,
        Operand: 'IN',
        Value: 'E,A,O,H,I,C',
        LikeType: 0,
        ToUpper: 'N',
        CustomXML: '',
        EnterUserID: 'USISETTING',
        UpdateUserID: 'USISETTING',
        Value2: '',
        Operand2: '',
        TrailingOperand: 'AND',
        UsedInList: false,
        UsedInList2: false,
        ForceUnparameterized: false,
        AbsoluteValue: false,
        ConvertedToUserDisplayTimeZone: false,
      },
    ],
    ThemeID: 0,
    USIID: 4038,
    UpdateUserID: 'USISETTING',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  2,
  [],
  true,
];
