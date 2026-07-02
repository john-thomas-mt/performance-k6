const fs = require('node:fs');
const { readExecReq, configSection, page, svgChart } = require('./chart-lib.cjs');

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

const TITLE = 'Agent resource utilization — k6 run';

if (rows.length === 0) {
  fs.writeFileSync(htmlPath, page(TITLE, '<p>No samples were captured.</p>'));
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

function chart(title, colName, unit) {
  return svgChart(title, elapsed, [{ values: column(colName), color: '#2b7a4b' }], unit, stages);
}

const charts = [
  chart('CPU utilization', 'cpu_percent', '%'),
  chart('RAM utilization', 'ram_percent', '%'),
  chart('RAM used', 'ram_used_mb', ' MB'),
  chart('Network received', 'net_rx_kBps', ' KB/s'),
  chart('Network transmitted', 'net_tx_kBps', ' KB/s'),
  chart('Load avg 1m (Linux) / processor queue (Windows)', 'load1', ''),
].join('\n');

const summary = `<p>Samples: ${rows.length} &middot; Duration: ${elapsed[elapsed.length - 1].toFixed(0)}s &middot; Source: ${csvPath.split(/[\\/]/).pop()}</p>`;
fs.writeFileSync(htmlPath, page(TITLE, configSection(specPath, exec) + summary + charts));
console.log('Wrote ' + htmlPath + ' (' + rows.length + ' samples)');
