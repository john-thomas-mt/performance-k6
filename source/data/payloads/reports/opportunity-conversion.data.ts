import { ReportDateRange } from '../../../utils/exports/types.exp.ts';

export const opportunityConversionReportPayload = (range: ReportDateRange) => ({
  ExportType: 5,
  Language: '',
  RunAsUserID: '',
  Parameters: [
    { ParameterName: 'StartDate', Values: [`${range.startDate} 00:00:00`] },
    { ParameterName: 'EndDate', Values: [`${range.endDate} 23:59:59`] },
    { ParameterName: 'SalesTeamMember', Values: ['*ALL'] },
  ],
});
