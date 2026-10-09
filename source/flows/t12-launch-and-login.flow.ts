import { group } from 'k6';
import { login_to_events } from './login.flow.ts';
import { signalr_negotiate } from '../utils/exports/apis.exp.ts';
import {
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
  fetch_bundle_versions,
  sign_out,
  think,
} from '../utils/exports/helpers.exp.ts';
import { launchAndLoginChrome, launchAndLoginStatic, launchAndLoginTransport } from '../utils/exports/data.exp.ts';
import { FidelityLevel, SetupData, User } from '../utils/exports/types.exp.ts';

export const launchAndLoginThresholds = {};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, step: string, subs: Subs) {
  if (include_ui(level)) fire_ui_chrome(token, version, launchAndLoginChrome[step] ?? [], subs);
  if (include_static(level)) {
    fire_static_assets(launchAndLoginStatic[step] ?? []);
    fire_transport(token, version, launchAndLoginTransport[step] ?? [], subs);
  }
}

export function launch_and_login_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const subs: Subs = {};

  group('T012_LaunchAndLogin_01_Launch', () => {
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
      subs.P_EpochTimestamp = String(Date.now());
    }
    chrome_and_static('', data.version, level, '01', subs);
  });
  think();

  const { bearerToken } = login_to_events(user, data.version, 'T012_LaunchAndLogin_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, '02', subs);
  });
  think();

  group('T012_LaunchAndLogin_03_SignOut', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, '03', subs);
  });
  think();
}
