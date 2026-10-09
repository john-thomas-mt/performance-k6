import { ReportDateRange } from '../../../utils/exports/types.exp.ts';

export const spaceUtilizationReportPayload = (range: ReportDateRange) => ({
  ExportType: 5,
  Language: '',
  RunAsUserID: '',
  Parameters: [
    { ParameterName: 'SpaceType', Values: ['*ALL'] },
    { ParameterName: 'EventType', Values: ['*ALL'] },
    { ParameterName: 'SpaceCode', Values: ['*ALL'] },
    { ParameterName: 'StartDate', Values: [`${range.startDate} 00:00:00`] },
    { ParameterName: 'EndDate', Values: [`${range.endDate} 23:59:59`] },
  ],
});
