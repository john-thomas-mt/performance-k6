'use strict';
// Runs a data-builder export and prints its emitted payload as JSON, so the comparator can shape-diff
// the committed builder against a fresh recording without running k6. The builder is executed in a
// stubbed CommonJS sandbox — k6 modules/globals are stubbed and the shared payload helpers are given
// type-faithful stand-ins — because the comparator only cares about structure (types/keys), not leaf
// values. Args are filled with type-appropriate placeholders inferred from the parameter names, so
// every builder signature resolves to a correctly-typed payload without knowing its internals.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const [file, exportName] = process.argv.slice(2);
if (!file || !exportName) {
  console.error('usage: node materialize-template.cjs <path/to/file.data.ts> <exportedBuilderName>');
  process.exit(2);
}

// Type-faithful stand-ins for the shared payload helpers — only the return TYPE matters for a shape
// diff, so the transforms need not be exact. setRowValue/clone are kept faithful since a builder may
// clone a template then mutate it.
const helperStub = {
  todayMidnightUtc: () => 0,
  majorMinor: () => '0.0',
  clone: (v) => JSON.parse(JSON.stringify(v)),
  setRowValue(t, name, value) {
    const i = t.TransportDataColumns.findIndex((c) => c.ColumnName === name);
    if (i >= 0) t.TransportDataRows[0].Values[String(i)] = value;
  },
  setColumnValueAllRows(t, name, value) {
    const i = t.TransportDataColumns.findIndex((c) => c.ColumnName === name);
    if (i < 0) return;
    for (const row of t.TransportDataRows) row.Values[String(i)] = value;
  },
  getColumnValue(t, row, name) {
    const i = t.TransportDataColumns.findIndex((c) => c.ColumnName === name);
    return i >= 0 && t.TransportDataRows[row] ? t.TransportDataRows[row].Values[String(i)] : undefined;
  },
};

const cache = new Map();
function load(abs) {
  if (cache.has(abs)) return cache.get(abs).exports;
  const js = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: abs,
  }).outputText;
  const mod = { exports: {} };
  cache.set(abs, mod);
  const dir = path.dirname(abs);
  const req = (spec) => {
    if (spec === 'k6' || spec.startsWith('k6/')) return {}; // k6 runtime — not needed to build a body
    if (spec.endsWith('helpers.exp.ts')) return helperStub;
    if (spec.endsWith('.exp.ts')) return {}; // types + other barrels erase to nothing runtime-relevant
    if (spec.startsWith('.')) {
      let p = path.resolve(dir, spec);
      if (!fs.existsSync(p) && fs.existsSync(p + '.ts')) p += '.ts';
      return load(p);
    }
    return require(spec);
  };
  // k6 runtime globals a builder module might touch at import time (e.g. env.config's open()).
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', 'open', '__ENV', '__VU', '__ITER', js);
  fn(mod.exports, req, mod, dir, abs, () => '{}', {}, 1, 0);
  return mod.exports;
}

// Placeholder per parameter, typed by name: a correlated row object (property access yields a numeric
// string, so both `so.acct` and `Number(so.evtId)` resolve to the right kind), a number, or a string.
function argFor(name) {
  if (/^(source|so|event|order|row)$/i.test(name)) return new Proxy({}, { get: () => '1' });
  if (/^(quantity|qty|count|amount|total|price|num)$/i.test(name)) return 1;
  return '1';
}

const builder = load(path.resolve(file))[exportName];
if (typeof builder !== 'function') {
  console.error(`export "${exportName}" is not a builder function in ${file}`);
  process.exit(2);
}
const params = ((builder.toString().match(/^[^(]*\(([^)]*)\)/) || [, ''])[1])
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
process.stdout.write(JSON.stringify(builder(...params.map(argFor))));
