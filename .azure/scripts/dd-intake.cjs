// Datadog agentless metrics-intake client, shared by the two forwarders (metric-forwarder.cjs tails a
// sampler CSV during the run, summary-forwarder.cjs posts an end-of-run summary once). Only the intake
// contract lives here — key handling, endpoint, payload shape, batch cap — so it is written once and a
// forwarder stays a CSV reader. See docs/datadog-live-metrics.md for what each feed carries and why.
const https = require('node:https');

const GAUGE = 3;
// Payloads cap at 500 KB. A row is one point per column at ~40 bytes, so 500 rows leaves wide margin.
const MAX_ROWS_PER_POST = 500;

const endpoint = new URL(process.env.DD_METRICS_URL || 'https://api.datadoghq.com/api/v2/series');

// The key is read from the environment, never argv, so it cannot surface in a process list. An unset
// Azure pipeline variable arrives as the literal '$(DD_API_KEY)', which counts as absent rather than
// as a junk key to submit with.
function apiKey() {
  const key = process.env.DD_API_KEY || '';
  return /^\$\(/.test(key) ? '' : key;
}

// A dropped batch is logged and abandoned rather than retried: the CSV artifact is the record, and
// requeueing would age points out of the intake's window anyway. The 'submit failed' wording is what
// run-k6.ps1 scans the forwarder log for, so a silent failure still becomes a build warning.
function post(label, series, done) {
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
        'DD-API-KEY': apiKey(),
        'Content-Length': Buffer.byteLength(body),
      },
    },
    (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (text += chunk));
      response.on('end', () => {
        const ok = response.statusCode === 202;
        if (!ok) console.error(`${label}: submit failed - HTTP ${response.statusCode} ${text.slice(0, 200)}`);
        done(ok);
      });
    },
  );
  request.on('error', (error) => {
    console.error(`${label}: submit failed - ${error.message}`);
    done(false);
  });
  request.on('timeout', () => request.destroy(new Error('request timeout')));
  request.end(body);
}

module.exports = { GAUGE, MAX_ROWS_PER_POST, endpoint, apiKey, post };
