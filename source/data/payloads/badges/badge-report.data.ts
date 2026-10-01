import { BadgeReportRow } from '../../../utils/exports/types.exp.ts';

export const badgeReportPayload = (row: BadgeReportRow) => ({
  ExportType: 1,
  Language: '',
  RunAsUserID: '',
  Parameters: [
    { ParameterName: '@Organization', Values: [row.organization] },
    { ParameterName: 'BadgeType', Values: [row.badgeType] },
    { ParameterName: 'BadgeSeq', Values: [row.badgeSeq] },
    { ParameterName: 'BadgeDataType', Values: [row.badgeDataType] },
    { ParameterName: '@Order', Values: [row.order] },
    { ParameterName: '@Registration', Values: [row.registration] },
    { ParameterName: 'SortSequence', Values: [row.sortSequence] },
    { ParameterName: 'FormatCode', Values: [row.formatCode] },
  ],
});
