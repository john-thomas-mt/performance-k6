/* T13 DailyWorkOrderReport (NeoLoad 26.3) - PORT STATUS: authored and wired, NOT VERIFIED.

   DONE
   - Parsed the NeoLoad tree: one spine request, PUT /api/v1/Reports/10/12/RunReport. No correlation,
     no paired data-script VU, so no seed.
   - Wrapper (apis/work-orders.api.ts, 300 s timeout), payload builder generated from the recorded body
     (data/payloads/work-orders/), types, the complete 110-row pool (data/pools/reports.data.ts), this flow,
     barrels and the smoke.spec.ts wiring (scenario, thresholds, apiCredentialScenarios, exec).
   - JS_DateRange is translated by random_report_date_range() (payload.helper.ts): UTC end date = today minus a
     random 0..5y, start = end minus 1..100 days.
   - Fidelity tiers generated; all three are empty. RunReport is excluded from chrome via the
     t13-daily-work-order-report entry in JOURNEY_SPINE in .claude/scripts/gen-fidelity-lists.cjs.
   - Static gates pass: tsc --noEmit, k6 inspect, coverage gate (only the two JS_DateRange flags remain,
     covered by random_report_date_range()).

   BLOCKED - verification ladder (-e FIDELITY=full) has not passed
   - Step 1 (k6 run -e SCENARIO=daily_work_order_report -e FIDELITY=full source/tests/smoke.spec.ts) failed on
     PERF main (server 26.4.9775.31034): HTTP 400 Reports_ReportError, Crystal FormulaException
     "Error in formula Notes: 'Local StringVar hnd := {@ChunkId_Notes};' ... A number, currency amount, boolean,
     date, time, date-time, or string is expected here."
   - Same failure replaying the exact recorded parameters (user _390C7BBB-, 2023-09-11 to 2023-11-02), another
     pool user with those dates, and a 7-day recent window, so it is not user, window or payload drift.
   - Same error as the t7 daily function report (report 212): treated as the same server-side bug in the report's
     {@ChunkId_Notes} formula, now seen on report 12. Not reproduced in the Momentus UI by the porting session.
   - 26.3 also returns HTTP 400 but with a different message ("One or more errors occurred.", after 85 s), not
     yet triaged. Capture the status and body of each released env before treating them as the same defect.

   PENDING
   1. Wait for the {@ChunkId_Notes} fix on main, then re-run the ladder at -e FIDELITY=full:
        step 1: k6 run -e SCENARIO=daily_work_order_report -e FIDELITY=full source/tests/smoke.spec.ts
        step 2: ... -e VUS=2 -e ITERS=2 -e USER_MODE=single
        step 3: ... -e VUS=2 -e ITERS=2 -e USER_MODE=pool
   2. Check the first successful response: status 200, MimeType application/pdf, ReportData present. These
      checks have never run against a passing response.
   3. Compare real response time with the recording (170 s) and the Report SLA (avg<20000). The failed runs on
      main returned in 1-19 s; the 300 s wrapper timeout is untested against a passing run.
   4. Only pool users _390C7BBB- and _0B45C6F0- have been sent so far; the rest of the 110 rows are unexercised.
   5. Triage the 26.3 failure (separate from the main defect) with /verify-envs once main is green.
   6. Run /perf-4-journey-review daily_work_order_report in a fresh session after a clean ladder, then
      /verify-envs daily_work_order_report.
   7. Remove this comment once the ladder is green (source/ is otherwise comment-free, see rules/comments.md). */
import { group } from 'k6';
import { run_daily_work_order_report } from '../utils/exports/apis.exp.ts';
import {
  mint_api_jwt,
  pick_pool_value,
  random_report_date_range,
  think,
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
} from '../utils/exports/helpers.exp.ts';
import {
  reports,
  dailyWorkOrderReportChrome,
  dailyWorkOrderReportStatic,
  dailyWorkOrderReportTransport,
} from '../utils/exports/data.exp.ts';
import { ApiSetup, FidelityLevel } from '../utils/exports/types.exp.ts';

export const dailyWorkOrderReportThresholds = {
  'http_req_duration{name:RunDailyWorkOrderReport}': ['avg<20000'],
};

function chrome_and_static(apiJwt: string, version: string, level: FidelityLevel, step: string) {
  if (include_ui(level)) fire_ui_chrome(apiJwt, version, dailyWorkOrderReportChrome[step] ?? []);
  if (include_static(level)) {
    fire_static_assets(dailyWorkOrderReportStatic[step] ?? []);
    fire_transport(apiJwt, version, dailyWorkOrderReportTransport[step] ?? []);
  }
}

export function daily_work_order_report_journey(data: ApiSetup) {
  const level = fidelity_level();
  const userId = pick_pool_value(reports);
  const { fromDate, toDate } = random_report_date_range();
  const apiJwt = mint_api_jwt(data.apiCredentials);

  group('T013_DailyWorkOrder_Report', () => {
    run_daily_work_order_report(apiJwt, userId, fromDate, toDate);
    chrome_and_static(apiJwt, data.version, level, '01');
  });
  think();
}
