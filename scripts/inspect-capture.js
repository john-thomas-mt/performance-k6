// Dissect a captured request/response body for k6 authoring (generate-test / neoload-to-k6).
// Prints the envelope shape, populated transport-table cells with column names, and
// correlation candidates (values that must be regenerated client-side or extracted from a
// response, never frozen into a builder). Keeps raw bytes out of the main context.
//
// Usage:
//   node scripts/inspect-capture.js <capture-file> [searchValue]
//
// <capture-file>  a JSON request/response body (e.g. temp/captures/raw/save2.reqbody)
// [searchValue]   optional: print every JSON path where this value appears (find consumers)

const fs = require('fs');

const [file, search] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/inspect-capture.js <capture-file> [searchValue]');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
let j;
try {
  j = JSON.parse(raw);
} catch (e) {
  console.error('not JSON at top level:', e.message);
  console.error('first 200 chars:', raw.slice(0, 200));
  process.exit(1);
}

const shape = (v) =>
  Array.isArray(v) ? `Array(${v.length})` : v && typeof v === 'object' ? `{${Object.keys(v).join(',')}}` : JSON.stringify(v);

console.log('TOP:', shape(j));
if (Array.isArray(j)) j.forEach((e, i) => console.log(`  [${i}] ${shape(e).slice(0, 140)}`));

// Transport tables: populated cells (non-empty Values) resolved to their column names.
const tables = [];
const findTables = (v, path) => {
  if (Array.isArray(v)) {
    v.forEach((e, i) => findTables(e, `${path}[${i}]`));
    return;
  }
  if (v && typeof v === 'object') {
    if (Array.isArray(v.TransportDataColumns) && Array.isArray(v.TransportDataRows)) tables.push([path, v]);
    for (const k of Object.keys(v)) findTables(v[k], `${path}.${k}`);
  }
};
findTables(j, 'root');

for (const [path, t] of tables) {
  const cols = t.TransportDataColumns;
  console.log(`\nTABLE ${path}  cols=${cols.length} rows=${t.TransportDataRows.length} TableName=${JSON.stringify(t.TableName)}`);
  t.TransportDataRows.forEach((r, ri) => {
    const vals = r.Values || {};
    const pop = Object.keys(vals).filter((k) => {
      const x = vals[k];
      return x !== null && x !== '' && x !== 0 && x !== false;
    });
    console.log(`  row[${ri}] populated ${pop.length}/${Object.keys(vals).length}:`);
    for (const k of pop) {
      const col = cols.find((c) => String(c.ColumnID) === String(k));
      console.log(`    Values["${k}"] ${col ? col.ColumnName : '?'} = ${JSON.stringify(vals[k])}`);
    }
  });
}

// Correlation candidates — values that must not be frozen into a builder.
const cands = { guid: new Set(), timestamp: new Set(), rowKey: new Set(), token: new Set() };
const reGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reTs = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const reRowKey = /^\d+\|[-\w]+$/;
const reToken = /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./; // jwt-ish (header.payload.)
const walk = (v) => {
  if (typeof v === 'string') {
    if (reGuid.test(v)) cands.guid.add(v);
    else if (reTs.test(v)) cands.timestamp.add(v);
    else if (reRowKey.test(v)) cands.rowKey.add(v);
    else if (reToken.test(v)) cands.token.add(v);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach(walk);
    return;
  }
  if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(j);

console.log('\nCORRELATION CANDIDATES (regenerate client-side, or extract from a prior response — never freeze):');
let any = false;
for (const [kind, set] of Object.entries(cands)) {
  if (set.size) {
    any = true;
    const shown = [...set].slice(0, 8).map((x) => (x.length > 60 ? x.slice(0, 57) + '...' : x));
    console.log(`  ${kind} (${set.size}): ${shown.join('  ')}`);
  }
}
if (!any) console.log('  (none detected)');

// Optional: locate every path a value is consumed at.
if (search) {
  const hits = [];
  const find = (v, path) => {
    if (typeof v === 'string' || typeof v === 'number') {
      if (String(v).includes(search)) hits.push(path);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((e, i) => find(e, `${path}[${i}]`));
      return;
    }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) find(v[k], `${path}.${k}`);
  };
  find(j, 'root');
  console.log(`\n"${search}" appears at ${hits.length} path(s):`);
  hits.slice(0, 20).forEach((p) => console.log('  ' + p));
}
