import * as fs from 'fs';
import * as path from 'path';

/**
 * No-leak guard (#225 re-skinnability requirement). Kit components must resolve
 * every color through the theme — never a raw hex / rgb literal. This now covers
 * gradient material too (#235): the `gradients` stop arrays live in
 * `src/ui/theme/gradients.ts`, and kit components (Gradient, Surface) reference
 * them by role via `useTheme()` — no literal stops in components. If this rots
 * as later surfaces are added, the single-place re-skin guarantee silently
 * breaks. Color literals are allowed ONLY in `src/ui/theme/` (the role→value
 * map); they are forbidden in `src/ui/kit/`.
 */
const KIT_DIR = path.join(__dirname, '..', 'src', 'ui', 'kit');

// #abc / #aabbcc / #aabbccdd, or rgb()/rgba() function literals.
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\s*\(/g;

function kitFiles(): string[] {
  return fs
    .readdirSync(KIT_DIR)
    .filter((f) => f.endsWith('.tsx') || (f.endsWith('.ts') && f !== 'index.ts'))
    .map((f) => path.join(KIT_DIR, f));
}

/**
 * Surfaces that have been migrated onto the kit (#346 and its successors). A
 * migrated surface reads every color, spacing, radius and typography value
 * through `useTheme()` — it neither writes a color literal nor imports the raw
 * `colors` map. `OwnershipLevers` was the last pre-kit surface anywhere in the
 * app (it built its own StyleSheet off `colors` with literal radii and font
 * sizes, which is why the top and bottom of the Operations tab looked like two
 * different games). Add each newly-migrated surface directory here so it cannot
 * regress; the list only ever grows.
 */
const MIGRATED_SURFACES = [
  'OwnershipLevers',
  'OperationsTab',
  'LotRoom',
  'PeopleTab',
  'GrowthTab',
];

function surfaceFiles(): string[] {
  const uiDir = path.join(__dirname, '..', 'src', 'ui');
  const out: string[] = [];
  for (const surface of MIGRATED_SURFACES) {
    const dir = path.join(uiDir, surface);
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.tsx') || (f.endsWith('.ts') && f !== 'index.ts')) {
        out.push(path.join(dir, f));
      }
    }
  }
  return out;
}

// A raw `colors` import from the theme barrel — the pre-kit pattern. Semantic
// roles arrive through `useTheme()`; the role→value map is never imported
// directly by a surface.
const RAW_COLORS_IMPORT = /import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*'\.\.\/theme'/;

/**
 * Comments are stripped before scanning a surface, because these files cite
 * issues as `#346` — which is a valid 3-digit hex literal to the pattern above.
 * A color written in a comment styles nothing; only code is scanned. (The kit
 * scan above deliberately keeps its stricter whole-file form: kit files spell
 * issue references out as "issue 346" precisely so the raw guard holds.)
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('#225 kit components contain no raw color literals', () => {
  it('finds at least the expected kit files (guard is actually scanning something)', () => {
    expect(kitFiles().length).toBeGreaterThanOrEqual(8);
  });

  it.each(kitFiles())('%s resolves color through the theme only', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    expect(src.match(HEX) ?? []).toEqual([]);
    expect(src.match(RGB) ?? []).toEqual([]);
  });
});

describe('#346 migrated surfaces read theme roles, never raw values', () => {
  it('finds the migrated surface files (guard is actually scanning something)', () => {
    expect(surfaceFiles().length).toBeGreaterThanOrEqual(
      MIGRATED_SURFACES.length,
    );
  });

  it.each(surfaceFiles())('%s resolves color through the theme only', (file) => {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    expect(src.match(HEX) ?? []).toEqual([]);
    expect(src.match(RGB) ?? []).toEqual([]);
    expect(src).not.toMatch(RAW_COLORS_IMPORT);
  });
});
