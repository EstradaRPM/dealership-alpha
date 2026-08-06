import { z } from 'zod';
import { parseData } from './game/data';
import type { DeptCapacityConfig } from './game/ServiceDispatch';

/**
 * Body-Shop dispatch config (#314, parent #297). The Tier-3 pricing/capacity
 * tunables fed into the shared department-dispatch engine. Mirrors the capacity/
 * auto/CSI knobs of `serviceDispatch` (so the config satisfies the engine's
 * `DeptCapacityConfig`) and ADDS the channel-posture pricing knobs — there is no
 * competitive↔premium dial here. Insurance jobs are rate-capped
 * (`insuranceRateMultiplier`, ~1.0 pass-through over CollisionStream's already-
 * capped baseRevenue), retail jobs are player-priced
 * (`lerp(retailFloorMultiplier, retailCeilMultiplier, posture)`).
 */
const BodyShopDispatchConfigSchema = z.object({
  minAutoResolveRate: z.number().min(0).max(1),
  maxAutoResolveRate: z.number().min(0).max(1),
  minPerSlotThroughput: z.number().min(0),
  maxPerSlotThroughput: z.number().min(0),
  // (#358 deleted `baysByTier` from here and from data/tunables.json — body bays
  // are built, persisted `Facility` state handed to the shared engine as `bays`,
  // the same one bay truth the Service line reads.)
  maxWaitTicks: z.number().int().min(1),
  unservedCsiHit: z.number().min(0),
  // The tier at/above which the rush emergency-order path unlocks (mirrors
  // serviceDispatch.rushUnlockTier — the operation-maturity gate).
  rushUnlockTier: z.number().int().min(1),
  missCsiHit: z.number().min(0),
  // Channel-posture pricing. Insurance (DRP) is rate-capped — the player can't
  // mark it up — so the multiplier is a ~1.0 pass-through over the already-capped
  // baseRevenue. Retail is player-priced: the live channel posture [0,1] lerps
  // between the floor and ceiling markup.
  insuranceRateMultiplier: z.number().min(0),
  retailFloorMultiplier: z.number().min(0),
  retailCeilMultiplier: z.number().min(0),
});

export type BodyShopDispatchConfig = z.infer<typeof BodyShopDispatchConfigSchema>;

// Compile-time check that the config satisfies the engine's capacity contract.
const _capacitySatisfied = (c: BodyShopDispatchConfig): DeptCapacityConfig => c;
void _capacitySatisfied;

export function loadBodyShopDispatchConfig(): BodyShopDispatchConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../data/tunables.json') as { bodyShopDispatch: unknown })
    .bodyShopDispatch;
  return parseData(
    raw,
    BodyShopDispatchConfigSchema,
    'data/tunables.json#bodyShopDispatch',
  );
}
