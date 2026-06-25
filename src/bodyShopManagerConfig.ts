import { z } from 'zod';
import { parseData } from './game/data/loadJson';

/**
 * Body-shop-manager automation tuning (#316, parent #297). The decision-function
 * knobs the on-staff body-shop manager uses once its `shop_throughput` clears each
 * function's gate. The Tier-3 mirror of `data/service-manager.json`: the gate
 * THRESHOLDS live in `tunables.json#managerGates.bodyShopManager.actThresholds`;
 * the function TUNING lives in its own `data/body-shop-manager.json`.
 *
 * The one structural difference from the service-manager config: the Body Shop's
 * single pricing/marketing lever is the insurance↔retail `channel` posture (the
 * locked satellite table's "channel choice — no separate mailer arms"), so this
 * config has a `channel` block where the service-manager config has separate
 * `posture` + `marketing` blocks. All magnitudes are placeholders pending the S14
 * calibration pass (#286).
 */
const BodyShopManagerConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    _doc: z.string().optional(),
    // Demand-driven par tuning (cover-days against trailing collision demand).
    par: z
      .object({
        _doc: z.string().optional(),
        targetCoverDays: z.number().positive(),
        reorderCoverDays: z.number().nonnegative(),
        minTarget: z.number().int().nonnegative(),
        minReorderPoint: z.number().int().nonnegative(),
      })
      .strict(),
    // Reputation-driven insurance↔retail channel posture mapping (the unified
    // pricing+marketing lever).
    channel: z
      .object({
        _doc: z.string().optional(),
        reputationFloor: z.number().min(0).max(1),
        reputationCeil: z.number().min(0).max(1),
        minPosture: z.number().min(0).max(1),
        maxPosture: z.number().min(0).max(1),
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

export type BodyShopManagerConfig = z.infer<typeof BodyShopManagerConfigSchema>;

export function loadBodyShopManagerConfig(): BodyShopManagerConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../data/body-shop-manager.json');
  return parseData(
    raw,
    BodyShopManagerConfigSchema,
    'data/body-shop-manager.json',
  );
}
