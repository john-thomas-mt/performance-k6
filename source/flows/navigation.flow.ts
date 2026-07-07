import { group, sleep } from 'k6';
import { loginToEvents } from './login.flow.ts';
import { getWindowInfo, getListInitialData } from '../utils/exports/apis.exp.ts';
import { navScreens } from '../utils/exports/data.exp.ts';
import { User, SetupData } from '../utils/exports/types.exp.ts';

export const navigationThresholds: Record<string, string[]> = {
  'http_req_duration{name:GetWindowInfo}': ['p(95)<2000'],
  'http_req_duration{name:GetListInitialData}': ['p(95)<3000'],
};

function pickScreen() {
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

export function navigationJourney(user: User, data: SetupData) {
  const { bearerToken } = loginToEvents(user, data.version);
  if (!bearerToken) return;

  const screen = pickScreen();

  group('3. Open Navigation Screen', () => {
    const objectId = getWindowInfo(bearerToken, data.version, screen.windowId);
    if (objectId === null) return;
    getListInitialData(bearerToken, data.version, screen, objectId);
  });

  sleep(1 + Math.random() * 2);
}
