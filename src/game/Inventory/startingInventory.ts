import { z } from 'zod';
import { parseData } from '../data';
import { createRng, deriveSeed } from '../Rng';
import { loadVehicleData, type VehicleData } from './vehicleData';
import type { VehicleCategory, VehicleCondition } from './types';

/**
 * Day-one frontline seed (#296). New saves otherwise start with an empty lot and
 * bootstrap entirely from the auction board, so nothing is frontline-ready at
 * open. This generates a small, fair, frontline-ready starting lot: three fixed
 * body-type slots (1 SUV / 1 truck / 1 sedan), one unit on each axis of the
 * demand heat-map, so the player can match *some* walk-in from minute one
 * regardless of which type strolls in.
 *
 * "Unique within reason, no seed lottery": each slot draws a value-banded
 * template (per-slot target retail ± tight tolerance) so total starting equity
 * barely moves between saves — no beater trio, no jackpot trio. Condition is
 * capped to clean/average (never rough); only make/year/mileage vary for flavor.
 * Deterministic from `masterSeed` (replay-safe, #122) and persisted via the
 * Inventory snapshot.
 */

// Seed units never ship `rough` (no hidden-lemon tail in the starter set).
const SeedConditionSchema = z.enum(['clean', 'average']);

const StartingSlotSchema = z.object({
  category: z.enum(['sedan', 'truck', 'suv']),
  /** Per-slot retail the value band centers on. */
  targetRetail: z.number().positive(),
  /** Half-width of the band as a fraction of `targetRetail`. */
  tolerancePct: z.number().positive(),
  /** Conditions a seed unit may roll (capped to clean/average). */
  allowedConditions: z.array(SeedConditionSchema).nonempty(),
});

// Not `.strict()`: the JSON carries a `_doc` annotation that Zod strips.
const StartingInventoryConfigSchema = z.object({
  schemaVersion: z.literal(1),
  /** Deterministic candidate draws per slot before falling back to closest. */
  candidateTrials: z.number().int().positive(),
  slots: z.array(StartingSlotSchema).nonempty(),
});

export type StartingSlot = z.infer<typeof StartingSlotSchema>;
export type StartingInventoryConfig = z.infer<typeof StartingInventoryConfigSchema>;

export function loadStartingInventoryConfig(): StartingInventoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/starting-inventory.json');
  return parseData(
    raw,
    StartingInventoryConfigSchema,
    'data/starting-inventory.json',
  );
}

/**
 * Candidate shape handed to the injected value providers. Carries every anchor
 * field MarketEconomy's book/retail providers read (the cost/recon fields are
 * placeholder zeros — valuation ignores them) so the composition root can adapt
 * its live providers at the boundary without MarketEconomy leaking in here.
 */
export interface SeedCandidateVehicle {
  readonly templateId: string;
  readonly brand: string;
  readonly make: string;
  readonly model: string;
  readonly trim: string;
  readonly year: number;
  readonly mileage: number;
  readonly category: VehicleCategory;
  readonly condition: VehicleCondition;
  readonly purchasePrice: number;
  readonly reconCost: number;
}

/**
 * One resolved seed unit — the lightweight spec Inventory builds a recon-complete
 * `LotVehicle` from. `purchasePrice` is the cost basis (live book value: what the
 * dealer "paid"), `suggestedRetail` the live market retail (the default ask), and
 * `reconEstimate` the condition-tier recon budget (fully sunk on a recon-complete
 * unit).
 */
export interface StartingInventorySpec {
  readonly id: string;
  readonly templateId: string;
  readonly brand: string;
  readonly make: string;
  readonly model: string;
  readonly trim: string;
  readonly year: number;
  readonly mileage: number;
  readonly category: VehicleCategory;
  readonly condition: VehicleCondition;
  readonly conditionReport: string;
  readonly purchasePrice: number;
  readonly reconEstimate: number;
  readonly suggestedRetail: number;
}

export interface GenerateStartingInventoryDeps {
  readonly masterSeed: number;
  /** Live wholesale/book provider — sets each seed unit's cost basis. */
  readonly bookValueFn: (v: SeedCandidateVehicle) => number;
  /** Live market-retail provider — the band is judged on this, and it sets the default ask. */
  readonly retailValueFn: (v: SeedCandidateVehicle) => number;
  readonly vehicleData?: VehicleData;
  readonly config?: StartingInventoryConfig;
}

function lerpInt(min: number, max: number, t: number): number {
  return Math.round(min + (max - min) * t);
}

/**
 * Generate the opening lot specs (one per configured slot). Pure + deterministic
 * in `(masterSeed, value providers)`. For each slot, draws `candidateTrials`
 * value-banded candidates and takes the first whose live retail lands in the
 * slot's band (closest-to-target if none do, so generation never fails), then
 * stamps the cost basis (book) + recon budget (condition tier).
 */
export function generateStartingInventory(
  deps: GenerateStartingInventoryDeps,
): StartingInventorySpec[] {
  const vehicleData = deps.vehicleData ?? loadVehicleData();
  const config = deps.config ?? loadStartingInventoryConfig();
  const { templates, conditionTiers } = vehicleData;

  const specs: StartingInventorySpec[] = [];

  config.slots.forEach((slot, slotIndex) => {
    const pool = templates.filter((t) => t.category === slot.category);
    if (pool.length === 0) return; // defensive: no template for the category

    const lo = slot.targetRetail * (1 - slot.tolerancePct);
    const hi = slot.targetRetail * (1 + slot.tolerancePct);

    let closest: { cand: SeedCandidateVehicle; retail: number; book: number; dist: number } | null =
      null;
    let inBand: { cand: SeedCandidateVehicle; retail: number; book: number } | null = null;

    for (let trial = 0; trial < config.candidateTrials && !inBand; trial++) {
      const rng = createRng(
        deriveSeed(deps.masterSeed, 'inventory.starting_seed', {
          slot: slotIndex,
          trial,
        }),
      );
      const template = pool[Math.floor(rng() * pool.length) % pool.length];
      const condition =
        slot.allowedConditions[
          Math.floor(rng() * slot.allowedConditions.length) %
            slot.allowedConditions.length
        ];
      const year = lerpInt(template.yearRange[0], template.yearRange[1], rng());
      const mileage =
        Math.round(
          lerpInt(template.mileageRange[0], template.mileageRange[1], rng()) / 500,
        ) * 500;

      const cand: SeedCandidateVehicle = {
        templateId: template.id,
        brand: template.brand,
        make: template.make,
        model: template.model,
        trim: template.trim,
        year,
        mileage,
        category: template.category,
        condition,
        purchasePrice: 0,
        reconCost: 0,
      };
      const retail = Math.max(0, Math.round(deps.retailValueFn(cand)));
      const book = Math.max(0, Math.round(deps.bookValueFn(cand)));
      const dist = Math.abs(retail - slot.targetRetail);
      if (!closest || dist < closest.dist) closest = { cand, retail, book, dist };
      if (retail >= lo && retail <= hi) inBand = { cand, retail, book };
    }

    const chosen = inBand ?? closest!;
    const tier = conditionTiers[chosen.cand.condition];
    specs.push({
      id: `seed-${slotIndex}-${slot.category}`,
      templateId: chosen.cand.templateId,
      brand: chosen.cand.brand,
      make: chosen.cand.make,
      model: chosen.cand.model,
      trim: chosen.cand.trim,
      year: chosen.cand.year,
      mileage: chosen.cand.mileage,
      category: chosen.cand.category,
      condition: chosen.cand.condition,
      conditionReport: tier.report,
      purchasePrice: chosen.book,
      reconEstimate: tier.reconCost,
      suggestedRetail: chosen.retail,
    });
  });

  return specs;
}
