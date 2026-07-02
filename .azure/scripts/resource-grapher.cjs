const fs = require('node:fs');

const [, , csvPath = 'temp/resource-usage.csv', htmlPath = 'temp/resource-usage.html'] = process.argv;

const raw = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8').trim() : '';
const lines = raw ? raw.split('\n') : [];
const header = lines.length ? lines[0].split(',') : [];
const rows = lines.slice(1).map((l) => l.split(','));

function page(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Agent resource utilization</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#222}section{margin-bottom:28px}h1{font-size:20px}h2{font-size:15px;margin-bottom:4px}small{color:#888;font-weight:normal}</style>
</head><body>
<h1>Agent resource utilization — k6 run</h1>
${body}
</body></html>`;
}

if (rows.length === 0) {
  fs.writeFileSync(htmlPath, page('<p>No samples were captured.</p>'));
  console.log('Wrote ' + htmlPath + ' (0 samples)');
  process.exit(0);
}

const t0 = new Date(rows[0][0]).getTime();
const elapsed = rows.map((r) => (new Date(r[0]).getTime() - t0) / 1000);

function column(name) {
  const idx = header.indexOf(name);
  return rows.map((r) => (r[idx] === '' || r[idx] === undefined ? null : Number(r[idx])));
}

function svgChart(title, values, unit) {
  const pts = values
    .map((v, i) => ({ x: elapsed[i], v }))
    .filter((p) => p.v !== null && !Number.isNaN(p.v));
  if (pts.length === 0) return `<section><h2>${title}</h2><p>No data captured (not available on this OS).</p></section>`;

  const W = 820;
  const H = 260;
  const padL = 55;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const xMax = Math.max(...pts.map((p) => p.x), 1);
  const yMax = Math.max(...pts.map((p) => p.v), 1) * 1.1;
  const sx = (x) => padL + (x / xMax) * (W - padL - padR);
  const sy = (v) => H - padB - (v / yMax) * (H - padT - padB);
  const poly = pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const v = yMax * f;
      return `<line x1="${padL}" y1="${sy(v).toFixed(1)}" x2="${W - padR}" y2="${sy(v).toFixed(1)}" stroke="#eee"/><text x="${padL - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#666">${v.toFixed(0)}</text>`;
    })
    .join('');
  const max = Math.max(...pts.map((p) => p.v));
  const avg = pts.reduce((s, p) => s + p.v, 0) / pts.length;

  return `<section>
  <h2>${title} <small>(max ${max.toFixed(1)}${unit}, avg ${avg.toFixed(1)}${unit})</small></h2>
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#999"/>
    <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#999"/>
    <polyline fill="none" stroke="#2b7a4b" stroke-width="1.5" points="${poly}"/>
    <text x="${(W / 2).toFixed(0)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#666">elapsed seconds (0 &#8594; ${xMax.toFixed(0)}s)</text>
  </svg>
</section>`;
}

const charts = [
  svgChart('CPU utilization', column('cpu_percent'), '%'),
  svgChart('RAM utilization', column('ram_percent'), '%'),
  svgChart('RAM used', column('ram_used_mb'), ' MB'),
  svgChart('Network received', column('net_rx_kBps'), ' KB/s'),
  svgChart('Network transmitted', column('net_tx_kBps'), ' KB/s'),
  svgChart('Load average (1m)', column('load1'), ''),
].join('\n');

const summary = `<p>Samples: ${rows.length} &middot; Duration: ${elapsed[elapsed.length - 1].toFixed(0)}s &middot; Source: ${csvPath.split(/[\\/]/).pop()}</p>`;
fs.writeFileSync(htmlPath, page(summary + charts));
console.log('Wrote ' + htmlPath + ' (' + rows.length + ' samples)');
