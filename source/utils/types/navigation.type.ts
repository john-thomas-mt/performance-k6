import { SetupData, User } from './common.type.ts';

export interface NavListParam {
  Key: string;
  Value: unknown;
}

export interface NavScreen {
  label: string;
  windowId: string;
  listParams?: NavListParam[];
}

export interface WindowInfo {
  WindowID: string;
  ObjectID: number;
}

export interface NavLoadSetup extends SetupData {
  users: User[];
}
