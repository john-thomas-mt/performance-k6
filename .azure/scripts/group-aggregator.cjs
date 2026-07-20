// Aggregates k6 JSON output (--out json) into per-transaction timings for NeoLoad comparison.
// Every k6 group() emits a group_duration Point tagged with the group name; think() sits between
// groups, so group_duration is pure in-transaction wall-clock — the 1:1 analog of a NeoLoad
// transaction. Streams the (optionally gzipped) firehose line-by-line so a multi-hundred-MB output
// never lands in memory, buckets group_duration by its group tag, and writes a CSV (for diffing
// against a NeoLoad export) plus an HTML table (matching the other k6-results artifacts).
const fs = require('node:fs');
const zlib = require('node:zlib');
const readline = require('node:readline');
const { readExecReq, configSection, page, esc } = require('./chart-lib.cjs');

const [
  ,
  ,
  inputPath = 'temp/k6-metrics.json.gz',
  csvPath = 'temp/group-metrics.csv',
  htmlPath = 'temp/group-metrics.html',
  specPath = '',
  execReqPath = '',
] = process.argv;

const TITLE = 'k6 per-transaction timings (group_duration) — k6 run';

// k6's TrendSink.P: sort ascending, then linear-interpolate at pct*(n-1). Reproduced verbatim so
// these percentiles match k6's own p(90)/p(95) for the same samples.
function percentile(sorted, pct) {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const i = pct * (n - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function stats(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, v) => a + v, 0);
  return {
    count: n,
    avg: sum / n,
    min: sorted[0],
    med: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[n - 1],
  };
}

const COLS = ['count', 'avg', 'min', 'med', 'p90', 'p95', 'p99', 'max'];
const groups = new Map();

function record(line) {
  if (!line || line.charCodeAt(0) !== 123) return; // 123 = '{'; skip blanks/non-object lines fast
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return;
  }
  if (obj.type !== 'Point' || obj.metric !== 'group_duration') return;
  const data = obj.data;
  if (!data || !data.tags) return;
  const value = data.value;
  if (typeof value !== 'number' || Number.isNaN(value)) return;
  let name = (data.tags.group || '').replace(/^(::)+/, ''); // top-level group tag is '::<name>'
  if (!name) name = '(root)';
  let arr = groups.get(name);
  if (!arr) {
    arr = [];
    groups.set(name, arr);
  }
  arr.push(value);
}

function num(v) {
  return v.toFixed(2);
}

function finish() {
  const rows = [...groups.keys()].sort().map((name) => ({ name, ...stats(groups.get(name)) }));

  const csvBody = rows.map((r) => [r.name, r.count, ...COLS.slice(1).map((c) => num(r[c]))].join(',')).join('\n');
  fs.writeFileSync(csvPath, ['group,' + COLS.join(','), csvBody].filter(Boolean).join('\n') + '\n');

  const exec = readExecReq(execReqPath);
  const style =
    '<style>table.grid{border-collapse:collapse;font-size:13px;margin-top:6px}' +
    'table.grid th,table.grid td{border:1px solid #ddd;padding:3px 10px;text-align:right}' +
    'table.grid th{background:#f4f4f4}td.g{text-align:left;font-family:ui-monospace,monospace}' +
    'td.n{font-variant-numeric:tabular-nums}</style>';

  let body;
  if (rows.length === 0) {
    body =
      configSection(specPath, exec) +
      `<p>No <code>group_duration</code> samples found in <code>${esc(inputPath)}</code> — confirm the run enabled <code>--out json</code> and executed grouped flows.</p>`;
  } else {
    const thead =
      '<tr><th style="text-align:left">Transaction (group)</th>' +
      COLS.map((c) => `<th>${c === 'count' ? 'count' : c + ' (ms)'}</th>`).join('') +
      '</tr>';
    const tbody = rows
      .map(
        (r) =>
          `<tr><td class="g">${esc(r.name)}</td>` +
          COLS.map((c) => `<td class="n">${c === 'count' ? r.count : num(r[c])}</td>`).join('') +
          '</tr>',
      )
      .join('');
    const note = `<p><small>${rows.length} transactions &middot; group_duration = wall-clock inside each k6 <code>group()</code> (think time between groups is excluded) &middot; percentiles use k6's linear-interpolation method &middot; source: ${esc(inputPath.split(/[\\/]/).pop())}</small></p>`;
    body = configSection(specPath, exec) + note + `<table class="grid"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
  }

  fs.writeFileSync(htmlPath, page(TITLE, style + body));
  console.log(`Wrote ${csvPath} and ${htmlPath} (${rows.length} transactions)`);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Input ${inputPath} not found — emitting empty group aggregation`);
  finish();
  return;
}

const stream = fs.createReadStream(inputPath);
const source = /\.gz$/i.test(inputPath) ? stream.pipe(zlib.createGunzip()) : stream;
source.on('error', (e) => {
  console.error(`Failed reading ${inputPath}: ${e.message}`);
  finish();
});
readline.createInterface({ input: source, crlfDelay: Infinity }).on('line', record).on('close', finish);
