import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createServiceMarketing,
  loadServiceMarketingConfig,
  type ServiceMarketingConfig,
} from '../src/game/ServiceMarketing';
import {
  createInstalledBase,
  type InstalledBaseConfig,
} from '../src/game/InstalledBase';
import {
  composeConquestMix,
  composeServiceIntake,
  loadServiceDemandConfig,
  JOB_CATEGORIES,
  type ServiceDemandConfig,
  type ServiceDemandInput,
} from '../src/game/ServiceDemand';

// ── Fixtures ────────────────────────────────────────────────────────────────

const SM_CONFIG: ServiceMarketingConfig = {
  schemaVersion: 1,
  retentionCampaigns: [
    { id: 'basic', label: 'Basic mailer', blurb: '', dailyCost: 30, returnLift: 0.1 },
    { id: 'premium', label: 'Prepaid push', blurb: '', dailyCost: 80, returnLift: 0.25 },
  ],
  conquestSpecial: { dailyCost: 50, volumeBoost: 0.8, categoryBias: 2 },
};

/** A fake Economy capturing the daily-cost debits the arms post. */
function fakeEconomy() {
  const debits: { amount: number; label: string }[] = [];
  return {
    debits,
    forceDebit: (amount: number, label: string) => debits.push({ amount, label }),
  };
}

const SD_CONFIG: ServiceDemandConfig = loadServiceDemandConfig();

function makeInput(over: Partial<ServiceDemandInput> = {}): ServiceDemandInput {
  return {
    day: 10,
    returns: [],
    owners: [],
    reputation: 1,
    serviceMarketing: 0,
    season: 'summer',
    masterSeed: 12345,
    ...over,
  };
}

// ── Lever surface ────────────────────────────────────────────────────────────

describe('ServiceMarketing levers', () => {
  it('starts with both arms off', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    expect(sm.getRetentionCampaign()).toBe('none');
    expect(sm.getConquestSpecial()).toBe('none');
    expect(sm.retentionLift()).toBe(0);
    expect(sm.conquestVolumeInfluence()).toBe(0);
    expect(sm.conquestBias()).toBeNull();
  });

  it('exposes the data-driven retention campaign options (no magnitudes)', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    expect(sm.retentionCampaigns).toEqual([
      { id: 'basic', label: 'Basic mailer', blurb: '' },
      { id: 'premium', label: 'Prepaid push', blurb: '' },
    ]);
  });

  it('surfaces the selected campaign lift and conquest bias/volume', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    sm.setRetentionCampaign('premium');
    expect(sm.retentionLift()).toBe(0.25);

    sm.setConquestSpecial('tires_brakes');
    expect(sm.conquestVolumeInfluence()).toBe(0.8);
    expect(sm.conquestBias()).toEqual({ category: 'tires_brakes', strength: 2 });
  });

  it("clears each arm with 'none'", () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    sm.setRetentionCampaign('basic');
    sm.setConquestSpecial('oil_filters');
    sm.setRetentionCampaign('none');
    sm.setConquestSpecial('none');
    expect(sm.retentionLift()).toBe(0);
    expect(sm.conquestBias()).toBeNull();
  });

  it('rejects unknown selections', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    expect(() => sm.setRetentionCampaign('nope')).toThrow(/Unknown retention campaign/);
    // @ts-expect-error — exercising the runtime guard with a bad category.
    expect(() => sm.setConquestSpecial('brakes')).toThrow(/Unknown conquest category/);
  });

  it('parses the shipped data file', () => {
    const cfg = loadServiceMarketingConfig();
    expect(cfg.schemaVersion).toBe(1);
    expect(cfg.retentionCampaigns.length).toBeGreaterThan(0);
    expect(cfg.conquestSpecial.volumeBoost).toBeGreaterThanOrEqual(0);
  });
});

// ── Spend accounting ─────────────────────────────────────────────────────────

describe('ServiceMarketing spend (both arms debit Economy)', () => {
  it('debits nothing when both arms are off', () => {
    const economy = fakeEconomy();
    const sm = createServiceMarketing({ economy, config: SM_CONFIG });
    sm.advanceDay(1);
    expect(economy.debits).toEqual([]);
  });

  it('debits each active arm its daily cost once per day', () => {
    const economy = fakeEconomy();
    const sm = createServiceMarketing({ economy, config: SM_CONFIG });
    sm.setRetentionCampaign('premium'); // 80/day
    sm.setConquestSpecial('tires_brakes'); // 50/day
    sm.advanceDay(1);
    expect(economy.debits.map((d) => d.amount)).toEqual([80, 50]);
    sm.advanceDay(2);
    expect(economy.debits).toHaveLength(4);
    expect(economy.debits.reduce((s, d) => s + d.amount, 0)).toBe(260);
  });

  it('debits only the active arm', () => {
    const economy = fakeEconomy();
    const sm = createServiceMarketing({ economy, config: SM_CONFIG });
    sm.setRetentionCampaign('basic'); // 30/day
    sm.advanceDay(1);
    expect(economy.debits).toEqual([
      { amount: 30, label: 'Service marketing: retention (basic)' },
    ]);
  });
});

// ── Snapshot / restore ───────────────────────────────────────────────────────

describe('ServiceMarketing persistence', () => {
  it('round-trips the two selections', () => {
    const a = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    a.setRetentionCampaign('premium');
    a.setConquestSpecial('drivetrain');

    const b = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    b.restore(a.snapshot());
    expect(b.getRetentionCampaign()).toBe('premium');
    expect(b.getConquestSpecial()).toBe('drivetrain');
    expect(b.retentionLift()).toBe(0.25);
  });

  it('falls back to none for selections missing from current data', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    sm.restore({
      schemaVersion: 1,
      retentionCampaignId: 'retired_campaign',
      conquestCategory: 'spaceship' as never,
    });
    expect(sm.getRetentionCampaign()).toBe('none');
    expect(sm.getConquestSpecial()).toBe('none');
  });
});

// ── Retention arm → InstalledBase return roll ────────────────────────────────

const IB_CONFIG: InstalledBaseConfig = {
  loyaltySeedScale: 1.0,
  returnCadence: { ice: 10, hybrid: 10, ev: 10 },
  jobCategoryDrift: [{ category: 'oil_filters' }],
  // Baseline leaves headroom so a retention lift visibly moves the return roll.
  returnRoll: { convenience: 0.8, priceSensitivity: 0.05 },
  feedback: {
    goodLoyaltyBonus: 0.04,
    goodCsiBonus: 0.04,
    missLoyaltyPenalty: 0.15,
    missCsiPenalty: 0.15,
    unservedLoyaltyPenalty: 0.1,
    unservedCsiPenalty: 0.1,
    gougeLoyaltyPenalty: 0.06,
    gougeCsiPenalty: 0.06,
    fairPostureThreshold: 0.66,
    reputationMissHit: -3,
    reputationUnservedHit: -2,
    reputationGougeHit: -1,
  },
  defection: { badVisitsToDefect: 3, noReturnsToDefect: 4 },
  repeatBuyer: { ageOutDays: 1460, minLoyalty: 0.6 },
};

function emitSale(bus: EventBus, customerId: string, vehicleId: string): void {
  bus.publish('inventory:vehicle_sold', {
    day: 1,
    vehicleId,
    salePrice: 20_000,
    templateId: 'tmpl',
    brand: 'vanda',
    make: 'Honda',
    year: 2020,
    mileage: 40_000,
    condition: 'clean',
    category: 'sedan',
    purchasePrice: 15_000,
    reconCost: 800,
    powertrain: 'ice',
  });
  bus.publish('deal:closed', {
    customerId,
    vehicleId,
    agreedPrice: 20_000,
    frontGross: 1_200,
    backGross: 600,
    productGross: 600,
    reserveGross: 0,
    daysInInventory: 10,
    paymentMethod: 'cash',
    downPayment: 20_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
  bus.publish('customer:resolved', {
    customerId,
    outcome: 'closed',
    receptivity: 0.5,
    satisfaction: 1,
    retentionSeed: 0.5, // mid-range loyalty → return roll sits in its sensitive band
    heat: 0,
    agreedPrice: 20_000,
    frontGross: 1_200,
  });
}

/** Accrue 200 mid-loyalty owners, fire the due day, return how many came back. */
function countReturns(getRetentionLift: () => number): number {
  const bus = createEventBus();
  let count = 0;
  bus.subscribe('installedBase:returns_ready', (p) => {
    count = p.returns.length;
  });
  createInstalledBase({ bus, config: IB_CONFIG, masterSeed: 42, getRetentionLift });
  for (let i = 0; i < 200; i++) emitSale(bus, `c${i}`, `v${i}`);
  bus.publish('clock:day_started', { day: 11 }); // age 10 = one ICE cadence ⇒ due
  return count;
}

describe('retention arm lifts the return roll', () => {
  it('an active campaign measurably raises the share of owners that return', () => {
    const off = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    const on = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    on.setRetentionCampaign('premium');

    const baseline = countReturns(() => off.retentionLift());
    const lifted = countReturns(() => on.retentionLift());

    expect(lifted).toBeGreaterThan(baseline);
  });

  it('is deterministic under a fixed seed (replay-safe)', () => {
    const on = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    on.setRetentionCampaign('premium');
    expect(countReturns(() => on.retentionLift())).toBe(
      countReturns(() => on.retentionLift()),
    );
  });
});

// ── Conquest arm → ServiceDemand mix + volume ────────────────────────────────

describe('conquest arm skews the incoming mix + raises volume', () => {
  it('a category-targeted special raises the promoted category share', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    sm.setConquestSpecial('tires_brakes');

    const base = composeConquestMix(makeInput({ conquestBias: null }), SD_CONFIG);
    const skewed = composeConquestMix(
      makeInput({ conquestBias: sm.conquestBias() }),
      SD_CONFIG,
    );

    expect(skewed.tires_brakes).toBeGreaterThan(base.tires_brakes);
    // Normalized ⇒ the non-promoted categories give up share.
    for (const cat of JOB_CATEGORIES) {
      if (cat !== 'tires_brakes') expect(skewed[cat]).toBeLessThan(base[cat]);
    }
    // Still a valid distribution.
    expect(JOB_CATEGORIES.reduce((s, c) => s + skewed[c], 0)).toBeCloseTo(1, 6);
  });

  it('the volume influence pulls more conquest walk-ins', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    const conquestCount = (mktg: number) =>
      composeServiceIntake(makeInput({ reputation: 1, serviceMarketing: mktg }), SD_CONFIG)
        .filter((e) => e.source === 'conquest').length;

    const floor = conquestCount(0);
    sm.setConquestSpecial('tires_brakes');
    const boosted = conquestCount(sm.conquestVolumeInfluence());

    expect(boosted).toBeGreaterThan(floor);
  });

  it('is deterministic under a fixed seed (replay-safe)', () => {
    const sm = createServiceMarketing({ economy: fakeEconomy(), config: SM_CONFIG });
    sm.setConquestSpecial('tires_brakes');
    const input = makeInput({
      reputation: 1,
      serviceMarketing: sm.conquestVolumeInfluence(),
      conquestBias: sm.conquestBias(),
    });
    expect(composeServiceIntake(input, SD_CONFIG)).toEqual(
      composeServiceIntake(input, SD_CONFIG),
    );
  });
});
