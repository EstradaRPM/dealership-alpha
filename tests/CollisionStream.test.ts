import { createEventBus } from '../src/game/EventBus';
import {
  createCollisionStream,
  composeCollisionIntake,
  composeCollisionMix,
  collisionRates,
  samplePoisson,
  loadCollisionStreamConfig,
  BODY_SHOP_JOB_CATEGORIES,
  type CollisionStreamConfig,
  type CollisionStreamInput,
  type CollisionIntakeEntry,
} from '../src/game/CollisionStream';
import { createRng } from '../src/game/NPC/Rng';

const CONFIG: CollisionStreamConfig = loadCollisionStreamConfig();

function input(over: Partial<CollisionStreamInput> = {}): CollisionStreamInput {
  return {
    day: 10,
    conditionId: 'clear',
    season: 'spring',
    reputation: 0.6,
    posture: 0.5,
    baseSize: 0,
    masterSeed: 12345,
    ...over,
  };
}

/** Sum the expected total collision rate over a span — a stable (non-stochastic)
 *  proxy for "how busy the shop is" across feast/famine days. */
function totalRateOverDays(over: Partial<CollisionStreamInput>, days: number): number {
  let sum = 0;
  for (let day = 1; day <= days; day++) {
    const r = collisionRates(input({ ...over, day }), CONFIG);
    sum += r.insurance + r.retail;
  }
  return sum;
}

describe('CollisionStream — weather/season volume spikes', () => {
  it('bad-weather days draw a higher collision rate than clear days', () => {
    const clear = collisionRates(input({ conditionId: 'clear' }), CONFIG);
    const snow = collisionRates(input({ conditionId: 'snow' }), CONFIG);
    const storm = collisionRates(input({ conditionId: 'storm' }), CONFIG);
    expect(snow.retail).toBeGreaterThan(clear.retail);
    expect(storm.retail).toBeGreaterThan(snow.retail);
  });

  it('the season multiplier moves the rate (winter > summer)', () => {
    const winter = collisionRates(input({ season: 'winter' }), CONFIG);
    const summer = collisionRates(input({ season: 'summer' }), CONFIG);
    expect(winter.retail).toBeGreaterThan(summer.retail);
  });

  it('the retail (conquest) stream spikes harder with weather than the steady insurance stream', () => {
    const clear = collisionRates(input({ conditionId: 'clear', posture: 0.5 }), CONFIG);
    const storm = collisionRates(input({ conditionId: 'storm', posture: 0.5 }), CONFIG);
    const retailSpike = storm.retail / clear.retail;
    const insuranceSpike = storm.insurance / clear.insurance;
    expect(retailSpike).toBeGreaterThan(insuranceSpike);
  });

  it('is feast-or-famine, not a fixed cadence: realized daily counts vary widely', () => {
    const counts: number[] = [];
    for (let day = 1; day <= 120; day++) {
      // alternate quiet/clear and stormy days to exercise the spike
      const conditionId = day % 7 === 0 ? 'storm' : 'clear';
      counts.push(composeCollisionIntake(input({ day, conditionId }), CONFIG).length);
    }
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    expect(min).toBeLessThan(max); // not a flat cadence
    expect(max).toBeGreaterThanOrEqual(min + 2); // genuine spikes
  });
});

describe('CollisionStream — reputation-dominant conquest', () => {
  it('higher reputation raises the retail/conquest rate', () => {
    const low = collisionRates(input({ reputation: 0.1 }), CONFIG);
    const high = collisionRates(input({ reputation: 0.95 }), CONFIG);
    expect(high.retail).toBeGreaterThan(low.retail);
  });

  it('the insurance-DRP stream is reputation-independent (a contract feed)', () => {
    const low = collisionRates(input({ reputation: 0.1 }), CONFIG);
    const high = collisionRates(input({ reputation: 0.95 }), CONFIG);
    expect(high.insurance).toBeCloseTo(low.insurance, 6);
  });

  it('carries a small installed-base tie that nudges the retail rate up', () => {
    const noBase = collisionRates(input({ baseSize: 0 }), CONFIG);
    const withBase = collisionRates(input({ baseSize: 80 }), CONFIG);
    expect(withBase.retail).toBeGreaterThan(noBase.retail);
    // but the tie is small relative to the conquest base — capped contribution.
    expect(withBase.retail - noBase.retail).toBeLessThanOrEqual(CONFIG.volume.baseTieCap * 2);
  });
});

describe('CollisionStream — insurance vs retail channel profiles', () => {
  it('leaning insurance (posture→0) yields a steady, high insurance volume; leaning retail (posture→1) yields lumpy retail', () => {
    const insuranceLean = collisionRates(input({ posture: 0 }), CONFIG);
    const retailLean = collisionRates(input({ posture: 1 }), CONFIG);
    // full insurance posture: no retail conquest grown by lean, insurance present
    expect(insuranceLean.insurance).toBeGreaterThan(0);
    expect(insuranceLean.insurance).toBeGreaterThan(retailLean.insurance);
    // full retail posture: insurance referral feed dries up, retail is fatter
    expect(retailLean.insurance).toBeCloseTo(0, 6);
    expect(retailLean.retail).toBeGreaterThan(insuranceLean.retail);
  });

  it('insurance tickets are rate-capped below book; retail tickets carry the fatter margin', () => {
    // Draw a busy stormy day with a balanced posture so both channels appear.
    const entries = composeCollisionIntake(
      input({ conditionId: 'storm', posture: 0.5, reputation: 0.9, day: 7 }),
      CONFIG,
    );
    const ins = entries.filter((e) => e.source === 'insurance');
    const ret = entries.filter((e) => e.source === 'retail');
    expect(ins.length).toBeGreaterThan(0);
    expect(ret.length).toBeGreaterThan(0);

    for (const cat of BODY_SHOP_JOB_CATEGORIES) {
      const book = CONFIG.jobRevenue[cat];
      const insForCat = ins.find((e) => e.jobCategory === cat);
      const retForCat = ret.find((e) => e.jobCategory === cat);
      if (insForCat) expect(insForCat.baseRevenue).toBeLessThan(book);
      if (retForCat) expect(retForCat.baseRevenue).toBeGreaterThan(book);
    }
    // for any shared category, retail out-earns insurance per job
    expect(Math.round(CONFIG.jobRevenue.paint * CONFIG.channel.retailMarginMultiplier)).toBeGreaterThan(
      Math.round(CONFIG.jobRevenue.paint * CONFIG.channel.insuranceRateCap),
    );
  });

  it('across mixed weather the insurance rate is steadier (lower spread) than the lumpy retail rate', () => {
    // Compare the deterministic rates' weather-driven variability — isolating the
    // "steady vs lumpy" property from the Poisson-mean confound (a smaller mean
    // inflates realized-count CV regardless of weather sensitivity).
    const insRates: number[] = [];
    const retRates: number[] = [];
    for (let day = 1; day <= 200; day++) {
      const conditionId = day % 5 === 0 ? 'storm' : 'clear';
      const r = collisionRates(input({ day, conditionId, posture: 0.5, reputation: 0.7 }), CONFIG);
      insRates.push(r.insurance);
      retRates.push(r.retail);
    }
    const cv = (xs: number[]): number => {
      const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
      if (mean === 0) return 0;
      const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
      return Math.sqrt(variance) / mean;
    };
    expect(cv(retRates)).toBeGreaterThan(cv(insRates));
  });
});

describe('CollisionStream — enriched intake shape', () => {
  it('each ticket carries customer + vehicle identity, parts category, and revenue', () => {
    const entries = composeCollisionIntake(
      input({ conditionId: 'storm', reputation: 0.95, day: 3 }),
      CONFIG,
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(typeof e.ticketId).toBe('string');
      expect(e.source === 'insurance' || e.source === 'retail').toBe(true);
      expect(e.customerId).toMatch(/^bs-/);
      expect(e.vehicleId).toMatch(/^bs-/);
      expect(typeof e.category).toBe('string');
      expect(['ice', 'hybrid', 'ev']).toContain(e.powertrain);
      expect(BODY_SHOP_JOB_CATEGORIES).toContain(e.jobCategory);
      expect(e.baseRevenue).toBeGreaterThan(0);
    }
  });

  it('the composed job mix is a normalized distribution; snow/storm tilt toward glass/panels', () => {
    const mix = composeCollisionMix(input({ conditionId: 'snow', season: 'winter' }), CONFIG);
    const total = BODY_SHOP_JOB_CATEGORIES.reduce((s, c) => s + mix[c], 0);
    expect(total).toBeCloseTo(1, 6);
    const clear = composeCollisionMix(input({ conditionId: 'clear', season: 'winter' }), CONFIG);
    expect(mix.windows_glass).toBeGreaterThan(clear.windows_glass);
  });
});

describe('CollisionStream — determinism', () => {
  it('the same masterSeed + day composes a byte-identical intake', () => {
    const a = composeCollisionIntake(input({ day: 42, conditionId: 'storm' }), CONFIG);
    const b = composeCollisionIntake(input({ day: 42, conditionId: 'storm' }), CONFIG);
    expect(b).toEqual(a);
  });

  it('different masterSeeds diverge', () => {
    const a = composeCollisionIntake(input({ masterSeed: 1, conditionId: 'storm', reputation: 0.9 }), CONFIG);
    const b = composeCollisionIntake(input({ masterSeed: 2, conditionId: 'storm', reputation: 0.9 }), CONFIG);
    // identical-length runs would still differ in draws; assert the serialized form differs
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('samplePoisson is deterministic per seed and clamps at maxLambda', () => {
    const k1 = samplePoisson(3, 40, createRng(99));
    const k2 = samplePoisson(3, 40, createRng(99));
    expect(k1).toBe(k2);
    expect(samplePoisson(-5, 40, createRng(1))).toBe(0);
    expect(samplePoisson(1e9, 40, createRng(1))).toBeLessThanOrEqual(200); // clamped
  });
});

describe('CollisionStream — event wiring', () => {
  it('publishes bodyshop:demand_ready on clock:day_started with the live reads', () => {
    const bus = createEventBus();
    let posture = 0.5;
    let rep = 0.9;
    const stream = createCollisionStream({
      bus,
      masterSeed: 777,
      weather: (day) => ({ conditionId: day === 5 ? 'storm' : 'clear', season: 'winter' }),
      reputation: () => rep,
      posture: () => posture,
      baseSize: () => 10,
    });

    const seen: CollisionIntakeEntry[][] = [];
    bus.subscribe('bodyshop:demand_ready', ({ intake }) => seen.push([...intake]));

    bus.publish('clock:day_started', { day: 5 });
    expect(seen.length).toBe(1);
    expect(stream.getLatestIntake()).toEqual(seen[0]);

    // posture/reputation reads are live: full insurance lean removes the lean-grown
    // retail volume; the published stream reflects the new dial next day.
    posture = 0;
    rep = 0.1;
    bus.publish('clock:day_started', { day: 6 });
    expect(seen.length).toBe(2);
    expect(seen[1].every((e) => ['insurance', 'retail'].includes(e.source))).toBe(true);
  });

  it('a fixed seed replays the published stream identically across two worlds', () => {
    const run = (): CollisionIntakeEntry[] => {
      const bus = createEventBus();
      const stream = createCollisionStream({
        bus,
        masterSeed: 2024,
        weather: () => ({ conditionId: 'snow', season: 'winter' }),
        reputation: () => 0.8,
        posture: () => 0.4,
        baseSize: () => 25,
      });
      bus.publish('clock:day_started', { day: 30 });
      return [...stream.getLatestIntake()];
    };
    expect(run()).toEqual(run());
  });
});
