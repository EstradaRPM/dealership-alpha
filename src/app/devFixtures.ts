import type { SaveState } from '../game/SaveStore';

// __DEV__ Tier-N fixtures (#248).
//
// Each entry is a committed mid-game world the #247 competent policy reached,
// captured at the first day of that tier as a normal `SaveState` (world
// snapshot + the harness founder + its seed). The dev MainMenu loads one into a
// fresh slot through the ordinary slot/restore path — no parallel loader — so a
// human can feel-test a tier without playing up from T1.
//
// Regenerate (fixtures go stale when the worldSnapshot envelope bumps):
//   npm run gen:fixtures
// See docs/balance-harness-recipe.md § "Tier-N dev fixtures".
//
// The `__DEV__` guard keeps the list (and the require'd JSON references) out of
// the live path in production — the dev menu entry is invisible there, matching
// the AdminConsole precedent.
//
// Only tiers with a committed fixture appear here. T3 is unreachable under the
// current un-tuned tier-gate thresholds (the climb game-overs first); once the
// #249 staff-teeth + threshold-tuning pass lands and `npm run gen:fixtures`
// writes data/fixtures/tier-3.json, add it below — one line, no other change.

export interface TierFixture {
  readonly tier: number;
  readonly state: SaveState;
}

export const TIER_FIXTURES: readonly TierFixture[] = __DEV__
  ? [
      {
        tier: 2,
        state: require('../../data/fixtures/tier-2.json') as SaveState,
      },
    ]
  : [];
