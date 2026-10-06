import { VoucherProcessingWindows } from '../../../utils/exports/types.exp.ts';

/* Opens the Add Voucher form (object 1106) for the batch just created; the column stamp is the one the Add Voucher column read returned. */
export const voucherAddFormPayload = (windows: VoucherProcessingWindows, columnStamp: string, batchId: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherAddWdwid,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 1,
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
      Key: 'BatchID',
      Value: batchId,
    },
    {
      Key: 'EditWdwID',
      Value: windows.voucherEditWdwid,
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
  ],
  windows.voucherAddWdwid,
  1,
  1106,
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

/* Initial read of a grid on the Add Voucher form; the form opens grid objects 1296 and 1261 with the same body apart from the object id. */
export const voucherAddGridInitPayload = (windows: VoucherProcessingWindows, batchId: string, gridObject: number) => [
  '10',
  5451,
  gridObject,
  1106,
  0,
  4,
  1,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherAddWdwid,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 1,
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
      Key: 'BatchID',
      Value: batchId,
    },
    {
      Key: 'EditWdwID',
      Value: windows.voucherEditWdwid,
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
  ],
  2,
  {
    dm1: 0,
    dm2: 0,
    dm3: '',
    dm4: 0,
    dm5: '',
    dm6: 0,
    dm7: 'N',
    dm9: '',
    dm11: '',
    dm12: 0,
    dm13: '',
    dm14: '',
    dm15: false,
    dm16: 0,
    dm17: [],
    dm18: '',
    dm19: false,
    dm20: '',
    dm21: 1,
    dm22: '',
    dm23: '',
    dm24: [],
    dm32: false,
    dm33: 0,
  },
  {
    AutoRefresh: 'Y',
    EnterUserID: '',
    FilterCriteria: '',
    ID: 0,
    ObjectID: 0,
    OrgCode: null,
    ResultsCount: 0,
    ResultsLimit: 0,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 0,
    UpdateUserID: '',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  0,
  [],
  false,
  true,
  true,
  2,
  -1,
  false,
  [0],
  true,
];

/* Search definition for the Voucher PO Detail grid (object 1296) on the Add Voucher form. */
export const voucherAddPoDetailSearchPayload = (windows: VoucherProcessingWindows, batchId: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherAddWdwid,
    },
    {
      Key: 'WdwType',
      Value: 2,
    },
    {
      Key: 'wdwMode',
      Value: 1,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 1106,
    },
    {
      Key: 'BatchID',
      Value: batchId,
    },
    {
      Key: 'EditWdwID',
      Value: windows.voucherEditWdwid,
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
      Key: 'IsUsedForSectionFiltering',
      Value: 'Y',
    },
  ],
  windows.voucherAddWdwid,
  0,
  1296,
  1106,
  0,
  {
    AutoRefresh: 'N',
    EnterUserID: 'USISETTING',
    FilterCriteria: '',
    ID: 7185,
    ObjectID: 1296,
    OrgCode: null,
    ResultsCount: 0,
    ResultsLimit: 0,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 10831,
    UpdateUserID: 'USISETTING',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  2,
  [],
  true,
];

/* Section-filtering search definition (object 1261) on the Add Voucher form. */
export const voucherAddSectionSearchPayload = (windows: VoucherProcessingWindows, batchId: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherAddWdwid,
    },
    {
      Key: 'WdwType',
      Value: 2,
    },
    {
      Key: 'wdwMode',
      Value: 1,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 1106,
    },
    {
      Key: 'BatchID',
      Value: batchId,
    },
    {
      Key: 'EditWdwID',
      Value: windows.voucherEditWdwid,
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
      Key: 'IsUsedForSectionFiltering',
      Value: 'Y',
    },
  ],
  windows.voucherAddWdwid,
  0,
  1261,
  1106,
  0,
  {
    AutoRefresh: 'Y',
    EnterUserID: 'USISETTING',
    FilterCriteria: '',
    ID: 5445,
    ObjectID: 1261,
    OrgCode: null,
    ResultsCount: 0,
    ResultsLimit: 999999999,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 8200,
    UpdateUserID: 'USISETTING',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  2,
  [],
  true,
];

/* Re-opens the saved voucher in the edit window; the form now carries the voucher number the save assigned. */
export const voucherEditFormPayload = (windows: VoucherProcessingWindows, columnStamp: string, batchId: string, voucher: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherEditWdwid,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 1,
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
      Key: 'BatchID',
      Value: batchId,
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
      Key: 'Voucher',
      Value: Number(voucher),
    },
  ],
  windows.voucherEditWdwid,
  2,
  1106,
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

/* Initial read of a grid on the edit form; objects 1296 and 1261 share the body apart from the object id. */
export const voucherEditGridInitPayload = (windows: VoucherProcessingWindows, batchId: string, voucher: string, gridObject: number) => [
  '10',
  5451,
  gridObject,
  1106,
  0,
  4,
  2,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherEditWdwid,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 1,
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
      Key: 'BatchID',
      Value: batchId,
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
      Key: 'Voucher',
      Value: Number(voucher),
    },
  ],
  2,
  {
    dm1: 0,
    dm2: 0,
    dm3: '',
    dm4: 0,
    dm5: '',
    dm6: 0,
    dm7: 'N',
    dm9: '',
    dm11: '',
    dm12: 0,
    dm13: '',
    dm14: '',
    dm15: false,
    dm16: 0,
    dm17: [],
    dm18: '',
    dm19: false,
    dm20: '',
    dm21: 1,
    dm22: '',
    dm23: '',
    dm24: [],
    dm32: false,
    dm33: 0,
  },
  {
    AutoRefresh: 'Y',
    EnterUserID: '',
    FilterCriteria: '',
    ID: 0,
    ObjectID: 0,
    OrgCode: null,
    ResultsCount: 0,
    ResultsLimit: 0,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 0,
    UpdateUserID: '',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  0,
  [],
  false,
  true,
  true,
  2,
  -1,
  false,
  [0],
  true,
];

/* Voucher PO Detail search definition (object 1296) on the edit form; ResultsCount is how many rows the search last returned. */
export const voucherEditPoDetailSearchPayload = (
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  resultsCount: number,
) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherEditWdwid,
    },
    {
      Key: 'WdwType',
      Value: 2,
    },
    {
      Key: 'wdwMode',
      Value: 1,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 1106,
    },
    {
      Key: 'BatchID',
      Value: batchId,
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
      Key: 'Voucher',
      Value: Number(voucher),
    },
    {
      Key: 'IsUsedForSectionFiltering',
      Value: 'Y',
    },
  ],
  windows.voucherEditWdwid,
  0,
  1296,
  1106,
  0,
  {
    AutoRefresh: 'N',
    EnterUserID: 'USISETTING',
    FilterCriteria: '',
    ID: 7185,
    ObjectID: 1296,
    OrgCode: null,
    ResultsCount: resultsCount,
    ResultsLimit: 0,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 10831,
    UpdateUserID: 'USISETTING',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  2,
  [],
  true,
];

/* Section-filtering search definition (object 1261) on the edit form. */
export const voucherEditSectionSearchPayload = (
  windows: VoucherProcessingWindows,
  batchId: string,
  voucher: string,
  resultsCount: number,
) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherEditWdwid,
    },
    {
      Key: 'WdwType',
      Value: 2,
    },
    {
      Key: 'wdwMode',
      Value: 1,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 1106,
    },
    {
      Key: 'BatchID',
      Value: batchId,
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
      Key: 'Voucher',
      Value: Number(voucher),
    },
    {
      Key: 'IsUsedForSectionFiltering',
      Value: 'Y',
    },
  ],
  windows.voucherEditWdwid,
  0,
  1261,
  1106,
  0,
  {
    AutoRefresh: 'Y',
    EnterUserID: 'USISETTING',
    FilterCriteria: '',
    ID: 5445,
    ObjectID: 1261,
    OrgCode: null,
    ResultsCount: resultsCount,
    ResultsLimit: 999999999,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 8200,
    UpdateUserID: 'USISETTING',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  2,
  [],
  true,
];

/* Section-filtering search read after a PO line is applied, which adds DestOrgCode to the window context. */
export const voucherEditPoSectionSearchPayload = (windows: VoucherProcessingWindows, batchId: string, voucher: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1106,
    },
    {
      Key: 'wdwid',
      Value: windows.voucherEditWdwid,
    },
    {
      Key: 'WdwType',
      Value: 2,
    },
    {
      Key: 'wdwMode',
      Value: 1,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 1106,
    },
    {
      Key: 'BatchID',
      Value: batchId,
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
      Key: 'Voucher',
      Value: Number(voucher),
    },
    {
      Key: 'DestOrgCode',
      Value: '10',
    },
    {
      Key: 'IsUsedForSectionFiltering',
      Value: 'Y',
    },
  ],
  windows.voucherEditWdwid,
  0,
  1261,
  1106,
  0,
  {
    AutoRefresh: 'Y',
    EnterUserID: 'USISETTING',
    FilterCriteria: '',
    ID: 5445,
    ObjectID: 1261,
    OrgCode: null,
    ResultsCount: 1,
    ResultsLimit: 999999999,
    ResultsTime: 0,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 8200,
    UpdateUserID: 'USISETTING',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  2,
  [],
  true,
];
