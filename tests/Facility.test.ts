import {
  createFacility,
  createDefaultFacilitySnapshot,
  loadFacilityCeilings,
  ceilingsAtTier,
  FacilityCeilingSchema,
  MAX_TIER,
} from '../src/game/Facility';

// A small stand-in table so the behavior tests state the numbers they mean
// rather than depending on today's balance. The shipped file is exercised
// separately below.
const CEILINGS = {
  lotSpaces: { '1': 6, '2': 12, '3': 35, '4': 75, '5': 120, '6': 120, '7': 120 },
  serviceBays: { '1': 2, '2': 4, '3': 6, '4': 6, '5': 6, '6': 6, '7': 6 },
  bodyBays: { '1': 0, '2': 0, '3': 3, '4': 5, '5': 7, '6': 7, '7': 7 },
};

function facilityAt(tier: { current: number }) {
  return createFacility({ getTier: () => tier.current, ceilings: CEILINGS });
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
      expect(ceilings).toEqual(ceilingsAtTier(CEILINGS, tier));
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
    expect(restored.getCeilings()).toEqual(ceilingsAtTier(CEILINGS, 1));
  });

  it('seeds a default snapshot at the given tier', () => {
    expect(createDefaultFacilitySnapshot(2, CEILINGS)).toEqual({
      schemaVersion: 1,
      built: { lotSpaces: 12, serviceBays: 4, bodyBays: 0 },
    });
  });

  it('clamps an out-of-range tier into the ladder rather than reading as zero', () => {
    // "No capacity" is the failure mode that looks like a balance decision.
    expect(ceilingsAtTier(CEILINGS, 0)).toEqual(ceilingsAtTier(CEILINGS, 1));
    expect(ceilingsAtTier(CEILINGS, 99)).toEqual(
      ceilingsAtTier(CEILINGS, MAX_TIER),
    );
  });
});

describe('Facility — the shipped ceiling table (#358)', () => {
  it('states all seven tiers for every capacity kind', () => {
    const table = loadFacilityCeilings();
    for (const row of [table.lotSpaces, table.serviceBays, table.bodyBays]) {
      for (let tier = 1; tier <= MAX_TIER; tier++) {
        expect(typeof row[String(tier) as '1']).toBe('number');
      }
    }
  });

  it('carries the tier ladder the design ruled on', () => {
    const table = loadFacilityCeilings();
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

  it('refuses a table where a tier takes capacity away', () => {
    const shrinking = {
      ...CEILINGS,
      serviceBays: { ...CEILINGS.serviceBays, '3': 1 },
    };
    const result = FacilityCeilingSchema.safeParse(shrinking);
    expect(result.success).toBe(false);
  });
});
