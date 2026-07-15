// Summarize a generated fidelity list (source/data/chrome/*.chrome.ts, source/data/static/*.static.ts)
// WITHOUT reading it into the main context. These files carry multi-KB opaque replay bodies the author
// never touches by hand — fire_ui_chrome / fire_static_assets substitute the ${…} tokens at runtime. The
// author needs only three things to wire the flow: the step keys, the ${…} tokens per step, and the token
// UNION (the exact subs-map key set the flow must supply). This prints those; never `Read` the file.
//
// Usage:
//   node scripts/fidelity-tokens.js <chrome-file> [static-file ...]
//   node scripts/fidelity-tokens.js source/data/chrome/copy-service-orders.chrome.ts source/data/static/copy-service-orders.static.ts

const fs = require('fs');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/fidelity-tokens.js <chrome-file> [static-file ...]');
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
  // step blocks: "NN": [ ... ] keyed by two-digit step. Quote-agnostic: the generator emits double
  // quotes but the pre-commit prettier pass rewrites keys to single quotes.
  const re = /['"](\d{2})['"]:\s*\[/g;
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

console.log(`\nSUBS-MAP CONTRACT — every token below must be provided by the flow's subs map (${grandUnion.size} keys):`);
console.log(
  grandUnion.size
    ? [...grandUnion]
        .sort()
        .map((t) => `  ${t}`)
        .join('\n')
    : '  (none)',
);
console.log('\nCross-check each against what the spine correlates; a token that is not a standard spine output');
console.log('(e.g. an event row key) needs its own include_ui-gated lookup wrapper before the batch consumes it.');
