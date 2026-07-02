const fs = require('node:fs');

const [
  ,
  ,
  csvPath = 'temp/resource-usage.csv',
  htmlPath = 'temp/resource-usage.html',
  specPath = '',
  execReqPath = '',
] = process.argv;

const raw = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8').trim() : '';
const lines = raw ? raw.split(/\r?\n/) : [];
const header = lines.length ? lines[0].split(',') : [];
const rows = lines.slice(1).map((l) => l.split(','));

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

// Parse a k6 duration string ("5m0s", "17m30s", "500ms") into seconds. Longest units first so
// "ms" is matched before the bare "m"/"s".
function parseDur(str) {
  if (typeof str !== 'string') return null;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
  let m;
  while ((m = re.exec(str))) {
    const n = parseFloat(m[1]);
    total += m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : m[2] === 'ms' ? n / 1000 : n;
  }
  return total;
}

function fmtTime(s) {
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const mn = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(mn)}:${pad(sec)}` : `${mn}:${pad(sec)}`;
}

// Pick a "nice" tick interval (seconds) so the axis shows roughly `target` ticks.
function niceStep(xMax, target = 8) {
  const raw = xMax / target;
  const steps = [5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1800, 3600];
  return steps.find((s) => raw <= s) || steps[steps.length - 1];
}

// Read the JSON emitted by `k6 inspect --execution-requirements`, tolerating a UTF-8 BOM
// (PowerShell's Out-File -Encoding utf8 prepends one). Returns null if absent/unparseable.
function readExecReq(path) {
  if (!path || !fs.existsSync(path)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(path, 'utf8').replace(/^﻿/, ''));
    let stages = null;
    let executor = null;
    if (j.scenarios) {
      for (const k of Object.keys(j.scenarios)) {
        const sc = j.scenarios[k];
        if (sc && sc.stages) {
          stages = sc.stages;
          executor = sc.executor;
          break;
        }
      }
    }
    return { maxVUs: j.maxVUs, totalDuration: j.totalDuration, stages, executor };
  } catch {
    return null;
  }
}

function page(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Agent resource utilization</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#222}section{margin-bottom:28px}h1{font-size:20px}h2{font-size:15px;margin-bottom:4px}small{color:#888;font-weight:normal}table{border-collapse:collapse;font-size:13px}td{padding:2px 14px 2px 0;vertical-align:top}td.k{color:#666;white-space:nowrap}</style>
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
const exec = readExecReq(execReqPath);
const stages = exec && exec.stages ? exec.stages : null;

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
  const H = 288;
  const padL = 55;
  const padR = 20;
  const padT = 30;
  const padB = 50;
  const xMax = Math.max(...pts.map((p) => p.x), 1);
  const yMax = Math.max(...pts.map((p) => p.v), 1) * 1.1;
  const sx = (x) => padL + (x / xMax) * (W - padL - padR);
  const sy = (v) => H - padB - (v / yMax) * (H - padT - padB);
  const poly = pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');

  const yGrid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const v = yMax * f;
      return `<line x1="${padL}" y1="${sy(v).toFixed(1)}" x2="${W - padR}" y2="${sy(v).toFixed(1)}" stroke="#eee"/><text x="${padL - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#666">${v.toFixed(0)}</text>`;
    })
    .join('');

  const step = niceStep(xMax);
  let xGrid = '';
  for (let t = 0; t <= xMax + 0.001; t += step) {
    const x = sx(t).toFixed(1);
    xGrid += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="#eee"/><text x="${x}" y="${H - padB + 16}" text-anchor="middle" font-size="11" fill="#666">${fmtTime(t)}</text>`;
  }

  // Ramp/sustain/ramp-down phase boundaries from the k6 stages, offset from the sampler's t0 by
  // k6 init+setup (a few seconds), so treat these as approximate against the resource timeline.
  let phases = '';
  if (stages) {
    let cum = 0;
    for (const s of stages) {
      const d = parseDur(s.duration) || 0;
      const start = cum;
      const end = cum + d;
      cum = end;
      if (end > 0 && end < xMax) {
        const x = sx(end).toFixed(1);
        phases += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="#c98a00" stroke-width="1" stroke-dasharray="4 3"/>`;
      }
      const mid = (start + end) / 2;
      if (mid <= xMax) {
        phases += `<text x="${sx(mid).toFixed(1)}" y="${padT - 8}" text-anchor="middle" font-size="10" fill="#b07d00">${s.target} VUs</text>`;
      }
    }
  }

  const max = Math.max(...pts.map((p) => p.v));
  const avg = pts.reduce((s, p) => s + p.v, 0) / pts.length;

  return `<section>
  <h2>${title} <small>(max ${max.toFixed(1)}${unit}, avg ${avg.toFixed(1)}${unit})</small></h2>
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${yGrid}
    ${xGrid}
    ${phases}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#999"/>
    <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#999"/>
    <polyline fill="none" stroke="#2b7a4b" stroke-width="1.5" points="${poly}"/>
    <text x="${(W / 2).toFixed(0)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#666">elapsed (mm:ss)</text>
  </svg>
</section>`;
}

function configSection() {
  const items = [];
  if (specPath) items.push(['Test file', specPath]);
  if (exec) {
    if (exec.executor) items.push(['Executor', exec.executor]);
    if (exec.maxVUs != null) items.push(['Max VUs', String(exec.maxVUs)]);
    if (exec.totalDuration) items.push(['Total duration', exec.totalDuration]);
    if (exec.stages) {
      items.push(['Stages', exec.stages.map((s) => `${s.duration} → ${s.target} VUs`).join(' · ')]);
    }
  }
  if (items.length === 0) return '';
  const trs = items
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('');
  return `<section><h2>Run configuration</h2><table>${trs}</table></section>`;
}

const charts = [
  svgChart('CPU utilization', column('cpu_percent'), '%'),
  svgChart('RAM utilization', column('ram_percent'), '%'),
  svgChart('RAM used', column('ram_used_mb'), ' MB'),
  svgChart('Network received', column('net_rx_kBps'), ' KB/s'),
  svgChart('Network transmitted', column('net_tx_kBps'), ' KB/s'),
  svgChart('Load avg 1m (Linux) / processor queue (Windows)', column('load1'), ''),
].join('\n');

const summary = `<p>Samples: ${rows.length} &middot; Duration: ${elapsed[elapsed.length - 1].toFixed(0)}s &middot; Source: ${esc(csvPath.split(/[\\/]/).pop())}</p>`;
fs.writeFileSync(htmlPath, page(configSection() + summary + charts));
console.log('Wrote ' + htmlPath + ' (' + rows.length + ' samples)');
