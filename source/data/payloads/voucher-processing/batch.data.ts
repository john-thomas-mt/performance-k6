import { coerce_transport_types } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable, VoucherProcessingWindows } from '../../../utils/exports/types.exp.ts';

/* Opens the Add Voucher Batch form; the column stamp is the one the Voucher Processing column read returned. */
export const voucherBatchFormPayload = (windows: VoucherProcessingWindows, columnStamp: string) => [
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
      Value: windows.batchAddWdwid,
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
    {
      Key: 'MenuObjectID',
      Value: 1138,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 0,
    },
    {
      Key: 'EditWdwID',
      Value: windows.batchEditWdwid,
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
  windows.batchAddWdwid,
  1,
  1138,
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

/* Saves the new voucher batch. The server assigns the batch id on save (row key 10|*AUTO) and returns it in AddedRowKeys; the GL date and fiscal period are the defaults the form open returned. */
export const voucherBatchSavePayload = (windows: VoucherProcessingWindows, description: string, glDate: string, fiscalPeriod: string) => [
  1,
  '10',
  1138,
  0,
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
      Value: 1138,
    },
    {
      Key: 'wdwid',
      Value: windows.batchAddWdwid,
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
    {
      Key: 'MenuObjectID',
      Value: 1138,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 0,
    },
    {
      Key: 'EditWdwID',
      Value: windows.batchEditWdwid,
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
    AddedRowKeys: ['10|*AUTO'],
    ModifiedRowKeys: [],
    DeletedRowKeys: [],
    UnchangedRowKeys: [],
    AdditionalTableKeyAddedRowKeys: [],
    AdditionalTableKeyModifiedRowKeys: [],
    AdditionalTableKeyDeletedRowKeys: [],
    AdditionalTableKeyUnchangedRowKeys: [],
  },
  {
    TransportDataTables: [voucherBatchTable(description, glDate, fiscalPeriod)],
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

const voucherBatchTable = (description: string, glDate: string, fiscalPeriod: string): TransportTable =>
  coerce_transport_types({
    TableName: 'AP110_BATCH',
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
        ColumnName: 'AP110_ENT_STAMP',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 7,
      },
      {
        ColumnName: 'AP110_UPD_STAMP',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 8,
      },
      {
        ColumnName: 'cENT_BY_NAME',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 9,
      },
      {
        ColumnName: 'cUPD_BY_NAME',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 10,
      },
      {
        ColumnName: 'AP110_POSTED_STAMP',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 11,
      },
      {
        ColumnName: 'AP110_POSTED_USER_ID',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 12,
      },
      {
        ColumnName: 'cPOSTED_USER_ID_DESC',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 13,
      },
      {
        ColumnName: 'AP110_BATCH_TYPE',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 14,
      },
      {
        ColumnName: 'AP110_ORG_CODE',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 15,
      },
      {
        ColumnName: 'AP110_BATCH_SOURCE',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 16,
      },
      {
        ColumnName: 'AP110_LOCK_STS',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 17,
      },
      {
        ColumnName: 'AP110_LOCK_USER_ID',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 18,
      },
      {
        ColumnName: 'cUPDATED',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 19,
      },
      {
        ColumnName: 'cFYP',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 20,
      },
      {
        ColumnName: 'cSTATUS_DESC__SORT',
        DataType: 'System.Decimal',
        DefaultValue: null,
        ColumnID: 21,
      },
      {
        ColumnName: 'COMP_ROW_ACCESS',
        DataType: 'System.Int32',
        DefaultValue: null,
        ColumnID: 22,
      },
      {
        ColumnName: 'COMP_UF_AP110_BATCH_TOTAL',
        DataType: 'System.Decimal',
        DefaultValue: null,
        ColumnID: 23,
      },
      {
        ColumnName: 'COMP_UF_AP110_POSTED_STAMP',
        DataType: 'System.DateTime',
        DefaultValue: null,
        ColumnID: 24,
      },
      {
        ColumnName: 'COMP_UF_AP110_BATCH_COUNT',
        DataType: 'System.Int32',
        DefaultValue: null,
        ColumnID: 25,
      },
      {
        ColumnName: 'COMP_AP110_STATUS',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 26,
      },
      {
        ColumnName: 'COMP_AP110_POSTED_USER_ID',
        DataType: 'System.String',
        DefaultValue: null,
        ColumnID: 27,
      },
    ],
    TransportDataRows: [
      {
        Values: {
          '0': description,
          '1': glDate,
          '2': 'U',
          '3': 'Unposted',
          '4': '*AUTO',
          '5': 0,
          '6': 0,
          '7': null,
          '8': null,
          '9': null,
          '10': null,
          '11': null,
          '12': null,
          '13': null,
          '14': 'VO',
          '15': '10',
          '16': 'AP',
          '17': 'N',
          '18': ' ',
          '19': 'Created:  on',
          '20': fiscalPeriod,
          '21': 3,
          '22': 1,
          '23': 0,
          '24': null,
          '25': 0,
          '26': 'U',
          '27': null,
        },
      },
    ],
  });
