'use strict';
// Extracts a named const's embedded literal from a .data.ts builder and prints it as JSON, so the
// comparator can diff the committed payload template against a fresh recording without running k6.
// Works on the JSON.stringify-produced template literals (e.g. TEMPLATE, ORDER_HEADER_TABLE) — it
// balance-matches the first [ or { after the `=` and JSON.parses it.
const fs = require('fs');

const [file, constName] = process.argv.slice(2);
if (!file || !constName) {
  console.error('usage: node materialize-template.cjs <path/to/file.data.ts> <ConstName>');
  process.exit(2);
}

const src = fs.readFileSync(file, 'utf8');
const decl = src.indexOf(constName);
if (decl === -1) {
  console.error(`const "${constName}" not found in ${file}`);
  process.exit(2);
}

const eq = src.indexOf('=', decl);
let i = eq + 1;
while (i < src.length && src[i] !== '[' && src[i] !== '{') i++;
const open = src[i];
const close = open === '[' ? ']' : '}';

let depth = 0;
let inStr = false;
let esc = false;
let end = -1;
for (let j = i; j < src.length; j++) {
  const c = src[j];
  if (inStr) {
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') inStr = false;
    continue;
  }
  if (c === '"') inStr = true;
  else if (c === open) depth++;
  else if (c === close) {
    depth--;
    if (depth === 0) {
      end = j + 1;
      break;
    }
  }
}

process.stdout.write(JSON.stringify(JSON.parse(src.slice(i, end))));
