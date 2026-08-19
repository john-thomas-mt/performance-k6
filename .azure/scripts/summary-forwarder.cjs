// Posts an end-of-run summary CSV to Datadog once, as gauges tagged by the CSV's leading columns.
//
// Exists because the live OTLP feed can only offer sketch estimates of a percentile: Datadog merges
// them per rollup bucket and the dashboard then reduces the buckets with max, so a short bucket over
// few samples reads low and a window landing between bucket boundaries reads blank. The figures here
// are computed by group-aggregator.cjs over every sample in the run using k6's own interpolation, so
// they are exact and window-independent — the tail figure of record, on the dashboard rather than only
// in the artifact. Measurements and query rules are in docs/datadog-live-metrics.md.
//
// Any CSV shaped `<tag columns...>,<numeric columns...>` works, so a second summary needs no code
// change. An empty tag cell drops that tag for the row rather than inventing a value, which keeps a
// setup()/teardown() row consistent with the live feed's own untagged points.
const fs = require('node:fs');
const { GAUGE, MAX_ROWS_PER_POST, endpoint, apiKey, post } = require('./dd-intake.cjs');

const [
  ,
  ,
  csvPath = 'reports/metrics/group-series.csv',
  metricPrefix = 'k6perf.transaction.',
  tagColumnsArg = '2',
  tagsPath = 'temp/dd-tags.txt',
] = process.argv;

const LABEL = 'summary-forwarder';
const tagColumns = Math.max(1, Number(tagColumnsArg));

function skip(reason) {
  console.log(`${LABEL}: ${reason} - not forwarding (the published CSV is unaffected)`);
  process.exit(0);
}

if (!apiKey()) skip('DD_API_KEY not set');
if (!fs.existsSync(csvPath)) skip(`${csvPath} not found`);
// Written by run-k6.ps1 only when that run streamed to Datadog, so its absence means this run had no
// live feed for these points to sit beside and the same flag gates every feed.
if (!fs.existsSync(tagsPath)) skip(`${tagsPath} not found`);

// Windows PowerShell's Set-Content -Encoding utf8 writes a BOM, which would otherwise ride along on
// the first tag and stop it matching the live feed's. 65279 is that mark's code point.
const tagsText = fs.readFileSync(tagsPath, 'utf8');
const baseTags = (tagsText.charCodeAt(0) === 65279 ? tagsText.slice(1) : tagsText)
  .split(/[,\r\n]+/)
  .map((tag) => tag.trim())
  .filter(Boolean);

const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
const header = (lines.shift() || '').split(',');
if (lines.length === 0) skip(`${csvPath} holds no rows`);

// One timestamp for the whole summary: these are run totals, not a time series, and the intake rejects
// points more than an hour old, so stamping them at post time keeps a slow aggregation step in range.
const timestamp = Math.floor(Date.now() / 1000);

function buildSeries(rows) {
  const points = new Map();

  for (const row of rows) {
    const cells = row.split(',');
    const tags = [...baseTags];
    for (let i = 0; i < tagColumns; i++) {
      if (cells[i]) tags.push(`${header[i]}:${cells[i]}`);
    }
    const key = tags.join(',');

    for (let i = tagColumns; i < header.length; i++) {
      const value = Number(cells[i]);
      if (cells[i] === undefined || cells[i] === '' || !Number.isFinite(value)) continue;
      const metric = metricPrefix + header[i].toLowerCase();
      if (!points.has(`${metric}|${key}`)) points.set(`${metric}|${key}`, { metric, type: GAUGE, points: [], tags });
      points.get(`${metric}|${key}`).points.push({ timestamp, value });
    }
  }

  return [...points.values()];
}

const batches = [];
for (let i = 0; i < lines.length; i += MAX_ROWS_PER_POST) batches.push(lines.slice(i, i + MAX_ROWS_PER_POST));

console.log(
  `${LABEL}: ${csvPath} -> ${endpoint.host}${endpoint.pathname} as ${metricPrefix}* ` +
    `(${lines.length} rows in ${batches.length} post(s), tags: ${baseTags.join(', ')})`,
);

let failed = false;

function next() {
  const batch = batches.shift();
  if (!batch) {
    // A failed post is a warning, never a build failure: the published CSV is the record. Azure only
    // renders the banner when it is the one running us, hence the TF_BUILD guard.
    if (failed && process.env.TF_BUILD) {
      console.log('##vso[task.logissue type=warning]Exact per-transaction summary metrics did not reach Datadog');
    }
    return;
  }
  const series = buildSeries(batch);
  if (series.length === 0) return next();
  post(LABEL, series, (ok) => {
    if (!ok) failed = true;
    next();
  });
}

next();
