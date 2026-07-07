// Styling docs drift check: every shadow part and every --sparq-* token that
// exists in component source must be documented in docs/styling/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(root, 'packages/components/src');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(vue|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const parts = new Set();
const tokens = new Set();

for (const file of walk(SRC_DIR)) {
  const src = readFileSync(file, 'utf-8');

  // static part="a b" and dynamic :part="cond ? 'a a-sel' : 'a'"
  for (const [, value] of src.matchAll(/:?part="([^"]*)"/g)) {
    const literals = value.includes("'")
      ? [...value.matchAll(/'([^']*)'/g)].map((m) => m[1])
      : [value];
    for (const literal of literals) {
      for (const token of literal.split(/\s+/)) {
        if (/^[a-z][a-z0-9-]*$/.test(token)) parts.add(token);
      }
    }
  }

  // imperative setAttribute('part', 'x y')
  for (const [, value] of src.matchAll(/setAttribute\(\s*'part'\s*,\s*'([^']*)'\s*\)/g)) {
    for (const token of value.split(/\s+/)) {
      if (/^[a-z][a-z0-9-]*$/.test(token)) parts.add(token);
    }
  }

  for (const [token] of src.matchAll(/--sparq-[a-z-]+/g)) tokens.add(token);
}

const anatomy = readFileSync(join(root, 'docs/styling/anatomy.md'), 'utf-8');
const stylingDocs = ['README.md', 'anatomy.md', 'light-dom.md', 'recipes.md']
  .map((f) => readFileSync(join(root, 'docs/styling', f), 'utf-8'))
  .join('\n');

const missingParts = [...parts].filter((p) => !anatomy.includes(`\`${p}\``));
const missingTokens = [...tokens].filter((t) => !stylingDocs.includes(t));

if (missingParts.length || missingTokens.length) {
  if (missingParts.length) {
    console.error('Shadow parts present in source but missing from docs/styling/anatomy.md:');
    missingParts.forEach((p) => console.error(`  ::part(${p})`));
  }
  if (missingTokens.length) {
    console.error('Design tokens present in source but missing from docs/styling/:');
    missingTokens.forEach((t) => console.error(`  ${t}`));
  }
  process.exit(1);
}
console.log(`styling docs check: clean (${parts.size} parts, ${tokens.size} tokens documented)`);
