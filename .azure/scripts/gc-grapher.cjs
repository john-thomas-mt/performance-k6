const fs = require('node:fs');
const { readExecReq, configSection, page, svgChart } = require('./chart-lib.cjs');

const [, , csvPath = 'temp/gc-usage.csv', htmlPath = 'temp/gc-usage.html', specPath = '', execReqPath = ''] = process.argv;

const raw = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8').trim() : '';
const lines = raw ? raw.split(/\r?\n/) : [];
const header = lines.length ? lines[0].split(',') : [];
const rows = lines.slice(1).map((l) => l.split(','));

const TITLE = 'k6 Go runtime & GC — k6 run';

if (rows.length === 0) {
  fs.writeFileSync(
    htmlPath,
    page(
      TITLE,
      '<p>No samples were captured — the k6 REST API / profiling endpoint may not have been reachable (needs <code>--address</code> + <code>--profiling-enabled</code>).</p>',
    ),
  );
  console.log('Wrote ' + htmlPath + ' (0 samples)');
  process.exit(0);
}

const t0 = new Date(rows[0][0]).getTime();
const elapsed = rows.map((r) => (new Date(r[0]).getTime() - t0) / 1000);
const exec = readExecReq(execReqPath);
const stages = exec && exec.stages ? exec.stages : null;

function column(name) {
  const idx = header.indexOf(name);
  return rows.map((r) => (r[idx] === '' || r[idx] === undefined ? null : Number(r[idx])));
}

// Per-interval delta of a cumulative counter; [0] is null (no prior sample). perSecond divides by
// the sample gap to yield a rate. Null endpoints propagate to null.
function delta(values, perSecond) {
  return values.map((v, i) => {
    if (i === 0 || v == null || values[i - 1] == null) return null;
    const d = v - values[i - 1];
    if (d < 0) return null; // counter reset (shouldn't happen within a run)
    const dt = elapsed[i] - elapsed[i - 1];
    return perSecond ? (dt > 0 ? d / dt : null) : d;
  });
}

const gcCount = column('gc_count');
const gcSum = column('gc_pause_sum_s');
const dCount = delta(gcCount, false);
const dSum = delta(gcSum, false);
const avgPauseMs = dCount.map((c, i) => (c && c > 0 ? (dSum[i] / c) * 1000 : c === 0 ? 0 : null));
const maxPauseMs = column('gc_pause_max_s').map((v) => (v == null ? null : v * 1000));

const charts = [
  svgChart('GC frequency', elapsed, [{ values: delta(gcCount, true), color: '#2b7a4b' }], ' GC/s', stages),
  svgChart(
    'GC pause duration',
    elapsed,
    [
      { values: avgPauseMs, color: '#2b7a4b', label: 'avg / cycle' },
      { values: maxPauseMs, color: '#2b6cb0', label: 'recent max' },
    ],
    ' ms',
    stages,
  ),
  svgChart(
    'Heap',
    elapsed,
    [
      { values: column('heap_inuse_mb'), color: '#2b7a4b', label: 'in use' },
      { values: column('next_gc_mb'), color: '#b0004e', label: 'next-GC target' },
    ],
    ' MB',
    stages,
  ),
  svgChart('Allocation rate', elapsed, [{ values: delta(column('alloc_total_mb'), true), color: '#2b7a4b' }], ' MB/s', stages),
  svgChart(
    'Goroutines & OS threads',
    elapsed,
    [
      { values: column('goroutines'), color: '#2b7a4b', label: 'goroutines' },
      { values: column('threads'), color: '#2b6cb0', label: 'OS threads' },
    ],
    '',
    stages,
  ),
].join('\n');

const summary = `<p>Samples: ${rows.length} &middot; Duration: ${elapsed[elapsed.length - 1].toFixed(0)}s &middot; Source: ${csvPath.split(/[\\/]/).pop()}</p>`;
fs.writeFileSync(htmlPath, page(TITLE, configSection(specPath, exec) + summary + charts));
console.log('Wrote ' + htmlPath + ' (' + rows.length + ' samples)');
