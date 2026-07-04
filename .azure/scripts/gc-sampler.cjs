// Polls k6's Prometheus /metrics endpoint (exposed by `--address` + `--profiling-enabled`) for Go
// runtime/GC metrics and appends them to a CSV, mirroring resource-sampler.cjs. Cross-platform
// (Node HTTP), so one sampler serves both the Windows and Linux CI agents. Ticks that can't reach
// the endpoint (before k6 is up / after it exits) are skipped silently.
const fs = require('node:fs');
const http = require('node:http');

const [, , outPath = 'temp/gc-usage.csv', intervalArg = '1', address = '127.0.0.1:6565'] = process.argv;
const intervalMs = Math.max(1, Number(intervalArg)) * 1000;
const MB = 1024 * 1024;

fs.writeFileSync(
  outPath,
  'timestamp,gc_count,gc_pause_sum_s,gc_pause_max_s,heap_inuse_mb,heap_alloc_mb,next_gc_mb,goroutines,threads,alloc_total_mb\n',
);

function num(text, name) {
  const re = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+([0-9eE.+-]+)', 'm');
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function scrape() {
  const req = http.get(`http://${address}/metrics`, { timeout: 2000 }, (res) => {
    if (res.statusCode !== 200) {
      res.resume();
      return;
    }
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      const bytes = (name) => {
        const v = num(body, name);
        return v == null ? '' : (v / MB).toFixed(1);
      };
      const raw = (name) => {
        const v = num(body, name);
        return v == null ? '' : String(v);
      };
      const row = [
        new Date().toISOString(),
        raw('go_gc_duration_seconds_count'),
        raw('go_gc_duration_seconds_sum'),
        raw('go_gc_duration_seconds{quantile="1"}'),
        bytes('go_memstats_heap_inuse_bytes'),
        bytes('go_memstats_alloc_bytes'),
        bytes('go_memstats_next_gc_bytes'),
        raw('go_goroutines'),
        raw('go_threads'),
        bytes('go_memstats_alloc_bytes_total'),
      ].join(',');
      fs.appendFileSync(outPath, row + '\n');
    });
  });
  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
}

const timer = setInterval(scrape, intervalMs);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
