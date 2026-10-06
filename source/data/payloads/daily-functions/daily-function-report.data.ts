import { DailyFunctionRow, DailyFunctionWindow } from '../../../utils/exports/types.exp.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/* The report window the recording's jsAction (generateDateRange) draws per iteration: an end date at a random
   instant in the past five years, and a start date 1–100 days before it, so iterations spread over the history
   rather than re-running one cached range. Rendered in UTC, not the machine's local zone. */
export function random_report_window(): DailyFunctionWindow {
  const now = Date.now();
  const end = now - Math.random() * 5 * 365.25 * DAY_MS;
  const start = end - (Math.floor(Math.random() * 100) + 1) * DAY_MS;
  return {
    startDate: new Date(start).toISOString().slice(0, 10),
    endDate: new Date(end).toISOString().slice(0, 10),
  };
}

export const dailyFunctionReportPayload = (row: DailyFunctionRow, window: DailyFunctionWindow) => ({
  ExportType: 1,
  Language: '',
  RunAsUserID: '',
  Parameters: [
    { ParameterName: '@Organization', Values: ['10'] },
    { ParameterName: 'Fun Start Date', Values: [`${window.startDate} 00:00:00`] },
    { ParameterName: 'Fun End Date', Values: [`${window.endDate} 23:59:59`] },
    { ParameterName: 'Event ID', Values: ['-1'] },
    { ParameterName: 'Function Level', Values: ['6'] },
    { ParameterName: 'Function Type', Values: ['*ALL'] },
    { ParameterName: 'Function Class', Values: ['*ALL'] },
    { ParameterName: 'Function Space', Values: ['*ALL'] },
    { ParameterName: 'Event Start Status', Values: [row.EventStartStatus] },
    { ParameterName: 'Event End Status', Values: [row.EventEndStatus] },
    { ParameterName: 'Note Sensitivity', Values: [''] },
    { ParameterName: 'EM370 Parm', Values: ['200'] },
    { ParameterName: 'EM371 Parm', Values: ['ATTENDANCE'] },
    { ParameterName: 'Show Notation', Values: ['True'] },
    { ParameterName: 'Report Sort', Values: ['E'] },
    { ParameterName: 'Show Contiguous', Values: ['False'] },
    { ParameterName: 'Event Category', Values: ['*ALL'] },
    { ParameterName: 'Event Class', Values: ['*ALL'] },
    { ParameterName: 'Event Type', Values: ['*ALL'] },
    { ParameterName: '@UserID', Values: [row.UserID] },
  ],
});
