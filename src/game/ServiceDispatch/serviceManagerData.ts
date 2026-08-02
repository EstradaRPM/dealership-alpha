import { z } from 'zod';
import { parseData } from '../data';

/**
 * Service-manager automation tuning (#310, parent #297). The decision-function
 * knobs the on-staff service manager uses once its `shop_throughput` clears each
 * function's gate. Mirrors `data/sourcing.json` (channel-desk M6): the gate
 * THRESHOLDS live in `tunables.json#managerGates.serviceManager.actThresholds`;
 * the function TUNING lives in its own `data/service-manager.json`. All
 * magnitudes are placeholders pending the S14 calibration pass (#286).
 */
const ServiceManagerConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    // Demand-driven par tuning (cover-days against trailing intake demand).
    par: z
      .object({
        _doc: z.string().optional(),
        targetCoverDays: z.number().positive(),
        reorderCoverDays: z.number().nonnegative(),
        minTarget: z.number().int().nonnegative(),
        minReorderPoint: z.number().int().nonnegative(),
      })
      .strict(),
    // Reputation-driven competitive↔premium posture mapping.
    posture: z
      .object({
        _doc: z.string().optional(),
        reputationFloor: z.number().min(0).max(1),
        reputationCeil: z.number().min(0).max(1),
        minPosture: z.number().min(0).max(1),
        maxPosture: z.number().min(0).max(1),
      })
      .strict(),
    // Base-health / over-stock-driven marketing-arm selection.
    marketing: z
      .object({
        _doc: z.string().optional(),
        atRiskShareTrigger: z.number().min(0).max(1),
        overstockRatioTrigger: z.number().positive(),
      })
      .strict(),
    // Capacity-aware rush-vs-walk balancing against live shop utilization.
    capacity: z
      .object({
        _doc: z.string().optional(),
        utilizationRushCeiling: z.number().min(0).max(1),
      })
      .strict(),
  })
  .strict();

export type ServiceManagerConfig = z.infer<typeof ServiceManagerConfigSchema>;

export function loadServiceManagerConfig(): ServiceManagerConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/service-manager.json');
  return parseData(raw, ServiceManagerConfigSchema, 'data/service-manager.json');
}
