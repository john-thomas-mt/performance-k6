import { coerce_transport_types, save2_envelope } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable } from '../../../utils/exports/types.exp.ts';

/* Captured Payment Plan create Save2 (window 229 / EM9965). Submits the row HandleDependentFields2 returned
   with the schedule's descriptions filled; PayPlanID -1 marks the unsaved plan and the server assigns the real id. */
export const paymentPlanSavePayload = (orderNbr: string, table: TransportTable) =>
  save2_envelope(
    [1, '10', 229, 0, 0, 4, 1],
    [
      { Key: 'OrgCode', Value: '10' },
      { Key: 'WindowObjectID', Value: 229 },
      { Key: 'wdwid', Value: 'EM9965' },
      { Key: 'WdwType', Value: 4 },
      { Key: 'wdwMode', Value: 1 },
      { Key: 'RemoveEditLayoutLink', Value: false },
      { Key: 'ContextObjectID', Value: 0 },
      { Key: 'PayScheduleCode', Value: '' },
      { Key: 'OrderRowKeys', Value: `10|${orderNbr}` },
      { Key: 'ContractSeq', Value: 0 },
      { Key: 'OrderType', Value: 'SO' },
      { Key: 'EditWdwID', Value: 'EM9999' },
      { Key: 'ForceOneColumnLayout', Value: false },
      { Key: 'ShowHelpTextInfo', Value: true },
      { Key: 'MoveGeneralSectionToNewTab', Value: true },
      { Key: 'ShowQuickInfoHeader', Value: true },
      { Key: 'PayPlanID', Value: -1 },
    ],
    coerce_transport_types(table),
  );
