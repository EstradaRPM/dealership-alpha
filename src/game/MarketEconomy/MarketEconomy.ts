import { createProviders, type LiveProviders, type ProvidersDeps } from './providers';
import {
  NEUTRAL_PERSONALITY,
  rollPersonalityVector,
  type MarketPersonalityVector,
} from './personality';

/**
 * MarketEconomy — slice #155/#156 surface. Currently exposes the three live
 * providers + the per-save personality vector. Future slices (#157 segment
 * heat composer, #159 shock scheduler, #176 news engine) bolt onto this same
 * factory.
 */
export interface MarketEconomy extends LiveProviders {
  /**
   * The per-save personality vector this MarketEconomy is using. Exposed so
   * downstream slices (calibration tests, the future news engine, KPI surface)
   * can read the active bias without going back through the masterSeed.
   */
  readonly personality: MarketPersonalityVector;
}

export interface MarketEconomyDeps extends ProvidersDeps {
  /**
   * Per-save root seed (#96). When provided, the personality vector is rolled
   * deterministically from it. Omit to get the neutral (population-mean) world
   * — that path is used by the #94 calibration test, the static-stub
   * fixtures, and any test that wants a deterministic engine without
   * personality variance.
   */
  readonly masterSeed?: number;
}

export function createMarketEconomy(deps: MarketEconomyDeps = {}): MarketEconomy {
  const personality =
    deps.personality ??
    (deps.masterSeed !== undefined
      ? rollPersonalityVector(deps.masterSeed)
      : NEUTRAL_PERSONALITY);
  const providers = createProviders({ ...deps, personality });
  return { ...providers, personality };
}
