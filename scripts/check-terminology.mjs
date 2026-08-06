// ARCHITECTURE §19: the legacy term for a result record is banned everywhere.
// Sole allowlisted file: the adapter, where the raw API wire field is renamed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const BANNED = /\bhits?\b/i;
const SCAN_DIRS = ['packages/core/src', 'packages/components/src', 'playground', 'e2e', 'docs'];
const ALLOWLIST = new Set([
  'packages/core/src/client/sparqClient.ts',
  // Second wire seam (ARCHITECTURE §20): the insights event payloads reuse the
  // st-tracking wire field `totalHits` for analytics-js compatibility.
  'packages/core/src/insights/insights.ts',
]);
const EXTENSIONS = new Set(['.ts', '.vue', '.js', '.mjs', '.html', '.css', '.md']);

const violations = [];

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      scan(full);
      continue;
    }
    if (![...EXTENSIONS].some((ext) => entry.endsWith(ext))) continue;
    const rel = relative(root, full);
    if (ALLOWLIST.has(rel)) continue;
    const lines = readFileSync(full, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      if (BANNED.test(line)) violations.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
}

for (const dir of SCAN_DIRS) scan(join(root, dir));

if (violations.length > 0) {
  console.error('Banned terminology found (use "item(s)" — see ARCHITECTURE.md §19):\n');
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}
console.log('terminology check: clean');
