import { createProviders, type LiveProviders, type ProvidersDeps } from './providers';

/**
 * MarketEconomy — v1 slice #155 skeleton. Currently a thin handle over the
 * three live providers; future slices (#157 segment heat composer, #159 shock
 * scheduler, #176 news engine) bolt onto this same factory.
 */
export interface MarketEconomy extends LiveProviders {}

export interface MarketEconomyDeps extends ProvidersDeps {}

export function createMarketEconomy(deps: MarketEconomyDeps = {}): MarketEconomy {
  return createProviders(deps);
}
