import { DetailGeneralLedgerRow } from '../../../utils/exports/types.exp.ts';
import { detailGeneralLedgerAccounts } from '../../pools/detail-general-ledger-account.data.ts';
import { fiscal_period_range, pick_account_range } from './helpers.ts';

export const detailGeneralLedgerReportPayload = (row: DetailGeneralLedgerRow) => ({
  ExportType: 1,
  Language: '',
  RunAsUserID: '',
  Parameters: [
    { ParameterName: '@Organization', Values: ['10'] },
    { ParameterName: '@UserID', Values: [row.userId] },
    { ParameterName: 'Fiscal_Period_From', Values: [row.fiscalFrom] },
    { ParameterName: 'Fiscal_Period_Thru', Values: [row.fiscalThru] },
    { ParameterName: 'Account_From', Values: [row.accountFrom] },
    { ParameterName: 'Account_Thru', Values: [row.accountThru] },
    { ParameterName: 'Report Format', Values: [row.reportFormat] },
    { ParameterName: 'Summary', Values: [row.summary] },
    { ParameterName: '@LocalCurrencySymbol', Values: ['$'] },
  ],
});

const accounts = detailGeneralLedgerAccounts[0].split(',').map((account) => account.trim());

export function detail_general_ledger_row(userId: string, reportFormat: string, summary: string): DetailGeneralLedgerRow {
  const periods = fiscal_period_range();
  const range = pick_account_range(accounts);
  return {
    userId,
    fiscalFrom: periods.from,
    fiscalThru: periods.thru,
    accountFrom: range.from,
    accountThru: range.thru,
    reportFormat,
    summary,
  };
}
