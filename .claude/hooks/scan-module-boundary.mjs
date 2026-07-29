#!/usr/bin/env node
/**
 * Sweeps src/ and tests/ with the same rule the PreToolUse hook enforces.
 *
 *   node .claude/hooks/scan-module-boundary.mjs          → report violations (exit 1 if any)
 *   node .claude/hooks/scan-module-boundary.mjs --write  → rewrite the allow-list from what exists today
 *
 * The allow-list is the enumerated legacy debt. Regenerating it is a deliberate
 * act: it says "these reach-ins are accepted for now". New ones get blocked at
 * write time instead of accumulating silently.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_DIR } from './lib/hookIo.mjs';
import { findBoundaryViolations } from './lib/moduleBoundary.mjs';

const ALLOW_FILE = path.join(PROJECT_DIR, '.claude', 'hooks', 'module-boundary-allow.json');
// Every tree that consumes the game modules. `.claude/` is excluded on purpose —
// it describes the rule rather than obeying it.
const ROOTS = ['src', 'tests', 'scripts'];
const ROOT_FILES = ['App.tsx', 'index.ts'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const write = process.argv.includes('--write');
const allowList = write ? {} : loadAllowList();

function loadAllowList() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf8'));
    return parsed.allow ?? {};
  } catch {
    return {};
  }
}

const found = {};
let total = 0;

const targets = ROOTS.flatMap((root) => {
  const abs = path.join(PROJECT_DIR, root);
  return fs.existsSync(abs) ? walk(abs) : [];
}).concat(ROOT_FILES.map((f) => path.join(PROJECT_DIR, f)).filter((f) => fs.existsSync(f)));

{
  for (const file of targets) {
    const rel = path.relative(PROJECT_DIR, file).split(path.sep).join('/');
    const violations = findBoundaryViolations({
      filePath: rel,
      content: fs.readFileSync(file, 'utf8'),
      allowList,
    });
    if (violations.length === 0) continue;
    found[rel] = violations.map((v) => v.specifier).sort();
    total += violations.length;
    if (!write) {
      for (const v of violations) {
        console.log(`${rel}: '${v.specifier}' reaches into ${v.targetModule} — import '${v.barrel}'`);
      }
    }
  }
}

if (write) {
  const sorted = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(
    ALLOW_FILE,
    `${JSON.stringify(
      {
        _comment:
          'Enumerated pre-existing module-boundary reach-ins, accepted so the PreToolUse hook blocks NEW debt without blocking edits to files that already carry old debt. Regenerate with: node .claude/hooks/scan-module-boundary.mjs --write. Shrinking this file is always an improvement.',
        allow: sorted,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${ALLOW_FILE} — ${total} accepted reach-in(s) across ${Object.keys(sorted).length} file(s).`);
  process.exit(0);
}

if (total > 0) {
  console.log(`\n${total} un-allowed module-boundary violation(s).`);
  process.exit(1);
}
console.log('No module-boundary violations outside the allow-list.');
