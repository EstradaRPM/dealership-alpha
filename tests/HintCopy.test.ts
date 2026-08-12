import * as fs from 'fs';
import * as path from 'path';
import { loadHints, HINT_IDS } from '../src/app/hints';

/**
 * Hint copy is DATA (#386, ruling D3-R2). Every string a hint says lives in
 * `data/hints.json` and reaches a component as a resolved prop — never as a
 * literal in the component itself. Same idiom as `tests/kit.noleak.test.ts`:
 * one named failure per offending file, and a sanity assertion first so a scan
 * that has stopped scanning anything fails loudly.
 */
const SRC = path.join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC).filter((f) => !/\.test\.tsx?$/.test(f));

describe('hint copy is data, never a literal under src/', () => {
  const config = loadHints();

  it('finds the source tree (guard is actually scanning something)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('the catalog validates and declares every id', () => {
    expect(config.hints.map((h) => h.id).sort()).toEqual([...HINT_IDS].sort());
  });

  // A distinctive fragment of each hint, long enough that a match is the copy
  // itself rather than an ordinary English collocation.
  const fragments = config.hints.map((h) => ({
    id: h.id,
    fragment: h.text.slice(0, 40),
  }));

  it.each(files)('%s contains no hint copy', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    const leaked = fragments
      .filter(({ fragment }) => src.includes(fragment))
      .map(({ id }) => id);
    expect(leaked).toEqual([]);
  });
});

describe('every hint names a control that exists', () => {
  const config = loadHints();

  it.each(config.hints.map((h) => [h.id, h.control] as const))(
    '%s points at a rendered control (testID %s)',
    (_id, control) => {
      // The join between a hint and the thing it teaches. A hint whose control
      // is not rendered anywhere teaches nothing — which is precisely why
      // `sourcing_lean` is absent from the catalog rather than declared blind.
      const mounted = files.some((f) =>
        fs.readFileSync(f, 'utf8').includes(`testID="${control}"`),
      );
      expect(mounted).toBe(true);
    },
  );
});
