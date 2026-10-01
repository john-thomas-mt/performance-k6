// Resolve the NeoLoad `${P_…}` variables a VU references into concrete data pools — the discovery half
// of the pool port. A VU tree only ever names a variable; the values live outside it, in three different
// forms this walks for you:
//
//   <variable-file>  team/variables/@p_…xml  →  variables/version_<ver>/*.txt   (delimited rows)
//   <variable-list>  team/variables/@p_…xml  →  inline Base64 Java String[][]   (invisible to grep)
//   <variable-constant> / -random-number / -currentdate / -counter / -password   (not pools)
//
// So a pool is never inferred from a token, transcribed from the head of a file, or missed because its
// values were Base64-encoded inside the definition.
//
// Usage:
//   node .claude/scripts/neoload-vars.cjs "<VU tree dir>"              # pools this VU references
//   node .claude/scripts/neoload-vars.cjs "<VU tree dir>" --rows 10    # show more sample rows
//   node .claude/scripts/neoload-vars.cjs --var P_26_2_CopyEvents "<any path in the NeoLoad project>"
//
// Deterministic and read-only. Also required as a module by neoload-digest.cjs and gen-pool.cjs:
// findProjectRoot, loadDefs, resolveDef, refsInTree, decodeInlineValues, poolValues.

const fs = require('fs');
const path = require('path');

// ---- NeoLoad project discovery ----------------------------------------------------------------
// Walk up from any path inside the project to the root that holds both team/variables and variables/,
// so resolution works whatever the cwd (the k6 repo root, per the other scripts' convention).
const findProjectRoot = (start) => {
  let dir = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'team', 'variables'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
};

// ---- variable definitions (team/variables/*.xml) ----------------------------------------------
const attr = (text, name) => (text.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];

const parseDef = (xml, file) => {
  const tagMatch = xml.match(/<(variable-[a-z-]+)\b/);
  if (!tagMatch) return null;
  const tag = tagMatch[1];
  const head = xml.slice(tagMatch.index, xml.indexOf('>', tagMatch.index) + 1);
  const name = attr(head, 'name');
  if (!name) return null;
  const columns = [...xml.matchAll(/<column\b[^>]*>/g)]
    .map((m) => ({ name: attr(m[0], 'name'), number: Number(attr(m[0], 'number') || 0) }))
    .sort((a, b) => a.number - b.number);
  return {
    file,
    tag,
    name,
    columns,
    filename: attr(head, 'filename'),
    delimiters: attr(head, 'delimiters'),
    useFirstLine: attr(head, 'useFirstLine') === 'true',
    whenOutOfValues: attr(head, 'whenOutOfValues'),
    policy: attr(head, 'policy'),
    range: attr(head, 'range'),
    constantValue: attr(head, 'constantValue'),
    minValue: attr(head, 'min-value'),
    maxValue: attr(head, 'max-value'),
    pattern: attr(head, 'pattern'),
    starting: attr(head, 'starting'),
    inc: attr(head, 'inc'),
    max: attr(head, 'max'),
    // NeoLoad's own attribute spelling (variable-random-string max-lenght / min-lenght)
    minLength: attr(head, 'min-lenght') ?? attr(head, 'min-length'),
    maxLength: attr(head, 'max-lenght') ?? attr(head, 'max-length'),
    values: (xml.match(/<values><!\[CDATA\[([\s\S]*?)\]\]><\/values>/) || [])[1],
    description: ((xml.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '').trim(),
  };
};

const loadDefs = (root) => {
  const dir = path.join(root, 'team', 'variables');
  const defs = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.xml')) continue;
    const def = parseDef(fs.readFileSync(path.join(dir, f), 'utf8'), f);
    if (def) defs.set(def.name, def);
  }
  return defs;
};

// ---- inline <values>: Java-serialised String[][] -----------------------------------------------
// NeoLoad stores a <variable-list>'s rows as a Base64 java.io.ObjectOutputStream dump of String[][].
// Only the tags that shape reaches are handled; anything else throws rather than silently mis-decoding.
const TC_NULL = 0x70;
const TC_REFERENCE = 0x71;
const TC_CLASSDESC = 0x72;
const TC_STRING = 0x74;
const TC_ARRAY = 0x75;
const TC_ENDBLOCKDATA = 0x78;
const BASE_WIRE_HANDLE = 0x7e0000;

const decodeInlineValues = (b64) => {
  const buf = Buffer.from(String(b64).replace(/\s+/g, ''), 'base64');
  let i = 0;
  const u1 = () => buf[i++];
  const u2 = () => {
    const v = buf.readUInt16BE(i);
    i += 2;
    return v;
  };
  const u4 = () => {
    const v = buf.readUInt32BE(i);
    i += 4;
    return v;
  };
  const utf = () => {
    const n = u2();
    const s = buf.slice(i, i + n).toString('utf8');
    i += n;
    return s;
  };

  if (u2() !== 0xaced) throw new Error('not a Java serialisation stream');
  u2();

  const handles = [];
  const deref = () => handles[u4() - BASE_WIRE_HANDLE];

  const classDesc = () => {
    const tc = u1();
    if (tc === TC_NULL) return null;
    if (tc === TC_REFERENCE) return deref();
    if (tc !== TC_CLASSDESC) throw new Error(`unexpected class-desc tag 0x${tc.toString(16)}`);
    const className = utf();
    i += 8;
    handles.push({ className });
    u1();
    if (u2() !== 0) throw new Error(`class descriptor ${className} carries fields — unsupported shape`);
    if (u1() !== TC_ENDBLOCKDATA) throw new Error(`expected TC_ENDBLOCKDATA in ${className}`);
    classDesc();
    return { className };
  };

  const obj = () => {
    const tc = u1();
    if (tc === TC_NULL) return null;
    if (tc === TC_REFERENCE) return deref();
    if (tc === TC_STRING) {
      const s = utf();
      handles.push(s);
      return s;
    }
    if (tc === TC_ARRAY) {
      classDesc();
      const arr = [];
      handles.push(arr);
      const n = u4();
      for (let k = 0; k < n; k++) arr.push(obj());
      return arr;
    }
    throw new Error(`unexpected object tag 0x${tc.toString(16)}`);
  };

  const top = obj();
  if (!Array.isArray(top)) throw new Error('inline <values> did not decode to an array');
  return top.map((row) => (Array.isArray(row) ? row.map((v) => (v == null ? '' : String(v))) : [String(row ?? '')]));
};

// ---- resolution --------------------------------------------------------------------------------
const splitRow = (line, delimiters) => {
  if (!delimiters) return [line];
  const cls = delimiters.replace(/[\\\]^-]/g, '\\$&');
  return line.split(new RegExp(`[${cls}]`));
};

const commonPrefix = (rows) => {
  if (rows.length < 3 || new Set(rows).size < 2) return '';
  let p = rows[0];
  for (const r of rows) {
    let k = 0;
    while (k < p.length && k < r.length && p[k] === r[k]) k++;
    p = p.slice(0, k);
    if (!p) break;
  }
  return p;
};

const resolveDef = (def, root) => {
  const base = { name: def.name, tag: def.tag, description: def.description, whenOutOfValues: def.whenOutOfValues };

  if (def.tag === 'variable-file') {
    const abs = path.resolve(root, def.filename);
    if (!fs.existsSync(abs)) return { ...base, kind: 'pool', source: def.filename, error: 'data file not found' };
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const header = def.useFirstLine ? splitRow(lines.shift() ?? '', def.delimiters) : null;
    const rows = lines.map((l) => splitRow(l, def.delimiters));
    const columns = def.columns.length ? def.columns : (header || []).map((n, k) => ({ name: n.trim(), number: k }));
    const overSplit = rows.filter((r) => r.length > columns.length).length;
    return {
      ...base,
      kind: 'pool',
      source: def.filename,
      delimiters: def.delimiters,
      header,
      columns,
      rows,
      warning: overSplit
        ? `${overSplit}/${rows.length} lines split into more fields than the ${columns.length} declared column(s) — delimiter "${def.delimiters}" occurs inside values, so a column read may truncate`
        : null,
    };
  }

  if (def.tag === 'variable-list') {
    let rows;
    try {
      rows = decodeInlineValues(def.values);
    } catch (e) {
      return { ...base, kind: 'pool', source: `${def.file} (inline Base64)`, error: e.message };
    }
    return {
      ...base,
      kind: 'pool',
      source: `${def.file} (inline Base64 <values>)`,
      columns: def.columns,
      rows,
      warning: null,
    };
  }

  if (def.tag === 'variable-constant') return { ...base, kind: 'constant', detail: JSON.stringify(def.constantValue) };
  if (def.tag === 'variable-random-number') return { ...base, kind: 'generated', detail: `random ${def.minValue}–${def.maxValue}` };
  if (def.tag === 'variable-currentdate') return { ...base, kind: 'generated', detail: `current date, pattern "${def.pattern}"` };
  if (def.tag === 'variable-counter')
    return { ...base, kind: 'generated', detail: `counter from ${def.starting} inc ${def.inc} max ${def.max}` };
  if (def.tag === 'variable-random-string')
    return { ...base, kind: 'generated', detail: `random string, ${def.minLength ?? '?'}–${def.maxLength ?? '?'} chars` };
  if (def.tag === 'variable-password') return { ...base, kind: 'generated', detail: 'password (opaque)' };
  return { ...base, kind: 'other', detail: def.tag };
};

// Column values for a resolved pool, by column name or index. Blank cells are dropped.
const poolValues = (resolved, column) => {
  const cols = resolved.columns || [];
  const idx =
    column == null ? 0 : /^\d+$/.test(String(column)) ? Number(column) : (cols.find((c) => c.name === column) || { number: -1 }).number;
  if (idx < 0) throw new Error(`column "${column}" not in ${resolved.name} (have: ${cols.map((c) => c.name).join(', ')})`);
  return resolved.rows.map((r) => (r[idx] ?? '').trim()).filter(Boolean);
};

// ---- which variables a VU tree references ------------------------------------------------------
const refsInTree = (treeDir) => {
  const refs = new Map();
  const add = (name, column) => {
    if (!refs.has(name)) refs.set(name, new Set());
    if (column) refs.get(name).add(column);
  };
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'recorded-artifacts') walk(p);
        continue;
      }
      if (!/\.(xml|js)$/i.test(e.name)) continue;
      const text = fs.readFileSync(p, 'utf8');
      for (const m of text.matchAll(/\$\{([Pp]_[A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g)) add(m[1], m[2]);
      for (const m of text.matchAll(/getValue\s*\(\s*['"]([Pp]_[A-Za-z0-9_]+)['"]/g)) add(m[1], null);
    }
  };
  walk(treeDir);
  const vuXml = `${treeDir.replace(/[\\/]+$/, '')}.xml`;
  if (fs.existsSync(vuXml)) {
    for (const m of fs.readFileSync(vuXml, 'utf8').matchAll(/\$\{([Pp]_[A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}/g)) add(m[1], m[2]);
  }
  return refs;
};

// ---- report ------------------------------------------------------------------------------------
const kebab = (name) =>
  name
    .replace(/^P_/, '')
    .replace(/^\d+_\d+_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

// Emitted by both this CLI and the digest's DATA POOLS section.
const poolReport = (refs, defs, root, sampleRows) => {
  const out = [];
  const pools = [];
  const scalars = [];
  const unresolved = [];

  for (const name of [...refs.keys()].sort()) {
    const def = defs.get(name);
    if (!def) {
      unresolved.push(name);
      continue;
    }
    const r = resolveDef(def, root);
    // A single-row variable-list is a lookup map (the env/version matrix), not a pool to iterate.
    if (r.kind === 'pool' && !r.error && (r.rows || []).length <= 1) {
      const cells = (r.columns || []).map((c) => `${c.name}=${JSON.stringify((r.rows[0] || [])[c.number] ?? '')}`);
      scalars.push({ ...r, kind: 'lookup', detail: cells.join(', ') });
      continue;
    }
    if (r.kind === 'pool') pools.push([r, refs.get(name)]);
    else scalars.push(r);
  }

  out.push(`DATA POOLS  (port COMPLETE to source/data/pools/ — never the head of the file):`);
  if (!pools.length) out.push('  (none)');
  for (const [r, cols] of pools) {
    out.push(`  ${r.name}   [${r.tag}]`);
    out.push(`      source: ${r.source}`);
    if (r.error) {
      out.push(`      !! UNRESOLVED: ${r.error}`);
      continue;
    }
    const colList = (r.columns || []).map((c) => `${c.name}(${c.number})`).join(', ') || '(unnamed)';
    out.push(`      columns: ${colList}${r.delimiters ? `   delim="${r.delimiters}"` : ''}   cycle=${r.whenOutOfValues}`);
    for (const c of r.columns || []) {
      const vals = poolValues(r, c.name);
      const uniq = new Set(vals).size;
      const pre = commonPrefix(vals);
      out.push(
        `      rows: ${vals.length}  unique: ${uniq}${pre.length >= 8 ? `  shared prefix "${pre}" → likely SEED-PRODUCED, prefer runtime discovery over a pool` : ''}`,
      );
      out.push(
        `        ${c.name}: ${vals
          .slice(0, sampleRows)
          .map((v) => JSON.stringify(v))
          .join(' | ')}${vals.length > sampleRows ? ' | …' : ''}`,
      );
    }
    if (r.warning) out.push(`      WARNING: ${r.warning}`);
    if (r.description) out.push(`      note: ${r.description.replace(/\s+/g, ' ')}`);
    out.push(`      referenced as: ${[...cols].map((c) => `\${${r.name}.${c}}`).join(', ') || `\${${r.name}}`}`);
    if (/UserCredentials/i.test(r.name)) {
      out.push('      → already ported as source/data/creds/users.data.ts (encrypted pool) — no gen-pool run needed');
    } else {
      const col = (r.columns || [])[0];
      out.push(
        `      → node .claude/scripts/gen-pool.cjs "${root.replace(/\\/g, '/')}" ${r.name} ${col ? col.name : 0} source/data/pools/${kebab(r.name)}.data.ts`,
      );
    }
  }

  out.push('');
  out.push('CONSTANTS / GENERATED  (config value, or regenerate per iteration — not a pool):');
  if (!scalars.length) out.push('  (none)');
  for (const s of scalars) out.push(`  ${s.name}  [${s.tag}]  ${s.detail}`);

  if (unresolved.length) {
    out.push('');
    out.push('NO DEFINITION FOUND  (VU-local, or set by a jsAction — check %resources%/scripts/):');
    for (const n of unresolved) out.push(`  ${n}`);
  }
  return out.join('\n');
};

module.exports = {
  findProjectRoot,
  loadDefs,
  resolveDef,
  refsInTree,
  decodeInlineValues,
  poolValues,
  poolReport,
  kebab,
  commonPrefix,
};

// ---- CLI ---------------------------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const rowsFlag = argv.indexOf('--rows');
  const sampleRows = rowsFlag >= 0 ? Number(argv[rowsFlag + 1]) : 3;
  if (rowsFlag >= 0) argv.splice(rowsFlag, 2);
  const varFlag = argv.indexOf('--var');
  const varName = varFlag >= 0 ? argv[varFlag + 1] : null;
  if (varFlag >= 0) argv.splice(varFlag, 2);
  const target = argv[0];

  if (!target) {
    console.error('usage: node .claude/scripts/neoload-vars.cjs "<VU tree dir>" [--rows N]');
    console.error('       node .claude/scripts/neoload-vars.cjs --var <P_Name> "<path in the NeoLoad project>"');
    process.exit(1);
  }
  const root = findProjectRoot(target);
  if (!root) {
    console.error(`no NeoLoad project root (a dir containing team/variables) at or above: ${target}`);
    process.exit(1);
  }
  const defs = loadDefs(root);

  if (varName) {
    const def = defs.get(varName);
    if (!def) {
      console.error(`no definition for ${varName} in ${path.join(root, 'team', 'variables')}`);
      process.exit(1);
    }
    console.log(`=== NEOLOAD VARIABLE: ${varName} ===\n`);
    console.log(poolReport(new Map([[varName, new Set()]]), defs, root, sampleRows));
  } else {
    console.log(`=== NEOLOAD VARIABLES: ${path.basename(target)} ===\n`);
    console.log(poolReport(refsInTree(target), defs, root, sampleRows));
  }
}
