/**
 * Market-state read-model for the KPI dashboard (#179, parent #150).
 *
 * Pure, presentation-layer aggregation over the MarketEconomy + Inventory reads.
 * No game logic, no EventBus, no imports of game internals — the composition
 * root (`src/app/config.ts buildMarketState`) resolves the narrow inputs from
 * `world` and calls these builders, exactly as `buildHeatConsole` does for the
 * demand console. Kept separate from the `game/KPIDashboard` deal-log read-model
 * (which stays narrow) — this is a distinct concern (valuation + market weather).
 */

/**
 * A segment's used-value pressure relative to baseline. `segmentHeat` is a
 * signed fractional bookValue modifier; the band names the axis in plain terms
 * (above / at / below baseline) rather than temperature words.
 */
export type ValueBand =
  | 'strong-above'
  | 'above'
  | 'neutral'
  | 'below'
  | 'strong-below';

export interface ValueBandEdges {
  /** |heat| at/above which a segment reads mildly above/below baseline. */
  readonly mild: number;
  /** |heat| at/above which a segment reads strongly above/below baseline. */
  readonly strong: number;
}

/** One segment row of the used-value pressure map, with its factor breakdown. */
export interface SegmentHeatCell {
  readonly segment: string;
  readonly label: string;
  /** Total segmentHeat = personality + drift + shock (signed fraction). */
  readonly heat: number;
  readonly personality: number;
  readonly drift: number;
  readonly shock: number;
  readonly band: ValueBand;
}

/** One affected segment inside an active shock. */
export interface ShockSegmentEffect {
  readonly label: string;
  /** Signed per-segment magnitude (fraction). */
  readonly magnitude: number;
}

export interface ActiveShockView {
  readonly instanceId: string;
  readonly label: string;
  /** Non-zero affected segments, strongest-magnitude first. */
  readonly segments: readonly ShockSegmentEffect[];
  /** Days the shock stays active, inclusive of the current day (≥ 0). */
  readonly daysRemaining: number;
}

export interface InventoryValuationView {
  readonly unitCount: number;
  readonly totalBook: number;
  readonly totalMarket: number;
  /** market − book across the lot. */
  readonly unrealizedGross: number;
  /** Sum of per-unit daily carrying burn × 7. */
  readonly weeklyCarryingBurn: number;
}

export interface StaleInventoryView {
  readonly staleCount: number;
  /** staleCount / unitCount (0 when the lot is empty). */
  readonly staleShare: number;
  /** Cost basis (purchase + recon) tied up in stale units. */
  readonly staleCost: number;
  readonly thresholdDays: number;
}

export interface MarketStateModel {
  readonly segmentHeat: readonly SegmentHeatCell[];
  readonly activeShocks: readonly ActiveShockView[];
  readonly valuation: InventoryValuationView;
  readonly stale: StaleInventoryView;
}

/** Classify a signed segmentHeat into its plain-language pressure band. */
export function classifyValueBand(heat: number, edges: ValueBandEdges): ValueBand {
  const magnitude = Math.abs(heat);
  if (magnitude < edges.mild) return 'neutral';
  if (heat > 0) return magnitude >= edges.strong ? 'strong-above' : 'above';
  return magnitude >= edges.strong ? 'strong-below' : 'below';
}

export interface SegmentHeatInputs {
  readonly segments: readonly string[];
  readonly labelFor: (segment: string) => string;
  readonly personalityFor: (segment: string) => number;
  readonly driftFor: (segment: string) => number;
  readonly shockFor: (segment: string) => number;
  readonly edges: ValueBandEdges;
}

/** Build the per-segment used-value pressure cells, hottest (most-above) first. */
export function buildSegmentHeatCells(inputs: SegmentHeatInputs): SegmentHeatCell[] {
  return inputs.segments
    .map((segment) => {
      const personality = inputs.personalityFor(segment);
      const drift = inputs.driftFor(segment);
      const shock = inputs.shockFor(segment);
      const heat = personality + drift + shock;
      return {
        segment,
        label: inputs.labelFor(segment),
        heat,
        personality,
        drift,
        shock,
        band: classifyValueBand(heat, inputs.edges),
      };
    })
    .sort((a, b) => b.heat - a.heat);
}

export interface ShockInstanceInput {
  readonly instanceId: string;
  readonly label: string;
  /** Last active day of the shock (auto-resolves the day past this). */
  readonly expectedEndDay: number;
  readonly segmentMagnitudes: Readonly<Record<string, number>>;
}

/** Build the active-shocks list with derived days-remaining + labeled effects. */
export function buildActiveShocks(
  instances: readonly ShockInstanceInput[],
  currentDay: number,
  labelFor: (segment: string) => string,
): ActiveShockView[] {
  return instances.map((inst) => ({
    instanceId: inst.instanceId,
    label: inst.label,
    // expectedEndDay is the last active day, so today counts → +1, floored at 0.
    daysRemaining: Math.max(0, inst.expectedEndDay - currentDay + 1),
    segments: Object.entries(inst.segmentMagnitudes)
      .filter(([, magnitude]) => magnitude !== 0)
      .map(([segment, magnitude]) => ({ label: labelFor(segment), magnitude }))
      .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude)),
  }));
}

export interface ValuationVehicleInput {
  /** Cost basis: purchasePrice + reconCost. */
  readonly cost: number;
  readonly book: number;
  readonly market: number;
  readonly dailyCarryingCost: number;
  readonly aged: boolean;
}

/** Aggregate lot-wide book / market / unrealized gross / weekly carrying burn. */
export function buildInventoryValuation(
  vehicles: readonly ValuationVehicleInput[],
): InventoryValuationView {
  let totalBook = 0;
  let totalMarket = 0;
  let dailyCarry = 0;
  for (const v of vehicles) {
    totalBook += v.book;
    totalMarket += v.market;
    dailyCarry += v.dailyCarryingCost;
  }
  return {
    unitCount: vehicles.length,
    totalBook,
    totalMarket,
    unrealizedGross: totalMarket - totalBook,
    weeklyCarryingBurn: dailyCarry * 7,
  };
}

/** Aggregate stale-inventory count / share / tied-up cost against the threshold. */
export function buildStaleInventory(
  vehicles: readonly ValuationVehicleInput[],
  thresholdDays: number,
): StaleInventoryView {
  const stale = vehicles.filter((v) => v.aged);
  const staleCost = stale.reduce((sum, v) => sum + v.cost, 0);
  return {
    staleCount: stale.length,
    staleShare: vehicles.length > 0 ? stale.length / vehicles.length : 0,
    staleCost,
    thresholdDays,
  };
}
