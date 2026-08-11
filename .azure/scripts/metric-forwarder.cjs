// Tails a sampler CSV and forwards its numeric columns to Datadog's agentless metrics intake as
// gauges, so agent CPU/RAM can be watched live beside the k6 metrics the run already streams
// (docs/datadog-live-metrics.md). Kept separate from the samplers on purpose: they stay dumb CSV
// writers whose output is the published source of truth and is unaffected if this process dies,
// and one cross-platform forwarder serves both the Windows (.ps1) and Linux (.cjs) samplers instead
// of an intake client written twice. Any sampler CSV shaped `timestamp,<numeric columns...>` works,
// so pointing a second instance at gc-usage.csv needs no code change.
const fs = require('node:fs');
const os = require('node:os');
const https = require('node:https');

const [, , csvPath = 'temp/resource-usage.csv', metricPrefix = 'k6.agent.', intervalArg = '10', tagsArg = ''] = process.argv;
const intervalMs = Math.max(1, Number(intervalArg)) * 1000;

// The key is read from the environment, never argv, so it cannot surface in a process list.
const apiKey = process.env.DD_API_KEY || '';
const endpoint = new URL(process.env.DD_METRICS_URL || 'https://api.datadoghq.com/api/v2/series');

const GAUGE = 3;
// The intake rejects points more than an hour old, so a stale row (a CSV left by an earlier run, a
// forwarder that fell behind) is dropped here rather than failing the batch it travels in.
const MAX_AGE_SECONDS = 3000;
// Payloads cap at 500 KB. A row is one point per column at ~40 bytes, so 500 rows leaves wide margin.
const MAX_ROWS_PER_POST = 500;

const tags = [
  `agent:${os.hostname().toLowerCase()}`,
  ...tagsArg
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
];

if (!apiKey || /^\$\(/.test(apiKey)) {
  console.log('metric-forwarder: DD_API_KEY not set - not forwarding (the sampler CSV is unaffected)');
  process.exit(0);
}

let offset = 0;
let pending = '';
let columns = null;
const queue = [];
let inFlight = false;

function readNewRows() {
  let size;
  try {
    size = fs.statSync(csvPath).size;
  } catch {
    return [];
  }
  // A shrinking file means the sampler restarted and rewrote its header, so re-read from the top.
  if (size < offset) {
    offset = 0;
    pending = '';
    columns = null;
  }
  if (size === offset) return [];

  const buffer = Buffer.alloc(size - offset);
  const fd = fs.openSync(csvPath, 'r');
  try {
    fs.readSync(fd, buffer, 0, buffer.length, offset);
  } finally {
    fs.closeSync(fd);
  }
  offset = size;

  pending += buffer.toString('utf8');
  const lines = pending.split(/\r?\n/);
  // The sampler appends whole rows but a read can still land mid-row; hold the remainder for next tick.
  pending = lines.pop();

  const rows = lines.filter(Boolean);
  if (columns === null && rows.length > 0) columns = rows.shift().split(',');
  return rows;
}

function buildSeries(rows) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const points = new Map();

  for (const row of rows) {
    const cells = row.split(',');
    // The Windows sampler stamps ISO 8601 with a UTC offset and the Linux one stamps Z, so both parse
    // unambiguously without assuming the agent's zone.
    const timestamp = Math.floor(Date.parse(cells[0]) / 1000);
    if (!Number.isFinite(timestamp) || nowSeconds - timestamp > MAX_AGE_SECONDS) continue;

    for (let i = 1; i < columns.length; i++) {
      const cell = cells[i];
      if (cell === undefined || cell === '') continue;
      const value = Number(cell);
      if (!Number.isFinite(value)) continue;
      const metric = metricPrefix + columns[i].toLowerCase();
      if (!points.has(metric)) points.set(metric, []);
      points.get(metric).push({ timestamp, value });
    }
  }

  return [...points].map(([metric, values]) => ({ metric, type: GAUGE, points: values, tags }));
}

function post(series, done) {
  const body = JSON.stringify({ series });
  const request = https.request(
    {
      hostname: endpoint.hostname,
      port: endpoint.port || 443,
      path: endpoint.pathname,
      method: 'POST',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    },
    (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (text += chunk));
      response.on('end', () => {
        if (response.statusCode !== 202) {
          console.error(`metric-forwarder: submit failed - HTTP ${response.statusCode} ${text.slice(0, 200)}`);
        }
        done();
      });
    },
  );
  // A dropped batch is logged and abandoned rather than retried: the CSV artifact is the record, and
  // requeueing would age points out of the intake's window anyway.
  request.on('error', (error) => {
    console.error(`metric-forwarder: submit failed - ${error.message}`);
    done();
  });
  request.on('timeout', () => request.destroy(new Error('request timeout')));
  request.end(body);
}

function tick() {
  queue.push(...readNewRows());
  if (inFlight || queue.length === 0) return;

  const series = buildSeries(queue.splice(0, MAX_ROWS_PER_POST));
  if (series.length === 0) return;

  inFlight = true;
  post(series, () => {
    inFlight = false;
  });
}

console.log(
  `metric-forwarder: ${csvPath} -> ${endpoint.host}${endpoint.pathname} every ${intervalMs / 1000}s ` +
    `as ${metricPrefix}* (tags: ${tags.join(', ')})`,
);

const timer = setInterval(tick, intervalMs);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
