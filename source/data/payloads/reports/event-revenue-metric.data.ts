import { ReportDateRange } from '../../../utils/exports/types.exp.ts';

export const eventRevenueMetricReportPayload = (range: ReportDateRange) => ({
  ExportType: 5,
  Language: '',
  RunAsUserID: '',
  Parameters: [
    { ParameterName: '@Organization', Values: ['10'] },
    { ParameterName: 'StartDate', Values: [`${range.startDate} 00:00:00`] },
    { ParameterName: 'EndDate', Values: [`${range.endDate} 23:59:59`] },
    { ParameterName: 'EventType', Values: ['*ALL'] },
    { ParameterName: 'SpaceCode', Values: ['*ALL'] },
    { ParameterName: 'Account', Values: ['*ALL'] },
  ],
});
