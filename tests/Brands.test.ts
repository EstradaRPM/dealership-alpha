import fs from 'fs';
import path from 'path';
import {
  loadBrands,
  loadBrandsFile,
  brandIds,
  brandLabel,
  assertKnownBrands,
  BrandEntrySchema,
  BrandsFileSchema,
} from '../src/game/Brands';
import { DataValidationError, parseData } from '../src/game/data';
import { loadVehicleData } from '../src/game/Inventory';
import { loadCustomerCurrentVehicleConfig } from '../src/game/NPC';

/**
 * The canonical Brand entity (#246).
 *
 * The ship-blocker this closes: `data/` carried real vehicle trademarks, and the
 * name a player saw came from a `make` field copied onto every vehicle template
 * — so a brand was named in as many places as there were cars. The brand is now
 * one entity with an opaque `id` (the join key, and what saves persist) and a
 * `label` (the only brand string a player ever reads).
 */

const VALID_SPACED_LEAN = {
  safety: 0.5,
  performance: 0.5,
  appearance: 0.5,
  comfort: 0.5,
  economy: 0.5,
  dependability: 0.5,
};

const VALID_ENTRY = {
  id: 'corden',
  label: 'Corden',
  segment_affinity: { truck: 0.9 },
  market_draw: 0.18,
  spaced_lean: VALID_SPACED_LEAN,
};

describe('the Brand entity', () => {
  it('accepts a well-formed entry', () => {
    expect(() => BrandEntrySchema.parse(VALID_ENTRY)).not.toThrow();
  });

  it.each([
    ['no id', { ...VALID_ENTRY, id: '' }],
    ['no label', { ...VALID_ENTRY, label: '' }],
    ['an affinity above 1', { ...VALID_ENTRY, segment_affinity: { truck: 2 } }],
    ['a market draw above 1', { ...VALID_ENTRY, market_draw: 1.5 }],
    ['a negative market draw', { ...VALID_ENTRY, market_draw: -0.1 }],
    [
      'a spaced-lean axis out of range',
      { ...VALID_ENTRY, spaced_lean: { ...VALID_SPACED_LEAN, safety: 1.4 } },
    ],
    ['a missing spaced-lean axis', { ...VALID_ENTRY, spaced_lean: { safety: 0.5 } }],
    ['an undeclared field', { ...VALID_ENTRY, tagline: 'Built tough' }],
  ])('refuses an entry with %s', (_why, entry) => {
    expect(() => BrandEntrySchema.parse(entry)).toThrow();
  });

  it('refuses two brands sharing one id', () => {
    const file = { schemaVersion: 2, brands: [VALID_ENTRY, { ...VALID_ENTRY, label: 'Other' }] };
    expect(() => BrandsFileSchema.parse(file)).toThrow();
  });

  it('refuses two brands sharing one display name', () => {
    // Indistinguishable on screen while behaving differently — the one failure a
    // label-as-property design can still produce.
    const file = { schemaVersion: 2, brands: [VALID_ENTRY, { ...VALID_ENTRY, id: 'other' }] };
    expect(() => BrandsFileSchema.parse(file)).toThrow();
  });

  it('throws DataValidationError on a malformed catalog', () => {
    expect(() =>
      parseData({ schemaVersion: 2, brands: [{ id: 'x' }] }, BrandsFileSchema, 'test'),
    ).toThrow(DataValidationError);
  });
});

describe('the shipped catalog', () => {
  const catalog = loadBrands();
  const file = loadBrandsFile();

  it('is indexed by id, and every entry knows its own id', () => {
    expect(Object.keys(catalog).length).toBe(file.brands.length);
    for (const [id, entry] of Object.entries(catalog)) expect(entry.id).toBe(id);
  });

  it('gives every brand a display name that is not its id', () => {
    // The whole point of the split: the join key and the name are different
    // strings, so relabelling is a catalog edit and never a migration.
    for (const entry of file.brands) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.label).not.toBe(entry.id);
    }
  });

  it('keeps every weight inside its band', () => {
    for (const entry of Object.values(catalog)) {
      expect(entry.market_draw).toBeGreaterThanOrEqual(0);
      expect(entry.market_draw).toBeLessThanOrEqual(1);
      expect(Object.keys(entry.segment_affinity).length).toBeGreaterThan(0);
      for (const v of Object.values(entry.segment_affinity)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      for (const v of Object.values(entry.spaced_lean)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('names a brand it knows, and falls back to the id for one it does not', () => {
    const [first] = brandIds();
    expect(brandLabel(first)).toBe(catalog[first].label);
    // The right failure for a NAME: a retired brand in an old save still renders
    // something a human can read and report, where a throw would end the career.
    expect(brandLabel('brand-that-left-the-catalog')).toBe('brand-that-left-the-catalog');
  });

  it('names the offending id when a file references a brand nobody declares', () => {
    expect(() => assertKnownBrands(['corden', 'nosuchbrand'], 'data/test.json')).toThrow(
      /nosuchbrand/,
    );
    expect(() => assertKnownBrands(brandIds(), 'data/test.json')).not.toThrow();
  });
});

describe('every catalog that joins on a brand references a declared one', () => {
  // The check the loaders run at load, restated here so a broken join is named
  // by this suite rather than by whichever unrelated test happened to boot a
  // World first.
  const declared = new Set(brandIds());

  it('data/vehicles.json', () => {
    for (const t of loadVehicleData().templates) expect(declared.has(t.brand)).toBe(true);
  });

  it('data/customer-current-vehicle.json', () => {
    for (const t of Object.values(loadCustomerCurrentVehicleConfig().templates)) {
      expect(declared.has(t.brand)).toBe(true);
    }
  });

  it.each(['brand-market-share.json', 'brand-tiers.json'])('data/%s', (name) => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', name), 'utf8'),
    ) as Record<string, unknown>;
    const brands = (name === 'brand-tiers.json' ? raw.brands : raw) as Record<string, unknown>;
    for (const id of Object.keys(brands)) expect(declared.has(id)).toBe(true);
  });

  it.each(['competitors.json', 'competitor-archetypes.json'])('data/%s', (name) => {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', name), 'utf8'),
    );
    const rows = (Array.isArray(raw) ? raw : Object.values(raw as object).flat()) as {
      brand?: string;
      brand_id?: string;
    }[];
    const used = rows.map((r) => r.brand ?? r.brand_id).filter(Boolean) as string[];
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(declared.has(id)).toBe(true);
  });
});

describe('#246 the release gate: no real vehicle trademark under data/', () => {
  const DATA = path.join(__dirname, '..', 'data');

  function jsonFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...jsonFiles(full));
      else if (entry.name.endsWith('.json')) out.push(full);
    }
    return out;
  }

  /**
   * Marks and model names that must never appear in shipped data. Word-boundary
   * matched and case-insensitive, so `Ford` is caught and `afford` is not.
   *
   * This is the guard the whole slice exists to install: the data was swept once,
   * and without a scan the next catalog someone hand-writes puts a trademark
   * straight back. A brand added later belongs in `data/brands.json` with a
   * fictional label, never as a real marque.
   */
  const TRADEMARKS = [
    // marques
    'chevrolet', 'chevy', 'ford', 'honda', 'jeep', 'nissan', 'toyota', 'hyundai',
    'kia', 'subaru', 'mazda', 'bmw', 'mercedes', 'audi', 'lexus', 'acura',
    'volkswagen', 'tesla', 'gmc', 'dodge', 'chrysler', 'buick', 'cadillac',
    'infiniti', 'volvo', 'porsche', 'mitsubishi', 'genesis', 'lincoln',
    // model names the sweep removed
    'civic', 'camry', 'silverado', 'rav4', 'cr-v', 'equinox', 'altima',
    'cherokee', 'tacoma', 'sonata', 'mdx',
  ];

  /**
   * The auction houses are the same class of exposure and their DISPLAY names
   * were swept with the brands. Their `id`s were deliberately left alone:
   * `rollAuctionSourceReliability` seeds each source's hidden per-save
   * reliability from `deriveSeed(masterSeed, ..., { sourceId })`, so renaming one
   * re-rolls every listing's price spread and moves the #180 calibration band
   * (measured: costOverAsk 1.026 -> 1.103). Only the label is scanned, which is
   * the half a player reads. Renaming the ids is a C2 re-measure, filed separately.
   */
  const TRADEMARK_LABELS = ['Manheim', 'ADESA'];

  const files = jsonFiles(DATA);

  it('the scan sees the data tree it is meant to sweep', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files.map((f) => [path.relative(DATA, f), f] as const))(
    'data/%s names no real marque',
    (_rel, file) => {
      const text = fs.readFileSync(file, 'utf8');
      const hits = TRADEMARKS.filter((t) =>
        new RegExp(`\\b${t.replace('-', '\\-')}\\b`, 'i').test(text),
      );
      expect(hits).toEqual([]);
    },
  );
});
