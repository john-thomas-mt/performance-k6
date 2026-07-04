'use strict';
// Structural (shape) diff of two JSON values. Ignores leaf VALUES by default — dynamic
// correlated/parameterized fields differ by design — and reports only structure: keys/elements
// added or removed, and type mismatches. Arrays of objects sharing a stable id field
// (ColumnName/Key/id/Name) are matched by that field so drift names the element, not an index.
const fs = require('fs');

const ID_KEYS = ['ColumnName', 'Key', 'id', 'Name'];
const kind = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

function idKeyFor(a, b) {
  const allObjs = (arr) => arr.length > 0 && arr.every((e) => kind(e) === 'object');
  if (!allObjs(a) || !allObjs(b)) return null;
  return ID_KEYS.find((k) => a.every((e) => k in e) && b.every((e) => k in e)) || null;
}

function walk(a, b, path, out) {
  const ka = kind(a);
  const kb = kind(b);
  if (ka !== kb) {
    out.push(`${path || '(root)'}: type ${ka} -> ${kb}`);
    return;
  }
  if (ka === 'object') {
    for (const k of Object.keys(a)) if (!(k in b)) out.push(`${path}.${k}: removed (object has, recording lacks)`);
    for (const k of Object.keys(b)) if (!(k in a)) out.push(`${path}.${k}: ADDED (recording has, object lacks)`);
    for (const k of Object.keys(a)) if (k in b) walk(a[k], b[k], `${path}.${k}`, out);
    return;
  }
  if (ka === 'array') {
    const id = idKeyFor(a, b);
    if (id) {
      const aById = new Map(a.map((e) => [e[id], e]));
      const bById = new Map(b.map((e) => [e[id], e]));
      for (const e of a) if (!bById.has(e[id])) out.push(`${path}[${id}=${e[id]}]: removed (object has, recording lacks)`);
      for (const e of b) if (!aById.has(e[id])) out.push(`${path}[${id}=${e[id]}]: ADDED (recording has, object lacks)`);
      for (const e of a) if (bById.has(e[id])) walk(e, bById.get(e[id]), `${path}[${id}=${e[id]}]`, out);
    } else {
      if (a.length !== b.length) out.push(`${path}: array length ${a.length} -> ${b.length}`);
      for (let i = 0; i < Math.min(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`, out);
    }
  }
}

function diff(object, recorded) {
  const out = [];
  walk(object, recorded, '', out);
  return out;
}

if (require.main === module) {
  const [objPath, recPath] = process.argv.slice(2);
  if (!objPath || !recPath) {
    console.error('usage: node compare-payload.cjs <object.json> <recorded.json>');
    process.exit(2);
  }
  const out = diff(JSON.parse(fs.readFileSync(objPath, 'utf8')), JSON.parse(fs.readFileSync(recPath, 'utf8')));
  if (!out.length) {
    console.log('CLEAN: no structural drift');
    process.exit(0);
  }
  console.log(`STRUCTURAL DRIFT (${out.length}):`);
  out.forEach((l) => console.log('  ' + l));
  process.exit(1);
}

module.exports = { diff };
