import * as fs from 'fs';
import * as path from 'path';

/**
 * #387 no-leak guard, in the `tests/kit.noleak.test.ts` idiom.
 *
 * `money` / `compactMoney` / `grouped` on the kit barrel are the app's one
 * number-formatting surface. What this scan actually prevents is not a wrong
 * string — it is a **fourth formatter born at a call site**, which is how the
 * app ended up with nine of them: five hand-rolled `money`/`dollars`/`fmt$`
 * helpers, two different sign glyphs, and a dozen inline
 * `` `$${n.toLocaleString()}` `` templates that had quietly diverged on
 * rounding.
 *
 * Three patterns are forbidden under `src/ui/**` (outside the kit) and
 * `src/app/**`:
 *
 *  - `toLocaleString` — the guard is absolute rather than currency-only,
 *    because the defect it protects against is a property of the *grouping*.
 *    Hermes ships without full `Intl`, so `toLocaleString('en-US')` renders an
 *    ungrouped run of digits on the platforms the game ships to while reading
 *    correctly on the web target an agent drives. `grouped()` exists so the
 *    non-currency counts (odometers) have a home inside the rule.
 *  - `` $${ `` — a currency symbol jammed in front of an interpolation.
 *  - hand-rolled thousands grouping — the `\B(?=(\d{3})+(?!\d))` regex, which
 *    is exactly what a call site writes once it knows `toLocaleString` is out.
 *
 * `src/game/**` is deliberately NOT scanned. Game logic is fully separable from
 * UI and may not import from `src/ui/**`, so the engine physically cannot reach
 * this barrel; the few strings it formats itself (HistoryLog, the trade
 * rationale, the playtest export) are engine copy, and consolidating them is a
 * question about where game-owned display strings live, not about this rule.
 */

const SRC = path.join(__dirname, '..', 'src');
const KIT = path.join(SRC, 'ui', 'kit');

const SCANNED_ROOTS = [path.join(SRC, 'ui'), path.join(SRC, 'app')];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Comments are stripped first. A comment that *names* a forbidden pattern is
 * documentation, not formatting — and this file's own rationale, plus the
 * `money.ts` header that explains the Hermes gap, both cite `toLocaleString` by
 * name. Exempting files instead of stripping comments is how a scan stops
 * guarding anything.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const FORBIDDEN: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  {
    pattern: /toLocaleString/,
    why: 'formats a number itself — use money / compactMoney / grouped from the kit barrel',
  },
  {
    pattern: /\$\$\{/,
    why: 'jams a currency symbol in front of an interpolation — use money() or compactMoney()',
  },
  {
    pattern: /\\B\(\?=\(\\d\{3\}\)/,
    why: 'hand-rolls thousands grouping — the kit already does it, without Intl',
  },
];

function scannedFiles(): string[] {
  return SCANNED_ROOTS.flatMap(walk).filter((f) => !f.startsWith(KIT + path.sep));
}

describe('#387 the kit owns number formatting; no call site rolls its own', () => {
  it('finds the surface files (the guard is actually scanning something)', () => {
    expect(scannedFiles().length).toBeGreaterThan(100);
  });

  it('no file under src/ui or src/app formats a number itself', () => {
    const offenders: string[] = [];
    for (const file of scannedFiles()) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      const lines = src.split('\n');
      for (const { pattern, why } of FORBIDDEN) {
        lines.forEach((line, i) => {
          if (pattern.test(line)) {
            offenders.push(
              `${path.relative(SRC, file).replace(/\\/g, '/')}:${i + 1} — ${why}`,
            );
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the kit is where the formatters actually live', () => {
    const barrel = fs.readFileSync(path.join(KIT, 'index.ts'), 'utf8');
    expect(barrel).toMatch(/export \{ money, compactMoney, grouped \} from '\.\/money'/);
    // And nothing re-exports them from a surface module, which is what made
    // GrowthTab and OwnershipLevers import a *Finance* model file for a string
    // formatter before this slice.
    const financeBarrel = fs.readFileSync(
      path.join(SRC, 'ui', 'FinanceTab', 'index.ts'),
      'utf8',
    );
    expect(financeBarrel).not.toMatch(/\bcompactMoney\b/);
    expect(financeBarrel).not.toMatch(/^\s*money,\s*$/m);
  });
});
