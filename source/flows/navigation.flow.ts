import { group, sleep } from 'k6';
import { login_to_events } from './login.flow.ts';
import { get_window_info, get_list_initial_data } from '../utils/exports/apis.exp.ts';
import { navScreens } from '../utils/exports/data.exp.ts';
import { User, SetupData } from '../utils/exports/types.exp.ts';

export const navigationThresholds = {
  'http_req_duration{name:GetWindowInfo}': ['p(95)<2000'],
  'http_req_duration{name:GetListInitialData}': ['p(95)<3000'],
};

function pick_screen() {
  const override = __ENV.SCREEN;
  if (override) {
    const found = navScreens.find((s) => s.label === override);
    if (!found) {
      throw new Error(`Unknown SCREEN "${override}" — valid: ${navScreens.map((s) => s.label).join(', ')}`);
    }
    return found;
  }
  return navScreens[Math.floor(Math.random() * navScreens.length)];
}

export function navigation_journey(user: User, data: SetupData) {
  const { bearerToken } = login_to_events(user, data.version);

  const screen = pick_screen();

  group('3. Open Navigation Screen', () => {
    const objectId = get_window_info(bearerToken, data.version, screen.windowId);
    get_list_initial_data(bearerToken, data.version, screen, objectId);
  });

  sleep(1 + Math.random() * 2);
}
