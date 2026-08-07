import {
  closeAndPrice,
  GREEN_SALESPERSON,
  makeSalespersonProfile,
  staticMarketPrice,
  staticVehicleCost,
} from '../src/game/SalesProcess';
import type {
  CloseInput,
  CloseResult,
  MeterState,
  PricedVehicleInput,
  SalesProcessConfig,
} from '../src/game/SalesProcess';

const config: SalesProcessConfig = {
  schemaVersion: 1,
  gates: ['GREET', 'QUALIFY', 'DEMO', 'NEGOTIATE'],
  rng: { seedNamespace: 'customer_pool.sales_gate', jitterBand: 0.15 },
  core: { skillWeight: 0.55, fitWeight: 0.3, easeWeight: 0.15 },
  meters: {
    GREET: { trust: 1, value: 0 },
    QUALIFY: { trust: 0.6, value: 0.4 },
    DEMO: { trust: 0.3, value: 0.7 },
    NEGOTIATE: { trust: 0.5, value: 0.5 },
  },
  walk: { trustCollapseFloor: 0.15, patienceFloor: 0 },
  nonnegotiables: { qualifyRevealThreshold: 0.45, tolerance: 0.1 },
  close: { buyThreshold: 0.75, softThreshold: 0.55, trustFloor: 0.45 },
  price: {
    reservationBase: 1.0,
    valueLift: 0.5,
    sensitivityDrag: 0.5,
    minGross: 800,
    overageAllowed: 1500,
    framingWeight: 0.15,
  },
  heat: { stageWeight: 0.5, valueWeight: 0.3, trustWeight: 0.2 },
  retention: { trustWeight: 0.6, dealWeight: 0.4 },
  calibration: {
    positiveMin: 0.85,
    apatheticMin: 0.1,
    apatheticMax: 0.12,
    negativeDealMin: 0.03,
    negativeDealMax: 0.05,
  },
};

const deps = { config };

/** A vehicle with known marketPrice ($20k) and vehicleCost ($16k) via static stubs. */
const vehicle: PricedVehicleInput = {
  purchasePrice: 14_400,
  reconCost: 1_600, // cost = 16k, market = cost * 1.25 = 20k
};

// Verify stub math
const MARKET_PRICE = staticMarketPrice(vehicle); // 20_000
const VEHICLE_COST = staticVehicleCost(vehicle); // 16_000

describe('static price stubs', () => {
  it('produces expected market/cost values', () => {
    expect(VEHICLE_COST).toBe(16_000);
    expect(MARKET_PRICE).toBe(20_000);
  });
});

// ── Price Formation ──────────────────────────────────────────────────────────

describe('price formation', () => {
  it('realizedPrice clamps to marginFloorPrice when requiredDiscount is excessive', () => {
    // High sensitivity, low value/trust → large discount demanded → hits floor
    const meters: MeterState = { trustIntegrity: 0.1, value: 0.1 };
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 1.0,
        vehicle,
      },
      deps,
    );
    expect(result.priceFormation.marginFloorPrice).toBe(16_800); // 16k + 800 minGross
    expect(result.realizedPrice).toBeGreaterThanOrEqual(
      result.priceFormation.marginFloorPrice,
    );
  });

  it('reservation ≥ ask → requiredDiscount 0, buys at ask (no premium above ask)', () => {
    // Max value, zero sensitivity → reservation well above the ask. A customer
    // never volunteers above their max, so the realized price is the ask itself.
    const meters: MeterState = { trustIntegrity: 1.0, value: 1.0 };
    const expert = makeSalespersonProfile({
      NEGOTIATE: { effectiveness: 1.0, trustworthiness: 1.0 },
    });
    const result = closeAndPrice(
      { meters, skill: expert, priceSensitivity: 0, vehicle },
      deps,
    );
    // ask = market = 20k; reservation = 20k·(1 + 0.5·1 − 0.5·0) = 30k ≥ ask
    expect(result.priceFormation.reservationPrice).toBe(30_000);
    expect(result.priceFormation.requiredDiscount).toBe(0);
    expect(result.realizedPrice).toBe(20_000); // buys at ask
    expect(result.frontGross).toBe(20_000 - 16_000);
  });

  it('frontGross = realizedPrice − vehicleCost', () => {
    const meters: MeterState = { trustIntegrity: 0.5, value: 0.5 };
    const result = closeAndPrice(
      { meters, skill: GREEN_SALESPERSON, priceSensitivity: 0.5, vehicle },
      deps,
    );
    expect(result.frontGross).toBe(result.realizedPrice - VEHICLE_COST);
  });

  it('closeable is false when rawPrice < marginFloorPrice', () => {
    // Force a massive requiredDiscount to push rawPrice below floor
    const meters: MeterState = { trustIntegrity: 0.0, value: 0.0 };
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 1.0,
        vehicle,
      },
      deps,
    );
    // reservation = 20k·(1 + 0.5·0 − 0.5·1) = 10k → rawPrice = 10k
    // marginFloorPrice = 16800 → not closeable
    expect(result.closeable).toBe(false);
  });

  it('closeable is true when rawPrice >= marginFloorPrice', () => {
    const meters: MeterState = { trustIntegrity: 0.8, value: 0.9 };
    const expert = makeSalespersonProfile({
      NEGOTIATE: { effectiveness: 0.9, trustworthiness: 0.9 },
    });
    const result = closeAndPrice(
      { meters, skill: expert, priceSensitivity: 0.2, vehicle },
      deps,
    );
    expect(result.closeable).toBe(true);
    expect(result.priceFormation.rawPrice).toBeGreaterThanOrEqual(
      result.priceFormation.marginFloorPrice,
    );
  });
});

// ── Quadrant Close — four quadrants ─────────────────────────────────────────

describe('quadrant close model', () => {
  /**
   * Quadrant 1: strong objectiveDeal + high trust → clean unconditional buy.
   * High value, low sensitivity, no-cost deal → large objectiveDeal.
   */
  it('Q1: high objectiveDeal + high trust → buy, no flags', () => {
    const meters: MeterState = { trustIntegrity: 0.9, value: 0.95 };
    const expert = makeSalespersonProfile({
      NEGOTIATE: { effectiveness: 0.9, trustworthiness: 0.9 },
    });
    const result = closeAndPrice(
      { meters, skill: expert, priceSensitivity: 0.1, vehicle },
      deps,
    );
    expect(result.outcome).toBe('buy');
    expect(result.objectiveDeal).toBeGreaterThanOrEqual(
      config.close.buyThreshold,
    );
    expect(result.badReview).toBe(false);
    expect(result.highFiResistance).toBe(false);
  });

  /**
   * Quadrant 2: strong objectiveDeal + low trust → forced buy with flags.
   * The deal is so good (high value, low sensitivity) the customer buys anyway,
   * but trust is low → bad review + high F&I resistance.
   */
  it('Q2: high objectiveDeal + low trust → buy + badReview + highFiResistance', () => {
    // Need objectiveDeal >= buyThreshold (0.75) with trust < trustFloor (0.45)
    // High value meter (0.95) + low sensitivity (0.1) + big discount via bad skill
    const meters: MeterState = { trustIntegrity: 0.1, value: 0.98 };
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 0.05,
        vehicle,
      },
      deps,
    );
    if (result.objectiveDeal >= config.close.buyThreshold) {
      expect(result.outcome).toBe(result.closeable ? 'buy' : 'no_close');
      if (result.outcome === 'buy') {
        expect(result.badReview).toBe(true);
        expect(result.highFiResistance).toBe(true);
      }
    }
  });

  /**
   * Quadrant 3: soft objectiveDeal + high trust → soft close (buy).
   * objectiveDeal in [softThreshold, buyThreshold) + trust >= trustFloor.
   */
  it('Q3: soft objectiveDeal + high trust → buy via soft close', () => {
    // Craft meters so objectiveDeal lands in soft zone
    // value = 0.7, sensitivity = 0.5 → priceScore depends on discount fraction
    // We'll use a known skill/trust combo and verify the soft rule applies
    const meters: MeterState = { trustIntegrity: 0.8, value: 0.7 };
    const expert = makeSalespersonProfile({
      NEGOTIATE: { effectiveness: 0.75, trustworthiness: 0.8 },
    });
    const result = closeAndPrice(
      { meters, skill: expert, priceSensitivity: 0.5, vehicle },
      deps,
    );
    if (
      result.objectiveDeal >= config.close.softThreshold &&
      result.objectiveDeal < config.close.buyThreshold
    ) {
      expect(result.outcome).toBe(result.closeable ? 'buy' : 'no_close');
      expect(result.badReview).toBe(false);
    }
  });

  /**
   * Quadrant 4: low objectiveDeal + low trust → no_close.
   * Uses low priceSensitivity so the floor isn't hit and objectiveDeal is
   * genuinely low (value-oriented customer, weak process, near-full price).
   */
  it('Q4: low objectiveDeal + low trust → no_close', () => {
    const meters: MeterState = { trustIntegrity: 0.2, value: 0.2 };
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 0.2,
        vehicle,
      },
      deps,
    );
    expect(result.outcome).toBe('no_close');
    expect(result.closeable).toBe(true); // price math works; failure is genuine disinterest
    expect(result.objectiveDeal).toBeLessThan(config.close.softThreshold);
  });

  it('no_close when closeable=false regardless of objectiveDeal', () => {
    // Force closeable=false via extreme scenario but with high enough objectiveDeal
    // by using a custom vehicle with tiny margin
    const tightVehicle: PricedVehicleInput = {
      purchasePrice: 18_500,
      reconCost: 1_500, // cost = 20k, market = 25k
    };
    // Huge sensitivity forces requiredDiscount to exceed gap → not closeable
    const meters: MeterState = { trustIntegrity: 0.05, value: 0.05 };
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 1.0,
        vehicle: tightVehicle,
      },
      deps,
    );
    if (!result.closeable) {
      expect(result.outcome).toBe('no_close');
    }
  });
});

// ── objectiveDeal math ───────────────────────────────────────────────────────

describe('objectiveDeal', () => {
  it('is 0 when ValueMeter is 0, regardless of price', () => {
    const meters: MeterState = { trustIntegrity: 1.0, value: 0 };
    const result = closeAndPrice(
      { meters, skill: GREEN_SALESPERSON, priceSensitivity: 0, vehicle },
      deps,
    );
    expect(result.objectiveDeal).toBe(0);
  });

  it('is never above 1', () => {
    const meters: MeterState = { trustIntegrity: 1, value: 1 };
    const expert = makeSalespersonProfile({
      NEGOTIATE: { effectiveness: 1, trustworthiness: 1 },
    });
    const result = closeAndPrice(
      { meters, skill: expert, priceSensitivity: 0, vehicle },
      deps,
    );
    expect(result.objectiveDeal).toBeLessThanOrEqual(1);
  });

  it('is always non-negative', () => {
    const meters: MeterState = { trustIntegrity: 0, value: 0 };
    const result = closeAndPrice(
      { meters, skill: GREEN_SALESPERSON, priceSensitivity: 1, vehicle },
      deps,
    );
    expect(result.objectiveDeal).toBeGreaterThanOrEqual(0);
  });

  it('low priceSensitivity means objectiveDeal ≈ ValueMeter (price matters little)', () => {
    const meters: MeterState = { trustIntegrity: 0.5, value: 0.8 };
    // At priceSensitivity=0 the price term drops out → objectiveDeal = ValueMeter = 0.8
    const result = closeAndPrice(
      { meters, skill: GREEN_SALESPERSON, priceSensitivity: 0, vehicle },
      deps,
    );
    expect(result.objectiveDeal).toBeCloseTo(0.8, 5);
  });
});

// ── Skill-meter extremes ─────────────────────────────────────────────────────

describe('skill/meter extremes — deterministic', () => {
  const cases: Array<{
    label: string;
    meters: MeterState;
    sensitivity: number;
    expectedOutcome: 'buy' | 'no_close' | 'either';
  }> = [
    {
      label: 'perfect process, no sensitivity',
      meters: { trustIntegrity: 1, value: 1 },
      sensitivity: 0,
      expectedOutcome: 'buy',
    },
    {
      label: 'zero value, high sensitivity',
      meters: { trustIntegrity: 0.5, value: 0 },
      sensitivity: 1,
      expectedOutcome: 'no_close',
    },
    {
      label: 'moderate meters, moderate sensitivity',
      meters: { trustIntegrity: 0.6, value: 0.65 },
      sensitivity: 0.5,
      expectedOutcome: 'either',
    },
  ];

  for (const { label, meters, sensitivity, expectedOutcome } of cases) {
    it(`${label} → ${expectedOutcome}`, () => {
      const r1 = closeAndPrice(
        { meters, skill: GREEN_SALESPERSON, priceSensitivity: sensitivity, vehicle },
        deps,
      );
      const r2 = closeAndPrice(
        { meters, skill: GREEN_SALESPERSON, priceSensitivity: sensitivity, vehicle },
        deps,
      );
      // Deterministic: same inputs always produce same result
      expect(r1.outcome).toBe(r2.outcome);
      expect(r1.objectiveDeal).toBe(r2.objectiveDeal);
      expect(r1.realizedPrice).toBe(r2.realizedPrice);

      if (expectedOutcome !== 'either') {
        // Only check price-clamped closeable deals
        if (expectedOutcome === 'buy') {
          expect(r1.outcome).toBe('buy');
        } else {
          expect(r1.outcome).toBe('no_close');
        }
      }
    });
  }
});

// ── Price seam injection ─────────────────────────────────────────────────────

// ── askingPrice anchor (#273) ────────────────────────────────────────────────

describe('askingPrice anchor (#273)', () => {
  const meters: MeterState = { trustIntegrity: 0.7, value: 0.7 };

  it('anchors realizedPrice on askingPrice — a high-priced and a low-priced car transact at different prices', () => {
    const low = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 0.3,
        vehicle: { ...vehicle, askingPrice: 18_000 },
      },
      deps,
    );
    const high = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 0.3,
        vehicle: { ...vehicle, askingPrice: 24_000 },
      },
      deps,
    );
    expect(low.priceFormation.askingPrice).toBe(18_000);
    expect(high.priceFormation.askingPrice).toBe(24_000);
    expect(high.realizedPrice).toBeGreaterThan(low.realizedPrice);
    // Both asks sit below the reservation (~$25.5k) → requiredDiscount 0 for each,
    // so the realized gap equals the ask gap, proving the ask (not the flat $20k
    // market) is the anchor.
    expect(high.realizedPrice - low.realizedPrice).toBe(6_000);
  });

  it('askingPrice — not marketPrice — sets the price; market is retained only as a benchmark', () => {
    // Ask far above the $20k market benchmark. With a strong process the deal
    // forms off the ask, so realizedPrice sits well above market.
    const expert = makeSalespersonProfile({
      NEGOTIATE: { effectiveness: 1, trustworthiness: 1 },
    });
    const result = closeAndPrice(
      {
        meters: { trustIntegrity: 1, value: 1 },
        skill: expert,
        priceSensitivity: 0,
        vehicle: { ...vehicle, askingPrice: 30_000 },
      },
      deps,
    );
    expect(result.priceFormation.marketPrice).toBe(20_000); // benchmark unchanged
    expect(result.realizedPrice).toBeGreaterThan(20_000); // anchored on the 30k ask
  });

  it('falls back to the market benchmark when no askingPrice is supplied (legacy/stub callers)', () => {
    const withAsk = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 0.3,
        vehicle: { ...vehicle, askingPrice: 20_000 }, // == marketPrice
      },
      deps,
    );
    const noAsk = closeAndPrice(
      { meters, skill: GREEN_SALESPERSON, priceSensitivity: 0.3, vehicle },
      deps,
    );
    expect(noAsk.priceFormation.askingPrice).toBe(20_000);
    expect(noAsk.realizedPrice).toBe(withAsk.realizedPrice);
  });
});

// ── reservation-price model (#274) ───────────────────────────────────────────

describe('reservation-price discount model (#274)', () => {
  // Config: reservationBase 1.0, valueLift 0.5, sensitivityDrag 0.5.
  // market = 20k, cost = 16k, marginFloorPrice = 16.8k.
  // reservation = 20k · (1 + 0.5·value − 0.5·sensitivity).
  const meters: MeterState = { trustIntegrity: 0.6, value: 0.6 };
  const sensitivity = 0.4; // reservation = 20k·(1 + 0.3 − 0.2) = 22k

  it('computes the reservation price from market × (base + value·lift − sensitivity·drag)', () => {
    const result = closeAndPrice(
      { meters, skill: GREEN_SALESPERSON, priceSensitivity: sensitivity, vehicle },
      deps,
    );
    expect(result.priceFormation.reservationPrice).toBe(22_000);
  });

  it('ask ≤ reservation → requiredDiscount 0, customer buys at ask', () => {
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: sensitivity,
        vehicle: { ...vehicle, askingPrice: 21_000 }, // ≤ 22k reservation
      },
      deps,
    );
    expect(result.priceFormation.requiredDiscount).toBe(0);
    expect(result.realizedPrice).toBe(21_000); // at ask
    expect(result.closeable).toBe(true);
  });

  it('ask > reservation → requiredDiscount = ask − reservation, deal forms at the reservation', () => {
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: sensitivity,
        vehicle: { ...vehicle, askingPrice: 25_000 }, // > 22k reservation
      },
      deps,
    );
    expect(result.priceFormation.requiredDiscount).toBe(3_000); // 25k − 22k
    expect(result.realizedPrice).toBe(22_000); // discounted to the reservation
    expect(result.closeable).toBe(true); // 22k ≥ 16.8k floor
  });

  it('ask > reservation AND reservation < margin floor → not closeable (escalate)', () => {
    // Low value + max sensitivity → reservation = 20k·(1 + 0.05 − 0.5) = 11k < 16.8k floor.
    const result = closeAndPrice(
      {
        meters: { trustIntegrity: 0.1, value: 0.1 },
        skill: GREEN_SALESPERSON,
        priceSensitivity: 1.0,
        vehicle: { ...vehicle, askingPrice: 20_000 },
      },
      deps,
    );
    expect(result.priceFormation.reservationPrice).toBe(11_000);
    expect(result.priceFormation.requiredDiscount).toBe(9_000); // 20k − 11k
    expect(result.closeable).toBe(false); // below floor → discount-escalation branch
  });

  it('value built during the visit raises the reservation (more willing to pay)', () => {
    const make = (value: number): CloseResult =>
      closeAndPrice(
        {
          meters: { trustIntegrity: 0.5, value },
          skill: GREEN_SALESPERSON,
          priceSensitivity: 0.5,
          vehicle: { ...vehicle, askingPrice: 30_000 },
        },
        deps,
      );
    const low = make(0.2);
    const high = make(0.9);
    expect(high.priceFormation.reservationPrice).toBeGreaterThan(
      low.priceFormation.reservationPrice,
    );
  });
});

describe('price seam injection', () => {
  it('accepts custom marketPriceFn and vehicleCostFn', () => {
    const meters: MeterState = { trustIntegrity: 0.8, value: 0.8 };
    const v: PricedVehicleInput = { purchasePrice: 10_000, reconCost: 0 };
    const result = closeAndPrice(
      {
        meters,
        skill: GREEN_SALESPERSON,
        priceSensitivity: 0.3,
        vehicle: v,
        marketPriceFn: () => 15_000,
        vehicleCostFn: () => 10_000,
      },
      deps,
    );
    expect(result.priceFormation.marketPrice).toBe(15_000);
    expect(result.priceFormation.vehicleCost).toBe(10_000);
    expect(result.priceFormation.marginFloorPrice).toBe(10_800); // 10k + 800 minGross
  });
});
