import { coerce_transport_types, echo_cell } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable, VoucherProcessingWindows } from '../../../utils/exports/types.exp.ts';

/* Server-side gate the right-click Post action calls before opening the post form. */
export const voucherCanPostPayload = (windows: VoucherProcessingWindows, batchId: string) => [
  '10',
  1138,
  0,
  0,
  1,
  0,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1138,
    },
    {
      Key: 'wdwid',
      Value: windows.listWdwid,
    },
    {
      Key: 'WdwType',
      Value: 1,
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
      Value: 1,
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
      Value: 'Home - Alex W - manager dash',
    },
    {
      Key: 'AssemblyName',
      Value: '',
    },
    {
      Key: 'ClassName',
      Value: 'home',
    },
  ],
  'CanPostBatch',
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'BatchID',
      Value: batchId,
    },
  ],
];

/* Opens the Post Batch form (object 1138, context 1622). RefreshDependentKey is a client-generated timestamp the save echoes back. */
export const voucherPostFormPayload = (windows: VoucherProcessingWindows, columnStamp: string, batchId: string, refreshKey: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'BatchID',
      Value: batchId,
    },
    {
      Key: 'Posting',
      Value: true,
    },
    {
      Key: 'BatchType',
      Value: 'VO',
    },
    {
      Key: 'wdwid',
      Value: windows.postWdwid,
    },
    {
      Key: 'WindowObjectID',
      Value: 1138,
    },
    {
      Key: 'ObjectContextID',
      Value: 1622,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 1622,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'RefreshDependentKey',
      Value: Number(refreshKey),
    },
    {
      Key: 'WdwContextObjectIDForFav',
      Value: 1622,
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
  windows.postWdwid,
  2,
  1138,
  1622,
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

/* Posts the batch (SaveMode 4 on row 10|<batch>). The batch row echoes the post form response by column name; the COMP_UF totals are the client-computed numeric copies of the batch total and count. */
export const voucherPostSavePayload = (windows: VoucherProcessingWindows, batchId: string, source: TransportTable, refreshKey: string) => [
  1,
  '10',
  1138,
  1622,
  0,
  4,
  2,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'BatchID',
      Value: batchId,
    },
    {
      Key: 'Posting',
      Value: true,
    },
    {
      Key: 'BatchType',
      Value: 'VO',
    },
    {
      Key: 'wdwid',
      Value: windows.postWdwid,
    },
    {
      Key: 'WindowObjectID',
      Value: 1138,
    },
    {
      Key: 'ObjectContextID',
      Value: 1622,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 1622,
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'RefreshDependentKey',
      Value: Number(refreshKey),
    },
    {
      Key: 'WdwContextObjectIDForFav',
      Value: 1622,
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
  {
    SaveMode: 4,
    Delete: false,
    Tag: {},
    MessageInfoList: [],
    WorkflowToolbarButtonID: 0,
    AddedRowKeys: [],
    ModifiedRowKeys: [`10|${batchId}`],
    DeletedRowKeys: [],
    UnchangedRowKeys: [],
    AdditionalTableKeyAddedRowKeys: [],
    AdditionalTableKeyModifiedRowKeys: [],
    AdditionalTableKeyDeletedRowKeys: [],
    AdditionalTableKeyUnchangedRowKeys: [],
  },
  {
    TransportDataTables: [voucherPostTable(source)],
  },
  {
    TransportDataTables: [],
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
];

const voucherPostTable = (source: TransportTable): TransportTable =>
  coerce_transport_types({
    TableName: `${Date.now()}`,
    TransportDataColumns: [
      {
        ColumnName: 'AP110_DESC',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 0,
      },
      {
        ColumnName: 'AP110_GL_TRANS_DATE',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 1,
      },
      {
        ColumnName: 'AP110_STATUS',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 2,
      },
      {
        ColumnName: 'cSTATUS_DESC',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 3,
      },
      {
        ColumnName: 'AP110_BATCH_NBR',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 4,
      },
      {
        ColumnName: 'AP110_BATCH_TOTAL',
        DataType: 'System.Decimal',
        DefaultValue: null,
        ColumnID: 5,
      },
      {
        ColumnName: 'AP110_BATCH_COUNT',
        DataType: 'System.Int32',
        DefaultValue: null,
        ColumnID: 6,
      },
      {
        ColumnName: 'AP110_POSTED_STAMP',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 7,
      },
      {
        ColumnName: 'AP110_POSTED_USER_ID',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 8,
      },
      {
        ColumnName: 'cPOSTED_USER_ID_DESC',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 9,
      },
      {
        ColumnName: 'AP110_BATCH_TYPE',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 10,
      },
      {
        ColumnName: 'AP110_ORG_CODE',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 11,
      },
      {
        ColumnName: 'AP110_BATCH_SOURCE',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 12,
      },
      {
        ColumnName: 'AP110_LOCK_STS',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 13,
      },
      {
        ColumnName: 'AP110_LOCK_USER_ID',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 14,
      },
      {
        ColumnName: 'AP110_UPD_STAMP',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 15,
      },
      {
        ColumnName: 'cFYP',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 16,
      },
      {
        ColumnName: 'cSTATUS_DESC__SORT',
        DataType: 'System.Decimal',
        DefaultValue: null,
        ColumnID: 17,
      },
      {
        ColumnName: 'COMP_ROW_ACCESS',
        DataType: 'System.Int32',
        DefaultValue: null,
        ColumnID: 18,
      },
      {
        ColumnName: 'COMP_UF_AP110_BATCH_TOTAL',
        DataType: 'System.Decimal',
        DefaultValue: null,
        ColumnID: 19,
      },
      {
        ColumnName: 'COMP_UF_AP110_POSTED_STAMP',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 20,
      },
      {
        ColumnName: 'COMP_UF_AP110_BATCH_COUNT',
        DataType: 'System.Int32',
        DefaultValue: null,
        ColumnID: 21,
      },
      {
        ColumnName: 'COMP_AP110_POSTED_USER_ID',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 22,
      },
    ],
    TransportDataRows: [
      {
        Values: {
          '0': echo_cell(source, 'AP110_DESC'),
          '1': echo_cell(source, 'AP110_GL_TRANS_DATE'),
          '2': echo_cell(source, 'AP110_STATUS'),
          '3': echo_cell(source, 'cSTATUS_DESC'),
          '4': echo_cell(source, 'AP110_BATCH_NBR'),
          '5': echo_cell(source, 'AP110_BATCH_TOTAL'),
          '6': echo_cell(source, 'AP110_BATCH_COUNT'),
          '7': echo_cell(source, 'AP110_POSTED_STAMP'),
          '8': echo_cell(source, 'AP110_POSTED_USER_ID'),
          '9': echo_cell(source, 'cPOSTED_USER_ID_DESC'),
          '10': echo_cell(source, 'AP110_BATCH_TYPE'),
          '11': echo_cell(source, 'AP110_ORG_CODE'),
          '12': echo_cell(source, 'AP110_BATCH_SOURCE'),
          '13': echo_cell(source, 'AP110_LOCK_STS'),
          '14': echo_cell(source, 'AP110_LOCK_USER_ID'),
          '15': echo_cell(source, 'AP110_UPD_STAMP'),
          '16': echo_cell(source, 'cFYP'),
          '17': echo_cell(source, 'cSTATUS_DESC__SORT'),
          '18': echo_cell(source, 'COMP_ROW_ACCESS'),
          '19': Number(echo_cell(source, 'AP110_BATCH_TOTAL')),
          '20': null,
          '21': Number(echo_cell(source, 'AP110_BATCH_COUNT')),
          '22': null,
        },
      },
    ],
  });
