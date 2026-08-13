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

/**
 * Does this source file render `control`, or something the control owns?
 *
 * Three forms count, and they are the same ownership rule `controlOwns` applies
 * at runtime: the exact literal testID, a literal built from it (`pricing-ask`
 * owns `pricing-ask-slider`), and a template built from it
 * (`` testID={`bite-run-${id}`} ``).
 */
function rendersControl(src: string, control: string): boolean {
  return (
    src.includes(`testID="${control}"`) ||
    src.includes(`testID="${control}-`) ||
    src.includes(`testID={\`${control}-`)
  );
}

describe('every hint names a control that exists', () => {
  const config = loadHints();

  const places = config.hints.flatMap((h) =>
    h.places.map((p) => [h.id, p.surface, p.control] as const),
  );
  const sources = files.map((f) => fs.readFileSync(f, 'utf8'));

  it.each(places)(
    '%s is taught on %s, at a rendered control (testID %s)',
    (_id, _surface, control) => {
      // The join between a hint and the thing it teaches. A hint whose control
      // is not rendered anywhere teaches nothing — which is precisely why
      // `sourcing_lean` is absent from the catalog rather than declared blind.
      //
      // Both forms count: a literal testID, and a templated one built from the
      // control as its prefix (`bite-run-${id}`, `facility-build-${kind}`) —
      // which is the same ownership rule `controlOwns` applies at runtime.
      expect(sources.some((src) => rendersControl(src, control))).toBe(true);
    },
  );

  // The scan above proves a hint's control exists. This one proves the reverse
  // for the view-only half: a testID declared as "teaches nothing" that nothing
  // renders is a stale declaration, and a stale declaration is how a real
  // control later gets silently absorbed by it.
  it.each(config.viewOnly)('view-only control %s is rendered', (control) => {
    expect(sources.some((src) => rendersControl(src, control))).toBe(true);
  });
});
