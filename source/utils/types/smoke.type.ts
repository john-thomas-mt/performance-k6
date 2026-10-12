import { ApiSetup, User } from './common.type.ts';
import { CopyPasteFunctionSetup } from './events.type.ts';
import { PaymentPlanSetup } from './payment-plans.type.ts';
import { EditServiceOrderSetup, ServiceOrderSetup } from './service-orders.type.ts';

export type SmokeSetup = ServiceOrderSetup &
  EditServiceOrderSetup &
  PaymentPlanSetup &
  CopyPasteFunctionSetup &
  ApiSetup & {
    users: User[];
  };
