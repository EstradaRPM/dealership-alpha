import { createRng, deriveSeed, type SeedContext } from '../Rng';
import { parseData } from '../../data';
import {
  TradeIncidenceConfigSchema,
  type TradeIncidenceConfig,
} from '../schemas/trade-incidence';

export const TRADE_INCIDENCE_NAMESPACE = 'npc.customer.tradeIncidence';

export function loadTradeIncidenceConfig(): TradeIncidenceConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../../data/trade-incidence.json');
  return parseData(
    raw,
    TradeIncidenceConfigSchema,
    'data/trade-incidence.json',
  );
}

export interface RollHasTradeContext extends SeedContext {
  personArchetypeId: string;
  day: number;
  slot: number;
}

export interface RollHasTradeDeps {
  masterSeed: number;
  config: TradeIncidenceConfig;
  paymentMethod: 'cash' | 'finance';
  creditTier: 'A' | 'B' | 'C' | 'D';
}

/**
 * Roll a deterministic `hasTrade` flag for a sales visit. The same
 * `(masterSeed, personArchetypeId, day, slot, paymentMethod, creditTier)` always
 * produces the same outcome. Pure — no side effects.
 *
 * Trade probability is a composite of archetype × paymentMethod × creditTier:
 * financers trade far more than cash buyers (need to roll equity), and within
 * each payment band sub-prime trades more than prime.
 */
export function rollHasTrade(
  ctx: RollHasTradeContext,
  deps: RollHasTradeDeps,
): boolean {
  const { masterSeed, config, paymentMethod, creditTier } = deps;
  const profile = config.archetypes[ctx.personArchetypeId];
  if (!profile) {
    throw new Error(
      `rollHasTrade: no archetype profile for "${ctx.personArchetypeId}"`,
    );
  }
  const p = profile[paymentMethod][creditTier];
  const seed = deriveSeed(
    masterSeed,
    `${TRADE_INCIDENCE_NAMESPACE}.roll`,
    ctx,
  );
  return createRng(seed)() < p;
}
