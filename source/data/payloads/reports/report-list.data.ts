import { ReportListContext, ReportListRow, TransportTable } from '../../../utils/exports/types.exp.ts';

export const reportListSuperboxPayload = (ctx: ReportListContext) => [ctx.superboxWdwid, 498, 0, reportListWindowContext(ctx)];

export const reportListSavePayload = (ctx: ReportListContext, chosen: ReportListRow) => [
  498,
  0,
  reportListWindowContext(ctx),
  {
    SaveMode: 0,
    Delete: false,
    Tag: {},
    MessageInfoList: [],
    WorkflowToolbarButtonID: 0,
    AddedRowKeys: [chosen.rptList],
    ModifiedRowKeys: [],
    DeletedRowKeys: [],
    UnchangedRowKeys: [],
    AdditionalTableKeyAddedRowKeys: [],
    AdditionalTableKeyModifiedRowKeys: [],
    AdditionalTableKeyDeletedRowKeys: [],
    AdditionalTableKeyUnchangedRowKeys: [],
  },
  { TransportDataTables: [reportListRowTable(chosen)] },
  '',
];

const reportListWindowContext = (ctx: ReportListContext) => [
  { Key: 'wdwid', Value: ctx.superboxWdwid },
  { Key: 'WindowObjectID', Value: 498 },
  /* ObjectContextID is the superbox instance's context id, correlated from GetWindowInfo; the
     separate ContextObjectID below is a distinct window field the server always sends as 0. */
  { Key: 'ObjectContextID', Value: ctx.contextObjectId },
  { Key: 'DetailsWdwid', Value: '' },
  { Key: 'DetailsAssembly', Value: '' },
  { Key: 'DetailsClass', Value: '' },
  { Key: 'WdwType', Value: 14 },
  { Key: 'EncUserID', Value: ctx.encUserId },
  { Key: 'Version', Value: ctx.version },
  { Key: 'EditWdwID', Value: ctx.superboxWdwid },
  { Key: 'panel', Value: 'N' },
  { Key: 'MenuType', Value: 3 },
  { Key: 'OrgCode', Value: '10' },
  { Key: 'wdwMode', Value: 0 },
  { Key: 'RemoveEditLayoutLink', Value: false },
  { Key: 'ContextObjectID', Value: 0 },
  { Key: 'ParentWindowType', Value: 10 },
  { Key: 'PWindowObjectID', Value: 94 },
  { Key: 'ParentWindowID', Value: 'WB8108' },
  { Key: 'ParentWindowTitle', Value: 'Home' },
  { Key: 'AssemblyName', Value: '' },
  { Key: 'ClassName', Value: 'home' },
  { Key: 'MenuObjectID', Value: 498 },
  { Key: 'MenuContextObjectID', Value: 516 },
  { Key: 'ForceOneColumnLayout', Value: false },
  { Key: 'ShowHelpTextInfo', Value: true },
  { Key: 'MoveGeneralSectionToNewTab', Value: true },
  { Key: 'ShowQuickInfoHeader', Value: true },
  // ReportSequence is the numeric key the header Save2 returned; RowKeyList is the same value as a string.
  { Key: 'ReportSequence', Value: Number(ctx.reportSeq) },
  { Key: 'ReportName', Value: ctx.reportName },
  { Key: 'ReportID', Value: ctx.reportId },
  { Key: 'ReportType', Value: 'RP' },
  { Key: 'ReportObjectID', Value: 841 },
  { Key: 'RowKeyList', Value: ctx.reportSeq },
];

const reportListColumns = [
  { ColumnName: 'MM842_RPT_LIST', DataType: 'System.String', DefaultValue: null, ColumnID: 0 },
  { ColumnName: 'MM842_DESC', DataType: 'System.String', DefaultValue: null, ColumnID: 1 },
  { ColumnName: 'MM842_ENT_STAMP', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 2 },
  { ColumnName: 'MM842_DEL_STAMP', DataType: 'System.DateTime', DefaultValue: null, ColumnID: 3 },
  { ColumnName: 'MM842_DELETED_BY', DataType: 'System.String', DefaultValue: null, ColumnID: 4 },
];

// ENT_STAMP echoes back as a string from the catalog read but the save requires the native DateTime (epoch number).
const reportListRowTable = (chosen: ReportListRow): TransportTable => ({
  TableName: `${Date.now()}`,
  TransportDataColumns: reportListColumns,
  TransportDataRows: [
    {
      Values: { '0': chosen.rptList, '1': chosen.desc, '2': chosen.entStamp === '' ? null : Number(chosen.entStamp), '3': null, '4': null },
    },
  ],
});
