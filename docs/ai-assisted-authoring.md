# Using Claude for Performance Testing — and Why k6 Fits

Why the choice of load-testing tool is, at this point, largely a choice about how _authorable and
maintainable by AI_ the tests are — and why k6's "tests are just code in a git repo" model makes it the
right fit where NeoLoad's GUI/XML model is not. Audience is leadership: this is the strategic
differentiator behind the switch, kept at summary depth. The engineering procedures referenced here
live in the repo's Claude skills.

## The shift: performance tests are code an AI can write

Traditional load testing is a specialist, GUI-bound activity. NeoLoad tests are built by a performance
engineer clicking through a desktop application, and stored as an XML project tree that only that
application edits safely. That model has one property that matters more than any feature comparison in
2026: **an AI agent cannot reliably drive it.** There is no code surface to generate, no diff to review,
no text file to correlate.

k6 inverts this. A k6 test is **TypeScript in a normal git repository**. That single fact is what lets
Claude do the work an engineer would otherwise do by hand:

- **Explore** the live app with a browser (playwright-cli), watch the real API traffic behind each user
  action, and build the correlation picture.
- **Write** the endpoint wrappers, the composed journey, and the test spec straight into source files.
- **Verify** by running k6 itself and reading the results, fixing correlation until it passes.
- **Review** through normal pull requests, TypeScript compilation, and lint — the same gates as any code.

The tool's value is no longer just how much load it generates; it is how cheaply and reliably the test
suite can be _produced and kept current_. On that axis k6 wins decisively because it is code, and code
is what AI is good at.

## Why k6's design is what makes this work

| Property                           | Consequence for AI authoring                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Tests are TypeScript/JavaScript    | Claude generates and edits them directly — no proprietary GUI to automate         |
| Everything is plain text in git    | Every change is a reviewable diff; history, blame, and PRs all apply              |
| CLI-first (`k6 run`, `k6 inspect`) | The agent runs and validates its own work in a loop, no human in the GUI          |
| Correlation is explicit in code    | The AI can _read_ how a token flows request-to-request and patch exactly one spot |
| Single binary, no infra            | The verify step runs anywhere the agent runs — laptop or CI agent                 |

NeoLoad's captured-payload-plus-hand-mapped-correlation model has none of these. Its correlation lives
in GUI-configured extractor blocks inside XML, and its per-release maintenance answer is to re-record
the whole script — an inherently manual, human-in-the-GUI act. See
[k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md) for the architectural
contrast in full.

## How the workflow is actually run here

The repo encodes the AI-assisted work as repeatable Claude skills, each a defined procedure rather than
an ad-hoc prompt. At a leadership level, the four that matter:

- **Generate a new test** — drive the app, capture the API traffic, script it into k6 wrappers and a
  journey, then verify with a progressive 1→2-VU run that proves it correlates under concurrency and
  across different logins.
- **Convert a NeoLoad script** — port an existing NeoLoad virtual user by reading its XML tree
  (requests + correlation) as the source of truth, distilling to the transaction that matters, and
  translating it into k6 — no re-recording. This is the migration engine; see
  [conversion-strategy-and-roadmap.md](./conversion-strategy-and-roadmap.md).
- **Verify across the version matrix** — run a journey (or the whole suite) once per live release to
  prove it holds beyond the authoring version and to catch real drift.
- **Detect payload drift** — after a Momentus upgrade, run the suite and triage whether a captured
  request body has drifted from what the live API now expects.

The procedures themselves are maintained as skills in the repo (`.claude/skills/`) so they stay
versioned alongside the tests they operate on — the same single-source-of-truth discipline as the code.

## Why this is a durable advantage, not a one-off

- **Onboarding cost collapses.** Authoring load tests stops requiring NeoLoad GUI expertise and a seat;
  it requires the repo and Claude. Any engineer — or the AI — can extend the suite.
- **Maintenance stops being re-recording.** Upgrades become a verify-and-patch loop the AI can run,
  not a manual re-capture per release (see [conversion-strategy-and-roadmap.md](./conversion-strategy-and-roadmap.md)).
- **The knowledge lives in the repo.** Conventions, correlation patterns, and procedures are text files
  the AI reads on every task — the suite documents and enforces itself, rather than living in one
  engineer's head and a GUI.

## The bottom line

The reason to pick k6 is not only that it is free and open (it is), but that **it is the load-testing
tool whose native artifact is code** — and in an AI-assisted engineering org, code is the artifact that
can be produced, verified, and maintained at a fraction of the human cost. NeoLoad's GUI/XML model,
whatever its runtime merits, is on the wrong side of that shift.

## Sources

- [Grafana k6 — JavaScript/TypeScript compatibility mode](https://grafana.com/docs/k6/latest/using-k6/javascript-typescript-compatibility-mode/)
- The repo's own AI-assisted procedures — `.claude/skills/` (generate-test, neoload-to-k6, verify-envs, payload-drift)
- NeoLoad authoring model — Enterprise Performance Suite `README.md` (sibling `performance` repo)
