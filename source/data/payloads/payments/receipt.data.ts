import { PaymentReceiptRow } from '../../../utils/exports/types.exp.ts';

/* Captured T05 public-API RunReport body for the Payment Receipt report (org 10, report 204). The report parameters
   identify one existing payment, so @UserID / @Account / PaymentSeq / CCNumber come from the P_26_3_Payment_Payload pool
   row; the Show* toggles and ExportType 1 (PDF) are the recorded run options. */
export const paymentReceiptReportPayload = (row: PaymentReceiptRow) => ({
  ExportType: 1,
  Language: '',
  RunAsUserID: '',
  Parameters: [
    { ParameterName: '@Organization', Values: ['10'] },
    { ParameterName: '@UserID', Values: [row.UserID] },
    { ParameterName: '@Account', Values: [row.Account] },
    { ParameterName: '@LanguagePref', Values: ['01'] },
    { ParameterName: 'PaymentSeq', Values: [row.Payseq] },
    { ParameterName: 'Show Invoice', Values: ['False'] },
    { ParameterName: 'Show Order', Values: ['False'] },
    { ParameterName: 'Show Event', Values: ['False'] },
    { ParameterName: 'Show Function', Values: ['False'] },
    { ParameterName: 'Show Signature', Values: ['False'] },
    { ParameterName: 'CCNumber', Values: [row.CC] },
  ],
});
