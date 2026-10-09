import { ApiSetup, User } from './common.type.ts';
import { PaymentPlanSetup } from './payment-plans.type.ts';
import { ServiceOrderSetup } from './service-orders.type.ts';

export type SmokeSetup = ServiceOrderSetup &
  PaymentPlanSetup &
  ApiSetup & {
    users: User[];
  };
