import { z } from 'zod';
import { parseData } from '../data';

const ServiceDispatchConfigSchema = z.object({
  minAutoResolveRate: z.number().min(0).max(1),
  maxAutoResolveRate: z.number().min(0).max(1),
  // #305 pricing-posture revenue. The per-ticket revenue multiplier on
  // baseRevenue at the two ends of the single competitive↔premium dial
  // (labor rate + parts markup, modeled together). posture 0 ⇒ competitive,
  // posture 1 ⇒ premium; the live multiplier lerps between them. Replaces the
  // retired flat upsell multiplier. Placeholders pending calibration (#286).
  competitivePriceMultiplier: z.number().min(0),
  premiumPriceMultiplier: z.number().min(0),
  // #305 per-slot floor-drain throughput: service jobs ONE bay/advisor slot
  // works per FloorSim tick, lerped by that slot's advisor effectiveness.
  // Day throughput = sum over the min(bays, advisors) busiest slots.
  // Fractional; accumulated across ticks. (Was min/maxDrainPerTick — a single
  // shop-wide rate; now per-slot so concurrency scales with bays AND staff.)
  minPerSlotThroughput: z.number().min(0),
  maxPerSlotThroughput: z.number().min(0),
  // (#358 deleted `baysByTier` from here and from data/tunables.json. The bay
  // count is no longer a per-tier constant this config owns: it is built,
  // persisted state on the `Facility` module, handed to the engine as the `bays`
  // dep. The tier's number became the ceiling, not the answer.)
  // #305 the FloorSim-tick age at which a still-waiting job leaves UNSERVED
  // (capacity starvation, distinct from a parts miss). Placeholder pending #286.
  maxWaitTicks: z.number().int().min(1),
  // #305 the CSI hit an unserved (capacity-starved, timed-out) job emits.
  // Placeholder magnitude pending calibration (#286).
  unservedCsiHit: z.number().min(0),
  // #304 parts gate. The tier at/above which the rush emergency-order path is
  // unlocked (PRD #297 story 13 — "as my operation matures"); below it an
  // under-stock job is a flat miss. Placeholder pending calibration (#286).
  rushUnlockTier: z.number().int().min(1),
  // The CSI hit a missed (under-stocked, turned-away) job emits, feeding base
  // health / Reputation. Placeholder magnitude pending calibration (#286).
  missCsiHit: z.number().min(0),
});

export type ServiceDispatchConfig = z.infer<typeof ServiceDispatchConfigSchema>;

export function loadServiceDispatchConfig(): ServiceDispatchConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = (require('../../../data/tunables.json') as { serviceDispatch: unknown }).serviceDispatch;
  return parseData(raw, ServiceDispatchConfigSchema, 'data/tunables.json#serviceDispatch');
}
