// Summarize a generated fidelity list (source/data/chrome/*.chrome.ts, source/data/static/*.static.ts)
// WITHOUT reading it into the main context. These files carry multi-KB opaque replay bodies the author
// never touches by hand — fire_ui_chrome / fire_static_assets substitute the ${…} tokens at runtime. The
// author needs only three things to wire the flow: the step keys, the ${…} tokens per step, and the token
// UNION (the exact subs-map key set the flow must supply). This prints those; never `Read` the file.
// With --vu it also prints each token's PROVENANCE — the step and request whose <variable-extractor> mints
// it in the recording — so the subs value is correlated from that same request, never aliased to a
// same-shaped value from elsewhere (a column-cache stamp from another step/object is a different value).
//
// Usage:
//   node .claude/scripts/fidelity-tokens.cjs <chrome-file> [static-file ...] [--vu "<VU tree dir>"]
//   node .claude/scripts/fidelity-tokens.cjs source/data/chrome/copy-service-orders.chrome.ts source/data/static/copy-service-orders.static.ts

const fs = require('fs');

const args = process.argv.slice(2);
const vuAt = args.indexOf('--vu');
const vuDir = vuAt >= 0 ? args[vuAt + 1] : null;
const files = args.filter((a, i) => vuAt < 0 || (i !== vuAt && i !== vuAt + 1));
if (!files.length || (vuAt >= 0 && !vuDir)) {
  console.error('usage: node .claude/scripts/fidelity-tokens.cjs <chrome-file> [static-file ...] [--vu "<VU tree dir>"]');
  process.exit(1);
}

const tokensIn = (s) => [...s.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]);

const summarize = (file) => {
  if (!fs.existsSync(file)) {
    console.log(`\n${file}\n  (not found)`);
    return new Set();
  }
  const src = fs.readFileSync(file, 'utf8');
  const exportName = (src.match(/export const (\w+)/) || [])[1] || '(unknown export)';
  // step blocks: top-level "NN": [ ... ] keys, anchored to the object's own indentation so a "41": [ inside
  // a replay body is not read as a step. Quote-agnostic: the generator emits double quotes but the
  // pre-commit prettier pass rewrites keys to single quotes.
  const re = /^ {2}['"](\d{2})['"]:\s*\[/gm;
  const idx = [];
  let m;
  while ((m = re.exec(src))) idx.push([m[1], m.index]);
  idx.push(['END', src.length]);

  console.log(`\n${file}  (export ${exportName})`);
  const fileUnion = new Set();
  if (idx.length === 1) {
    console.log('  (no step blocks found — regenerate or check the file shape)');
    return fileUnion;
  }
  for (let i = 0; i < idx.length - 1; i++) {
    const block = src.slice(idx[i][1], idx[i + 1][1]);
    const count = (block.match(/["']?method["']?\s*:/g) || []).length || (block.match(/["']?(path|url)["']?\s*:/g) || []).length;
    const toks = [...new Set(tokensIn(block))].sort();
    toks.forEach((t) => fileUnion.add(t));
    console.log(`  step ${idx[i][0]}  reqs=${count}  tokens: ${toks.join(', ') || '(none)'}`);
  }
  return fileUnion;
};

const grandUnion = new Set();
for (const f of files) {
  for (const t of summarize(f)) grandUnion.add(t);
}

const provenance = new Map();
if (vuDir) {
  const { readTree } = require('./neoload-tree.cjs');
  for (const s of readTree(vuDir).steps) {
    const stepNo = (s.name.match(/_(\d+)_/) || [])[1];
    for (const r of s.requests) {
      for (const e of r.extractors) {
        if (!provenance.has(e.name)) provenance.set(e.name, new Set());
        provenance.get(e.name).add(`step ${stepNo} ${r.endpoint} (${r.file})`);
      }
    }
  }
}
const origin = (t) => {
  if (!vuDir) return '';
  if (provenance.has(t)) return `  ← ${[...provenance.get(t)].join('; ')}`;
  if (/^P_/.test(t)) return '  ← project variable (pool / constant / generated — see neoload-vars.cjs)';
  return '  ← not extracted in this VU (a jsAction output or a client-generated value — find its source)';
};

console.log(`\nSUBS-MAP CONTRACT — every token below must be provided by the flow's subs map (${grandUnion.size} keys):`);
console.log(
  grandUnion.size
    ? [...grandUnion]
        .sort()
        .map((t) => `  ${t}${origin(t)}`)
        .join('\n')
    : '  (none)',
);
console.log('\nCross-check each against what the spine correlates; a token that is not a standard spine output');
console.log('(e.g. an event row key) needs its own include_ui-gated lookup wrapper before the batch consumes it.');
if (vuDir) console.log('Correlate each from the request its provenance names — not from a same-shaped value of another step.');
