import * as fs from 'fs';
import * as path from 'path';

/**
 * Guards the path-scoped rule files (#336).
 *
 * `.claude/rules/*.md` is loaded by Claude Code, not by the app, so nothing else in
 * the build would notice these rotting. Three things can rot, and all three defeat
 * the reason the directory exists:
 *
 *  - a rule with no `paths:` frontmatter loads into EVERY session, which is the
 *    always-on context cost the scoping was meant to remove;
 *  - a rule scoped to a path that no longer exists is dead weight that never fires;
 *  - a rule that points at a doc which has since moved sends the next agent nowhere.
 *
 * See `.claude/rules/meta-rules.md`.
 */
const REPO_ROOT = path.join(__dirname, '..');
const RULES_DIR = path.join(REPO_ROOT, '.claude', 'rules');

function ruleFiles(): string[] {
  return fs
    .readdirSync(RULES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(RULES_DIR, f));
}

/** Minimal frontmatter reader — enough for the `paths:` key, no YAML dependency. */
function readPaths(file: string): string[] | null {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  const close = lines.indexOf('---', 1);
  if (close === -1) return null;

  const block = lines.slice(1, close);
  const at = block.findIndex((l) => /^paths\s*:/.test(l));
  if (at === -1) return null;

  const raw = block[at].replace(/^paths\s*:/, '').trim();
  if (raw.startsWith('[')) return JSON.parse(raw) as string[];
  if (raw.length > 0) return raw.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));

  // YAML block list: `paths:` followed by `- pattern` lines.
  const items: string[] = [];
  for (const line of block.slice(at + 1)) {
    const m = /^\s*-\s*(.+)$/.exec(line);
    if (!m) break;
    items.push(m[1].trim().replace(/^["']|["']$/g, ''));
  }
  return items;
}

/** The literal directory/file prefix of a glob — everything before the first glob char. */
function globPrefix(pattern: string): string {
  const cut = pattern.search(/[*?[{]/);
  const head = cut === -1 ? pattern : pattern.slice(0, cut);
  return head.replace(/\/+$/, '');
}

/**
 * Repo paths a rule body points at, taken from backticked spans. Placeholders
 * (`src/game/<Module>/CLAUDE.md`) and glob patterns are skipped — only concrete
 * paths under a known top-level directory are checked.
 */
const TOP_LEVEL = /^(src|docs|data|tests|scripts|\.claude|\.github)\//;
function referencedPaths(file: string): string[] {
  const body = fs.readFileSync(file, 'utf8');
  const spans = body.match(/`[^`\n]+`/g) ?? [];
  return [
    ...new Set(
      spans
        .map((s) => s.slice(1, -1).trim())
        .filter((s) => TOP_LEVEL.test(s))
        .filter((s) => !/[<>*?{}\s'"]/.test(s)),
    ),
  ];
}

const files = ruleFiles();

describe('#336 path-scoped rule files', () => {
  it('finds the rule files (the guard is actually scanning something)', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(files)('%s is scoped — it carries non-empty paths: frontmatter', (file) => {
    const paths = readPaths(file);
    expect(paths).not.toBeNull();
    expect(paths!.length).toBeGreaterThan(0);
    // `**` would match everything, i.e. an always-loaded rule wearing a scope.
    expect(paths!.every((p) => p !== '**' && p.length > 0)).toBe(true);
  });

  it.each(files)('%s scopes to paths that exist in the repo', (file) => {
    for (const pattern of readPaths(file) ?? []) {
      const prefix = globPrefix(pattern);
      expect(prefix.length).toBeGreaterThan(0);
      expect({ pattern, exists: fs.existsSync(path.join(REPO_ROOT, prefix)) }).toEqual({
        pattern,
        exists: true,
      });
    }
  });

  it.each(files)('%s only points at repo docs that exist', (file) => {
    for (const ref of referencedPaths(file)) {
      expect({ ref, exists: fs.existsSync(path.join(REPO_ROOT, ref)) }).toEqual({
        ref,
        exists: true,
      });
    }
  });
});
