import { SetupData, User } from './common.type.ts';

export type NavListParam = {
  Key: string;
  Value: unknown;
};

export type NavScreen = {
  label: string;
  windowId: string;
  listParams?: NavListParam[];
};

export type WindowInfo = {
  WindowID: string;
  ObjectID: number;
};

export type NavLoadSetup = SetupData & {
  users: User[];
};
