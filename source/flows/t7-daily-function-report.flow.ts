/* T07 DailyFunctionReport (NeoLoad 26.3) - PORT STATUS: authored and wired, NOT VERIFIED.
   
   DONE
   - Parsed the NeoLoad tree: one spine request, PUT /api/v1/Reports/10/212/RunReport. No correlation,
     no paired data-script VU, so no seed.
   - Wrapper (apis/daily-functions.api.ts), payload builder + random_report_window()
     (data/payloads/daily-functions/), types, 2-row pool (data/pools/daily-function-payload.data.ts),
     this flow, barrels and the smoke.spec.ts wiring (scenario, thresholds, apiCredentialScenarios, exec).
   - JS_DateRange is translated to a UTC window: end = now minus a random 0..5y, start = end minus 1..100 days.
   - Fidelity tiers generated; all three are empty. RunReport is excluded from chrome via the
     t7-daily-function-report entry in JOURNEY_SPINE in .claude/scripts/gen-fidelity-lists.cjs.
   - Static gates pass: tsc --noEmit, k6 inspect, eslint, coverage gate (only the two JS_DateRange flags remain,
     covered by random_report_window()).
   
   BLOCKED - verification ladder (-e FIDELITY=full) has not passed
   - Step 1 (k6 run -e SCENARIO=daily_function_report -e FIDELITY=full source/tests/smoke.spec.ts) failed twice on
     PERF main (server 26.4.9774.31107): HTTP 400 Reports_ReportError, Crystal FormulaException
     "Error in formula Notes: 'Local StringVar hnd := {@ChunkId_Notes};' ... A number, currency amount, boolean,
     date, time, date-time, or string is expected here."
   - Same failure with a 2022 3-day window and a 2025-09/10 window, and the request body matches the recording,
     so it is not window or payload drift.
   - Reproduced in the Momentus UI on main (Events and Operations > Reports > Daily Function Schedule,
     09/21/25-10/20/25): ReportDetailServer/GetReportData returns "Error Running Report" with the same message.
     The team has confirmed it is a server-side bug in report 212 (the {@ChunkId_Notes} formula).
   - Released envs fail with a different, not yet triaged, issue. Capture the status and body of each before
     treating them as the same defect.
   
   PENDING
   1. Wait for the report 212 fix on main, then re-run the ladder at -e FIDELITY=full:
        step 1: k6 run -e SCENARIO=daily_function_report -e FIDELITY=full source/tests/smoke.spec.ts
        step 2: ... -e VUS=2 -e ITERS=2 -e USER_MODE=single
        step 3: ... -e VUS=2 -e ITERS=2 -e USER_MODE=pool
   2. Exercise the second pool row (RYANC, 09/UN); only LANDONV (0A/ZQ) has been sent so far.
   3. Check the first successful response: status 200, MimeType application/pdf, ReportData present. These
      checks have never run against a passing response.
   4. Compare real response time with the recording (111 s) and the Report SLA (avg<20000). The failed runs
      returned in 3-16 s, so no timeout change has been needed, but a passing run may be much slower; raise the
      http timeout in the wrapper if it is.
   5. Triage the released-env failures (separate from the main defect) with /verify-envs once main is green.
   6. Run /neoload-port-review t7 in a fresh session after a clean ladder, then /verify-envs daily_function_report.
   7. Remove this comment once the ladder is green (source/ is otherwise comment-free, see rules/comments.md). */
import { group } from 'k6';
import { run_daily_function_report } from '../utils/exports/apis.exp.ts';
import {
  mint_api_jwt,
  pick_pool_value,
  think,
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
} from '../utils/exports/helpers.exp.ts';
import {
  dailyFunctionPayloads,
  dailyFunctionReportChrome,
  dailyFunctionReportStatic,
  dailyFunctionReportTransport,
  random_report_window,
} from '../utils/exports/data.exp.ts';
import { ApiSetup, FidelityLevel } from '../utils/exports/types.exp.ts';

export const dailyFunctionReportThresholds = {
  'http_req_duration{name:RunDailyFunctionReport}': ['avg<20000'],
};

function chrome_and_static(apiJwt: string, version: string, level: FidelityLevel, step: string) {
  if (include_ui(level)) fire_ui_chrome(apiJwt, version, dailyFunctionReportChrome[step] ?? []);
  if (include_static(level)) {
    fire_static_assets(dailyFunctionReportStatic[step] ?? []);
    fire_transport(apiJwt, version, dailyFunctionReportTransport[step] ?? []);
  }
}

export function daily_function_report_journey(data: ApiSetup) {
  const level = fidelity_level();
  const apiJwt = mint_api_jwt(data.apiCredentials);
  const row = pick_pool_value(dailyFunctionPayloads);
  const window = random_report_window();

  group('T007_DailyFunction_Report', () => {
    run_daily_function_report(apiJwt, row, window);
    chrome_and_static(apiJwt, data.version, level, '01');
  });
  think();
}
