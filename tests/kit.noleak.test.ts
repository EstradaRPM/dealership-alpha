import * as fs from 'fs';
import * as path from 'path';

/**
 * No-leak guard (#225 re-skinnability requirement). Kit components must resolve
 * every color through the theme — never a raw hex / rgb literal. If this rots
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

describe('#225 kit components contain no raw color literals', () => {
  it('finds at least the expected kit files (guard is actually scanning something)', () => {
    expect(kitFiles().length).toBeGreaterThanOrEqual(7);
  });

  it.each(kitFiles())('%s resolves color through the theme only', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    expect(src.match(HEX) ?? []).toEqual([]);
    expect(src.match(RGB) ?? []).toEqual([]);
  });
});
