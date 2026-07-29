/**
 * The module-boundary rule, as executable code.
 *
 * Root CLAUDE.md: every module lives at `src/game/<Module>/` and exposes its
 * public surface only through `index.ts`. Consumers import the directory (the
 * barrel), never a file inside it. Anything not re-exported is private.
 *
 * That rule used to be prose ending in "no lint rule enforces this". This module
 * is the enforcement: given the path being written and its new content, it
 * returns every import that reaches past another module's barrel.
 *
 * Pure — no fs, no process. `scan.mjs` and the PreToolUse hook both drive it.
 */

const MODULE_PARENT = 'src/game';

const SPECIFIER_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g, // import … from 'x' / export … from 'x'
  /\bimport\s+['"]([^'"]+)['"]/g, // side-effect import 'x'
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('x')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require('x')
  /\bjest\.mock\s*\(\s*['"]([^'"]+)['"]/g, // jest.mock('x')
];

/** Every module specifier referenced by a chunk of TS/JS source. */
export function extractSpecifiers(content) {
  const found = new Set();
  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) found.add(match[1]);
  }
  return [...found];
}

/** POSIX path.normalize for repo-relative paths (no fs, no platform separators). */
function normalize(p) {
  const out = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function dirname(p) {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

function stripExtension(p) {
  return p.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');
}

/**
 * Repo-relative POSIX target of a specifier, or null when it is a bare package
 * name (`react`, `zod`, …) that can't cross a module boundary.
 */
export function resolveSpecifier(importerRel, specifier) {
  if (specifier.startsWith('@/')) return normalize(`src/${specifier.slice(2)}`);
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return normalize(`${dirname(importerRel)}/${specifier}`);
  }
  return null;
}

/** The module a repo-relative path belongs to (`src/game/NPC/Rng.ts` → `NPC`), or null. */
export function moduleOf(repoRelPath) {
  const match = new RegExp(`^${MODULE_PARENT}/([^/]+)(?:/|$)`).exec(repoRelPath);
  return match ? match[1] : null;
}

/**
 * Violations introduced by writing `content` to `filePath`.
 *
 * Allowed: bare packages, anything outside `src/game/`, a module's own internals
 * from inside that module, and the barrel of any module (`.../Mod` or
 * `.../Mod/index`). Everything else reaches into private surface.
 *
 * `allowList` is `{ "<importer repo path>": ["<specifier>", …] }` — the enumerated
 * pre-existing exceptions, so the hook blocks *new* debt without blocking edits
 * to files that already carry old debt.
 */
export function findBoundaryViolations({ filePath, content, allowList = {} }) {
  if (!filePath || !/\.(tsx?|jsx?|mjs|cjs)$/.test(filePath)) return [];
  const importerModule = moduleOf(filePath);
  const allowed = new Set(allowList[filePath] ?? []);
  const violations = [];

  for (const specifier of extractSpecifiers(content)) {
    if (allowed.has(specifier)) continue;
    const resolved = resolveSpecifier(filePath, specifier);
    if (resolved === null) continue;

    const targetModule = moduleOf(resolved);
    if (targetModule === null) continue; // not inside src/game/<Module>/
    if (targetModule === importerModule) continue; // a module may read its own internals

    const withoutExt = stripExtension(resolved);
    const isBarrel =
      withoutExt === `${MODULE_PARENT}/${targetModule}` ||
      withoutExt === `${MODULE_PARENT}/${targetModule}/index`;
    if (isBarrel) continue;

    violations.push({
      specifier,
      resolved,
      targetModule,
      barrel: `${MODULE_PARENT}/${targetModule}/index.ts`,
    });
  }

  return violations;
}
