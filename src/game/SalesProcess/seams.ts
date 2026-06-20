import { GATES, type Gate } from './salesProcessData';

/**
 * Injected seam interfaces (PRD #85 decisions 2, 7, 8). The evaluator never
 * learns staff names, real prices, or the dynamic economy — it consumes these
 * narrow seams. It ships trivial static stubs; StaffOrg wiring and the dynamic
 * internal economy are tracked follow-ons that drop in without evaluator change.
 */

/** Per-gate composite skill (PRD decision 7). Both axes are unit-scaled. */
export interface GateSkill {
  readonly effectiveness: number;
  readonly trustworthiness: number;
}

/** Seam: resolves the acting salesperson's composite skill for a gate. */
export interface SalespersonSkill {
  skillFor(gate: Gate): GateSkill;
}

/**
 * Narrow structural vehicle input the price seams need. Inventory's
 * `LotVehicle` satisfies it without an explicit module dependency.
 */
export interface PricedVehicleInput {
  readonly purchasePrice: number;
  readonly reconCost: number;
}

/** Seam: static market price (PRD decision 8 — dynamic economy is a follow-on). */
export type MarketPriceFn = (vehicle: PricedVehicleInput) => number;

/** Seam: static all-in vehicle cost (PRD decision 8). */
export type VehicleCostFn = (vehicle: PricedVehicleInput) => number;

/**
 * Seam: static book value (wholesale reference). Distinct from cost basis and
 * market price so LTV affordability checks have their own anchor. Dynamic
 * internal-economy follow-on (PRD #85 decision 8) drops in as a swap.
 */
export type BookValueFn = (vehicle: PricedVehicleInput) => number;

const clampUnit = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Hardcoded "green salesperson" profile (PRD decision 2): a fresh solo operator
 * — modest effectiveness, middling trustworthiness, uniform across gates.
 */
export const GREEN_SALESPERSON_SKILL: GateSkill = {
  effectiveness: 0.35,
  trustworthiness: 0.4,
};

export const GREEN_SALESPERSON: SalespersonSkill = {
  skillFor: () => GREEN_SALESPERSON_SKILL,
};

/**
 * Admin-console override path (PRD decision 2): build a profile from a base
 * (defaults to green) with optional per-gate partial overrides. Values are
 * unit-clamped so an override can't push skill out of range.
 */
export function makeSalespersonProfile(
  overrides: Partial<Record<Gate, Partial<GateSkill>>> = {},
  base: GateSkill = GREEN_SALESPERSON_SKILL,
): SalespersonSkill {
  const resolved = {} as Record<Gate, GateSkill>;
  for (const gate of GATES) {
    const o = overrides[gate] ?? {};
    resolved[gate] = {
      effectiveness: clampUnit(o.effectiveness ?? base.effectiveness),
      trustworthiness: clampUnit(o.trustworthiness ?? base.trustworthiness),
    };
  }
  return { skillFor: (gate) => resolved[gate] };
}

/**
 * Static cost stub: all-in = acquisition + recon. Deliberately trivial;
 * the dynamic auction↔trade↔retail economy is a spun-off follow-on (decision 8).
 */
export const staticVehicleCost: VehicleCostFn = (v) =>
  v.purchasePrice + v.reconCost;

/** Static market markup over all-in cost. Placeholder seam, not a balance knob. */
const STATIC_MARKET_MARKUP = 1.25;

/** Static market-price stub (decision 8). */
export const staticMarketPrice: MarketPriceFn = (v) =>
  Math.round(staticVehicleCost(v) * STATIC_MARKET_MARKUP);

/**
 * Static book-value stub: acquisition cost ≈ wholesale book for healthy
 * auction buys. Reconditioning is value-add, not book.
 */
export const staticBookValue: BookValueFn = (v) => v.purchasePrice;
