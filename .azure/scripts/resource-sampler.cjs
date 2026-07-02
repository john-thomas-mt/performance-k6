const os = require('node:os');
const fs = require('node:fs');

const [, , outPath = 'temp/resource-usage.csv', intervalArg = '1'] = process.argv;
const intervalMs = Math.max(1, Number(intervalArg)) * 1000;

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function readNetDev() {
  try {
    const data = fs.readFileSync('/proc/net/dev', 'utf8');
    let rx = 0;
    let tx = 0;
    for (const line of data.split('\n')) {
      const m = line.match(/^\s*([^:]+):\s*(.+)$/);
      if (!m || m[1].trim() === 'lo') continue;
      const cols = m[2].trim().split(/\s+/).map(Number);
      rx += cols[0];
      tx += cols[8];
    }
    return { rx, tx };
  } catch {
    return null;
  }
}

fs.writeFileSync(outPath, 'timestamp,cpu_percent,ram_percent,ram_used_mb,net_rx_kBps,net_tx_kBps,load1\n');

let prevCpu = cpuTimes();
let prevNet = readNetDev();
let prevTime = Date.now();

const timer = setInterval(() => {
  const now = Date.now();
  const dtSec = (now - prevTime) / 1000;

  const curCpu = cpuTimes();
  const idleDelta = curCpu.idle - prevCpu.idle;
  const totalDelta = curCpu.total - prevCpu.total;
  const cpuPct = totalDelta > 0 ? 100 * (1 - idleDelta / totalDelta) : 0;
  prevCpu = curCpu;

  const total = os.totalmem();
  const used = total - os.freemem();
  const ramPct = 100 * (used / total);
  const ramUsedMb = used / (1024 * 1024);

  let netRx = '';
  let netTx = '';
  const curNet = readNetDev();
  if (curNet && prevNet && dtSec > 0) {
    netRx = ((curNet.rx - prevNet.rx) / 1024 / dtSec).toFixed(1);
    netTx = ((curNet.tx - prevNet.tx) / 1024 / dtSec).toFixed(1);
  }
  prevNet = curNet;

  prevTime = now;

  const row = [
    new Date(now).toISOString(),
    cpuPct.toFixed(1),
    ramPct.toFixed(1),
    ramUsedMb.toFixed(0),
    netRx,
    netTx,
    os.loadavg()[0].toFixed(2),
  ].join(',');
  fs.appendFileSync(outPath, row + '\n');
}, intervalMs);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
