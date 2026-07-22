export {
  createMarketIntel,
  createDefaultMarketIntelSnapshot,
  type MarketIntelDeps,
} from './MarketIntel';
export { resolveNewsAccess, gateHeadlines, fillHint } from './newsAccess';
export {
  loadNewsGatingConfig,
  type NewsGatingConfig,
  type NewsUnlock,
  type NewsLane,
} from './marketIntelConfig';
export type {
  MarketIntel,
  MarketIntelSnapshot,
  SubscriptionOption,
  NewsAccess,
  NewsAccessRead,
  NewsLock,
  UnlockKind,
  GateableHeadline,
  GatedHeadline,
} from './types';
