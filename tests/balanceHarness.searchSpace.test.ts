/**
 * #344 — the tunable manifest and the frozen-key guard.
 *
 * The manifest declares the surface a balance search is allowed to touch. The
 * guard is what makes "keys not listed are frozen" a checkable claim instead of
 * a trusted one: every registered data file is serialized before, during, and
 * after a candidate is applied, and the diff must name exactly the manifest
 * paths the candidate varied.
 *
 * Two of these tests are about the plumbing rather than the manifest, and both
 * earn their keep. The manifest walk runs against the REAL data files, so a
 * renamed key fails the build rather than silently freezing a dimension the
 * search believes it is varying. And the loader test proves the in-place
 * mutation is actually observed by the game's loaders for each newly registered
 * file — a registry entry that mutates an object nothing reads would pass every
 * other test in this file while making the search a no-op.
 */
import { loadTierGateConfig } from '../src/game/TierGate';
import { loadTunables } from '../src/game/data';
import { loadIntelPrecisionConfig, loadSourcingConfig } from '../src/game/MarketEconomy';
import { loadStartingInventoryConfig } from '../src/game/Inventory';
import { loadCollisionStreamConfig } from '../src/game/CollisionStream';
import { loadServiceManagerConfig } from '../src/game/ServiceDispatch';
import { loadNewsGatingConfig } from '../src/game/MarketIntel';
import { loadBodyShopManagerConfig } from '../src/bodyShopManagerConfig';
import { knownFiles, positionalPath, readTunable } from '../scripts/balance-harness/overrides';
import {
  SEARCH_SPACE,
  allowsValue,
  applyCandidate,
  canonicalPath,
  currentValue,
  describeSpace,
  diffSnapshots,
  snapshotRegisteredFiles,
  validateSearchSpace,
  type Candidate,
  type Dimension,
} from '../scripts/balance-harness/searchSpace';
import { OUTSIDE_BOUND_FLAG, formatSearchSpace } from '../scripts/balance-harness/reports';

/** A candidate that moves one dimension in every registered file at once. */
const MULTI_FILE_CANDIDATE: Candidate = {
  'gate.t1.units': 10,
  'ucm.act.pricing': 70,
  'sourcing.buyThreshold': 0.6,
  'intel.sharp.suggestionBandPct': 0.02,
  'bodyshop.channel.insuranceRateCap': 0.7,
  'news.auctionData.dailyCost': 60,
  'serviceManager.par.targetCoverDays': 2.5,
  'bodyShopManager.capacity.utilizationRushCeiling': 0.7,
  'startingInventory.suv.targetRetail': 19000,
};

function dim(id: string): Dimension {
  const found = SEARCH_SPACE.find((d) => d.id === id);
  if (!found) throw new Error(`test refers to a dimension that no longer exists: ${id}`);
  return found;
}

describe('#344 the tunable manifest resolves against the live data files', () => {
  it('validates clean against data/**', () => {
    expect(() => validateSearchSpace()).not.toThrow();
  });

  it('resolves every declared dimension to a number in its named file', () => {
    for (const d of SEARCH_SPACE) {
      expect(knownFiles()).toContain(d.file);
      expect(typeof readTunable(d.file, d.path)).toBe('number');
      expect(Number.isFinite(currentValue(d))).toBe(true);
    }
  });

  it('declares unique ids and a why-note on every dimension', () => {
    const ids = SEARCH_SPACE.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of SEARCH_SPACE) expect(d.why.trim().length).toBeGreaterThan(0);
  });

  it('addresses array entries by identity, not position', () => {
    // The auction feed is the first unlock today; a reorder must not silently
    // repoint the dimension at competitor tracking.
    const unlocks = loadNewsGatingConfig().unlocks;
    const auction = unlocks.find((u) => u.id === 'auction_data');
    expect(currentValue(dim('news.auctionData.dailyCost'))).toBe(auction?.dailyCost);
    expect(positionalPath('news-progression-gating', 'unlocks[id=auction_data].dailyCost')).toBe(
      `unlocks.${unlocks.indexOf(auction!)}.dailyCost`,
    );
  });

  it('flags no shipped value sitting outside its own declared bound', () => {
    // Not cosmetic: a current value outside its range means either the range or
    // the shipped number is wrong, and a search would start from a point it
    // would itself refuse to propose.
    const outside = describeSpace().filter((r) => r.outsideBound);
    expect(outside.map((r) => `${r.id} current=${r.current} bound=${r.bound}`)).toEqual([]);
  });
});

describe('#344 the frozen-key guard', () => {
  it('leaves every registered file byte-identical after apply → restore', () => {
    const before = snapshotRegisteredFiles();
    const applied = applyCandidate(MULTI_FILE_CANDIDATE);
    applied.restore();
    const after = snapshotRegisteredFiles();

    for (const file of knownFiles()) {
      expect(after[file]).toBe(before[file]);
    }
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it('moves exactly the manifest paths the candidate varied, and nothing else', () => {
    const before = snapshotRegisteredFiles();
    const applied = applyCandidate(MULTI_FILE_CANDIDATE);
    const during = snapshotRegisteredFiles();
    const moved = diffSnapshots(before, during);
    applied.restore();

    const expected = Object.keys(MULTI_FILE_CANDIDATE).map((id) => canonicalPath(dim(id)));
    expect([...moved].sort()).toEqual([...expected].sort());
  });

  it('touches every registered file the candidate names', () => {
    const files = new Set(Object.keys(MULTI_FILE_CANDIDATE).map((id) => dim(id).file));
    expect([...files].sort()).toEqual([...knownFiles()].sort());
  });

  it('is observed by the loaders — the mutation is live, not just in the registry', () => {
    const applied = applyCandidate(MULTI_FILE_CANDIDATE);
    try {
      expect(loadTierGateConfig().tiers['1'].units).toBe(10);
      expect(loadTunables().managerGates.actThresholds.pricing).toBe(70);
      expect(loadSourcingConfig().buyThreshold).toBe(0.6);
      expect(loadIntelPrecisionConfig().sharp.suggestionBandPct).toBe(0.02);
      expect(loadCollisionStreamConfig().channel.insuranceRateCap).toBe(0.7);
      expect(loadNewsGatingConfig().unlocks.find((u) => u.id === 'auction_data')?.dailyCost).toBe(
        60,
      );
      expect(loadServiceManagerConfig().par.targetCoverDays).toBe(2.5);
      expect(loadBodyShopManagerConfig().capacity.utilizationRushCeiling).toBe(0.7);
      expect(
        loadStartingInventoryConfig().slots.find((s) => s.category === 'suv')?.targetRetail,
      ).toBe(19000);
    } finally {
      applied.restore();
    }
    expect(loadSourcingConfig().buyThreshold).toBe(currentValue(dim('sourcing.buyThreshold')));
  });
});

describe('#344 a malformed dimension fails loudly with its own id', () => {
  const base = {
    file: 'tunables',
    why: 'synthetic fixture',
    range: { min: 0, max: 100, step: 5 },
  } as const;

  it('rejects a path that does not resolve', () => {
    expect(() =>
      validateSearchSpace([{ ...base, id: 'typo.dim', path: 'managerGates.actThresholds.nope' }]),
    ).toThrow(/typo\.dim/);
  });

  it('rejects a path that resolves to something other than a number', () => {
    expect(() =>
      validateSearchSpace([
        {
          ...base,
          id: 'nonnumeric.dim',
          file: 'intel-precision',
          path: 'coarse.heatGranularity',
        },
      ]),
    ).toThrow(/nonnumeric\.dim.*not a number/s);
  });

  it('rejects a step larger than its own range', () => {
    expect(() =>
      validateSearchSpace([
        {
          ...base,
          id: 'coarse.dim',
          path: 'managerGates.actThresholds.pricing',
          range: { min: 40, max: 50, step: 25 },
        },
      ]),
    ).toThrow(/coarse\.dim.*larger than its own range/s);
  });

  it('rejects a dimension declaring both or neither of range and values', () => {
    const path = 'managerGates.actThresholds.pricing';
    expect(() =>
      validateSearchSpace([{ ...base, id: 'both.dim', path, values: [1, 2] }]),
    ).toThrow(/both\.dim/);
    expect(() =>
      validateSearchSpace([{ id: 'neither.dim', file: 'tunables', path, why: 'x' }]),
    ).toThrow(/neither\.dim/);
  });

  it('rejects a duplicate dimension id', () => {
    const d = { ...base, id: 'dupe.dim', path: 'managerGates.actThresholds.pricing' };
    expect(() => validateSearchSpace([d, d])).toThrow(/dupe\.dim.*duplicate/s);
  });
});

describe('#344 an illegal value is rejected, never clamped', () => {
  it('rejects a value outside a declared range and leaves the file unchanged', () => {
    const before = snapshotRegisteredFiles();
    expect(() => applyCandidate({ 'gate.t1.units': 99 })).toThrow(/rejected, not clamped/);
    expect(snapshotRegisteredFiles()).toEqual(before);
    expect(currentValue(dim('gate.t1.units'))).toBe(JSON.parse(before['tier-gate']).tiers['1'].units);
  });

  it('rejects a value outside a declared discrete set', () => {
    const discrete = dim('inventory.inspection.daysToComplete');
    expect(allowsValue(discrete, 2)).toBe(true);
    expect(allowsValue(discrete, 1.5)).toBe(false);
    const before = snapshotRegisteredFiles();
    expect(() => applyCandidate({ [discrete.id]: 1.5 })).toThrow(/rejected, not clamped/);
    expect(snapshotRegisteredFiles()).toEqual(before);
  });

  it('rejects an unknown dimension id', () => {
    expect(() => applyCandidate({ 'no.such.dim': 1 })).toThrow(/no\.such\.dim/);
  });

  it('applies nothing at all when any one value in the candidate is illegal', () => {
    // Validate-the-whole-candidate-then-apply: a partially applied candidate
    // would leave data/** in a state no one asked for.
    const before = snapshotRegisteredFiles();
    expect(() =>
      applyCandidate({ 'gate.t1.units': 10, 'sourcing.buyThreshold': 9 }),
    ).toThrow(/sourcing\.buyThreshold/);
    expect(snapshotRegisteredFiles()).toEqual(before);
  });
});

describe('#344 the space report', () => {
  it('reports every dimension with its declared bound and current value', () => {
    const report = formatSearchSpace(describeSpace());
    for (const d of SEARCH_SPACE) {
      expect(report).toContain(d.id);
      expect(report).toContain(d.path);
      const bound = d.values
        ? `{${d.values.join(', ')}}`
        : `[${d.range!.min}, ${d.range!.max}] step ${d.range!.step}`;
      expect(report).toContain(bound);
      expect(report).toContain(`current=${currentValue(d)}`);
    }
  });

  it('flags a current value that sits outside its own declared bound', () => {
    const narrowed: Dimension[] = [
      {
        id: 'narrowed.dim',
        file: 'tunables',
        path: 'managerGates.actThresholds.pricing',
        why: 'synthetic fixture',
        range: { min: 0, max: 1, step: 0.1 },
      },
    ];
    const rows = describeSpace(narrowed);
    expect(rows[0].outsideBound).toBe(true);
    expect(formatSearchSpace(rows)).toContain(OUTSIDE_BOUND_FLAG);
  });
});
