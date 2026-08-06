import { createEventBus } from '../src/game/EventBus';
import {
  createFacility,
  createDefaultFacilitySnapshot,
  loadFacilityData,
  ceilingsAtTier,
  FacilityDataSchema,
  MAX_TIER,
  type FacilityDataTable,
} from '../src/game/Facility';
import { readOnlyFacility } from './helpers/facility';

// A small stand-in table so the behavior tests state the numbers they mean
// rather than depending on today's balance. The shipped file is exercised
// separately below.
const DATA: FacilityDataTable = {
  lotSpaces: { '1': 6, '2': 12, '3': 35, '4': 75, '5': 120, '6': 120, '7': 120 },
  serviceBays: { '1': 2, '2': 4, '3': 6, '4': 6, '5': 6, '6': 6, '7': 6 },
  bodyBays: { '1': 0, '2': 0, '3': 3, '4': 5, '5': 7, '6': 7, '7': 7 },
  construction: {
    lotSpaces: { blockSize: 5, unitCost: 1_000, days: 2 },
    serviceBays: { blockSize: 1, unitCost: 20_000, days: 3 },
    bodyBays: { blockSize: 1, unitCost: 30_000, days: 4 },
  },
};

function facilityAt(tier: { current: number }) {
  return readOnlyFacility(() => tier.current, DATA);
}

/**
 * A world just big enough to buy a building in: a bus, a wallet, a day cursor.
 * Seeded at `builtAtTier` and then stood at `tier`, which is the only state a
 * store is ever in when it has room to build — you arrive at a new tier holding
 * what you built at the last one.
 */
function siteAt(opts: { builtAtTier?: number; tier?: number; cash?: number; day?: number } = {}) {
  const bus = createEventBus();
  const tier = { current: opts.builtAtTier ?? 1 };
  const day = { current: opts.day ?? 10 };
  let cash = opts.cash ?? 1_000_000;
  const spends: { amount: number; label: string }[] = [];
  const facility = createFacility({
    bus,
    getTier: () => tier.current,
    economy: {
      get cash() {
        return cash;
      },
      postExpense(amount, label) {
        cash -= amount;
        spends.push({ amount, label });
      },
    },
    getCurrentDay: () => day.current,
    data: DATA,
  });
  // Built capacity is captured at construction; the tier then moves and only
  // the ceiling follows it.
  tier.current = opts.tier ?? 3;
  return {
    bus,
    facility,
    tier,
    spends,
    cash: () => cash,
    /** Advance to a morning, the phase construction settles on. */
    morning(to: number) {
      day.current = to;
      bus.publish('clock:day_started', { day: to });
    },
    optionFor(kind: 'lotSpaces' | 'serviceBays' | 'bodyBays') {
      const found = facility.getBuildOptions().find((o) => o.kind === kind);
      if (!found) throw new Error(`no build option for ${kind}`);
      return found;
    },
    built: () => facility.getBuilt(),
  };
}

describe('Facility — built capacity is owned state (#358)', () => {
  it('exposes built lot spaces and both bay counts', () => {
    const facility = facilityAt({ current: 3 });
    const built = facility.getBuilt();
    expect(built.lotSpaces).toBe(35);
    expect(built.serviceBays).toBe(6);
    expect(built.bodyBays).toBe(3);
  });

  it('reads the lot and bay ceilings for every tier', () => {
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      const ceilings = facilityAt({ current: tier }).getCeilings();
      expect(ceilings).toEqual(ceilingsAtTier(DATA, tier));
    }
    // The three kinds scale independently — the Body Shop is dark until T3.
    expect(facilityAt({ current: 2 }).getCeilings().bodyBays).toBe(0);
    expect(facilityAt({ current: 3 }).getCeilings().bodyBays).toBeGreaterThan(0);
  });

  it("a fresh world starts with the tier's constant capacity", () => {
    // The whole point of the slice landing behavior-neutral: a new store runs
    // exactly the numbers the retired per-tier constants gave it.
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      const facility = facilityAt({ current: tier });
      expect(facility.getBuilt()).toEqual(facility.getCeilings());
    }
  });

  it('tier-up carries built capacity forward and lifts the ceiling', () => {
    const tier = { current: 1 };
    const facility = facilityAt(tier);
    const beforeUp = facility.getBuilt();
    expect(beforeUp.serviceBays).toBe(2);

    tier.current = 3;

    // Desks come with the tier; buildings are bought. Nothing was built, so
    // nothing changed on the ground — only the room to build did.
    expect(facility.getBuilt()).toEqual(beforeUp);
    const ceilings = facility.getCeilings();
    expect(ceilings.serviceBays).toBe(6);
    expect(ceilings.lotSpaces).toBe(35);
    expect(ceilings.bodyBays).toBe(3);
    expect(ceilings.serviceBays).toBeGreaterThan(facility.getBuilt().serviceBays);
  });

  it('round-trips built capacity through snapshot/restore', () => {
    const tier = { current: 5 };
    const source = facilityAt(tier);
    const restored = facilityAt({ current: 1 });
    restored.restore(source.snapshot());
    expect(restored.getBuilt()).toEqual(source.getBuilt());
    // Ceilings are derived from the LIVE tier, never restored — a Tier-1 store
    // holding Tier-5 buildings is over its ceiling, and says so honestly rather
    // than silently rewriting either number.
    expect(restored.getCeilings()).toEqual(ceilingsAtTier(DATA, 1));
  });

  it('seeds a default snapshot at the given tier', () => {
    expect(createDefaultFacilitySnapshot(2, DATA)).toEqual({
      schemaVersion: 2,
      built: { lotSpaces: 12, serviceBays: 4, bodyBays: 0 },
      jobs: [],
      jobSeq: 0,
    });
  });

  it('clamps an out-of-range tier into the ladder rather than reading as zero', () => {
    // "No capacity" is the failure mode that looks like a balance decision.
    expect(ceilingsAtTier(DATA, 0)).toEqual(ceilingsAtTier(DATA, 1));
    expect(ceilingsAtTier(DATA, 99)).toEqual(ceilingsAtTier(DATA, MAX_TIER));
  });
});

describe('Facility — construction buys the gap with cash and days (#359)', () => {
  it('a purchase debits cash and schedules the job', () => {
    const site = siteAt({ day: 10 });
    const before = site.cash();

    const result = site.facility.build('serviceBays');

    expect(result).toEqual({
      ok: true,
      job: {
        id: expect.any(String),
        kind: 'serviceBays',
        units: 1,
        cost: 20_000,
        startedOnDay: 10,
        completesOnDay: 13,
      },
    });
    expect(site.cash()).toBe(before - 20_000);
    // One stable ledger label — Finance groups expense bars by label.
    expect(site.spends).toEqual([{ amount: 20_000, label: 'Construction' }]);
    expect(site.facility.getJobs()).toHaveLength(1);
  });

  it('in-flight capacity is not usable yet', () => {
    const site = siteAt();
    site.facility.build('serviceBays');

    // Paid for, being built, and worth nothing on the floor until it lands.
    expect(site.built().serviceBays).toBe(2);
    const option = site.optionFor('serviceBays');
    expect(option.built).toBe(2);
    expect(option.inFlight).toBe(1);
    expect(option.jobs).toHaveLength(1);

    // The morning before it lands changes nothing either.
    site.morning(12);
    expect(site.built().serviceBays).toBe(2);
  });

  it('capacity lands on the completion day and announces itself', () => {
    const site = siteAt({ day: 10 });
    const heard: { kind: string; units: number; built: number; day: number }[] = [];
    site.bus.subscribe('facility:capacity_built', (e) => heard.push(e));

    site.facility.build('serviceBays');
    site.morning(13);

    expect(site.built().serviceBays).toBe(3);
    expect(site.facility.getJobs()).toHaveLength(0);
    // `built` is the new TOTAL, `units` the delta — a consumer never has to add.
    expect(heard).toEqual([{ kind: 'serviceBays', units: 1, built: 3, day: 13 }]);

    // Nothing is left to land, so a later morning changes nothing and says
    // nothing.
    site.morning(20);
    expect(site.built().serviceBays).toBe(3);
    expect(heard).toHaveLength(1);
  });

  it('refuses a purchase that would exceed the tier ceiling', () => {
    // Body bays are dark below Tier 3: the ceiling is zero, so there is
    // nothing to buy and the option says so instead of quoting a price.
    const dark = siteAt({ builtAtTier: 1, tier: 2 });
    const option = dark.optionFor('bodyBays');
    expect(option).toMatchObject({ ceiling: 0, units: 0, cost: 0, refusal: 'at-ceiling' });
    const before = dark.cash();
    expect(dark.facility.build('bodyBays')).toEqual({ ok: false, reason: 'at-ceiling' });
    expect(dark.cash()).toBe(before);
    expect(dark.facility.getJobs()).toHaveLength(0);
  });

  it('builds the block clamped to the room left, so the ceiling is exactly reachable', () => {
    // Lot: built 6, ceiling 35, block 5. Five full blocks reach 31; the sixth
    // is priced for the 4 that are left, not for a block that will not fit.
    const site = siteAt({ builtAtTier: 1, tier: 3 });
    for (let i = 0; i < 5; i++) {
      expect(site.optionFor('lotSpaces').units).toBe(5);
      expect(site.facility.build('lotSpaces').ok).toBe(true);
    }
    const last = site.optionFor('lotSpaces');
    expect(last).toMatchObject({ built: 6, inFlight: 25, units: 4, cost: 4_000 });
    expect(site.facility.build('lotSpaces').ok).toBe(true);

    // Committed capacity — built PLUS in flight — is what the ceiling measures,
    // so the same space can never be paid for twice.
    expect(site.optionFor('lotSpaces')).toMatchObject({ units: 0, refusal: 'at-ceiling' });
    expect(site.facility.build('lotSpaces')).toEqual({ ok: false, reason: 'at-ceiling' });

    site.morning(12);
    expect(site.built().lotSpaces).toBe(35);
  });

  it('refuses a purchase the player cannot afford', () => {
    const site = siteAt({ cash: 19_999 });
    const option = site.optionFor('serviceBays');
    expect(option).toMatchObject({ cost: 20_000, refusal: 'cannot-afford' });

    expect(site.facility.build('serviceBays')).toEqual({ ok: false, reason: 'cannot-afford' });
    expect(site.cash()).toBe(19_999);
    expect(site.spends).toEqual([]);
    expect(site.facility.getJobs()).toHaveLength(0);
  });

  it('quotes built, ceiling, cost and days for every capacity kind', () => {
    const site = siteAt({ builtAtTier: 2, tier: 3 });
    expect(site.facility.getBuildOptions().map((o) => o.kind)).toEqual([
      'lotSpaces',
      'serviceBays',
      'bodyBays',
    ]);
    expect(site.optionFor('serviceBays')).toMatchObject({
      built: 4,
      ceiling: 6,
      units: 1,
      cost: 20_000,
      days: 3,
      inFlight: 0,
    });
    expect(site.optionFor('bodyBays')).toMatchObject({ built: 0, ceiling: 3, days: 4 });
  });

  it('round-trips in-flight jobs and keeps job ids unique across a restore', () => {
    const site = siteAt({ day: 10 });
    site.facility.build('serviceBays');
    site.facility.build('lotSpaces');
    const snap = site.facility.snapshot();

    const restored = siteAt({ day: 10 });
    restored.facility.restore(snap);
    expect(restored.facility.getJobs()).toEqual(site.facility.getJobs());

    // The seq rides along, so a job scheduled after a reload cannot collide
    // with one that was already in flight.
    const next = restored.facility.build('lotSpaces');
    expect(next.ok).toBe(true);
    const ids = restored.facility.getJobs().map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);

    // And it still lands on the day it was sold on, not N days after the load.
    restored.morning(13);
    expect(restored.built().serviceBays).toBe(3);
  });

  it('restores a pre-construction save as nothing being built', () => {
    const site = siteAt();
    site.facility.build('serviceBays');
    // A #358 v1 blob — the state every save was already in before construction.
    site.facility.restore({
      schemaVersion: 1,
      built: { lotSpaces: 9, serviceBays: 3, bodyBays: 1 },
    });
    expect(site.facility.getJobs()).toEqual([]);
    expect(site.built()).toEqual({ lotSpaces: 9, serviceBays: 3, bodyBays: 1 });
  });
});

describe('Facility — the facility score the tier gate grades (#360)', () => {
  it("scores built capacity against the tier's ceiling", () => {
    // A store standing at T3 holding what it built at T2: lot 12 of 35,
    // service 4 of 6, body 0 of 3. Each kind counts once — one third of the
    // score apiece — so a big lot cannot cover for a one-bay shop.
    const site = siteAt({ builtAtTier: 2, tier: 3 });
    const expected = ((12 / 35 + 4 / 6 + 0 / 3) / 3) * 100;
    expect(site.facility.getFacilityScore()).toBeCloseTo(expected, 6);
    // ~34: under T3's bar of 50, which is the whole point of A2 R1.
    expect(Math.round(site.facility.getFacilityScore())).toBe(34);
  });

  it('scores a fully built-out store at 100 and an empty ceiling at 0', () => {
    // A fresh world seeds built = ceiling at every tier, so it starts clear.
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      expect(facilityAt({ current: tier }).getFacilityScore()).toBeCloseTo(100, 6);
    }
  });

  it('a tier with no body bays is not penalised for having none', () => {
    // T2 has no body-bay ceiling at all. Counting it as "0 of 0 built" would
    // cap a fully built-out T2 store at two-thirds for a building the tier
    // forbids it from putting up.
    const site = siteAt({ builtAtTier: 2, tier: 2 });
    expect(site.built().bodyBays).toBe(0);
    expect(site.facility.getCeilings().bodyBays).toBe(0);
    expect(site.facility.getFacilityScore()).toBeCloseTo(100, 6);
  });

  it('steps up when construction lands, not when it is paid for', () => {
    const site = siteAt({ builtAtTier: 2, tier: 3 });
    const before = site.facility.getFacilityScore();
    expect(site.facility.build('bodyBays').ok).toBe(true);
    // Cash is gone; the score has not moved, because nothing is standing yet.
    expect(site.facility.getFacilityScore()).toBeCloseTo(before, 6);
    site.morning(10 + DATA.construction.bodyBays.days);
    // 1 of 3 body bays now built ⇒ that kind's third goes 0 → 1/3.
    expect(site.facility.getFacilityScore()).toBeCloseTo(
      before + ((1 / 3) * 100) / 3,
      6,
    );
  });
});

describe('Facility — the shipped catalog (#358, #359)', () => {
  it('states all seven tiers for every capacity kind', () => {
    const table = loadFacilityData();
    for (const row of [table.lotSpaces, table.serviceBays, table.bodyBays]) {
      for (let tier = 1; tier <= MAX_TIER; tier++) {
        expect(typeof row[String(tier) as '1']).toBe('number');
      }
    }
  });

  it('carries the tier ladder the design ruled on', () => {
    const table = loadFacilityData();
    expect(table.lotSpaces['1']).toBe(6);
    expect(table.lotSpaces['3']).toBe(35);
    expect(table.lotSpaces['5']).toBe(120);
    // Service bays: the numbers the retired serviceDispatch.baysByTier carried.
    expect(table.serviceBays['1']).toBe(2);
    expect(table.serviceBays['3']).toBe(6);
    // Body bays: dark below the showroom tier.
    expect(table.bodyBays['2']).toBe(0);
    expect(table.bodyBays['3']).toBe(3);
  });

  it('prices and times every capacity kind', () => {
    const table = loadFacilityData();
    for (const kind of ['lotSpaces', 'serviceBays', 'bodyBays'] as const) {
      const spec = table.construction[kind];
      expect(spec.blockSize).toBeGreaterThan(0);
      expect(spec.unitCost).toBeGreaterThan(0);
      // Construction time is what makes this a decision rather than a checkbook
      // — a zero-day build would collapse it to "do I have the cash".
      expect(spec.days).toBeGreaterThan(0);
    }
  });

  it('refuses a table where a tier takes capacity away', () => {
    const shrinking = {
      ...DATA,
      serviceBays: { ...DATA.serviceBays, '3': 1 },
    };
    const result = FacilityDataSchema.safeParse(shrinking);
    expect(result.success).toBe(false);
  });
});
