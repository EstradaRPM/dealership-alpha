import rawNavTabs from '../../../data/nav-tabs.json';
import type { ShellTabKey } from './AppShell';

/**
 * Progressive tier-gating for the 5-tab IA (#226). The shell's tab availability
 * is data-driven (`data/nav-tabs.json`), never a hardcoded list in App.tsx:
 *
 * - `revealTier` — the tier at which the tab first appears in the nav. Below it
 *   the tab is hidden entirely (this is what keeps T1 to Home + Operations, so
 *   the validated onboarding never faces five empty tabs on day one).
 * - `unlockTier` — the tier at which the tab goes live. Between reveal and
 *   unlock the tab shows as a `locked` teaser (visible, pressable, but its
 *   surface renders its locked/coming-soon state).
 */
export interface NavTabDef {
  key: ShellTabKey;
  label: string;
  revealTier: number;
  unlockTier: number;
  /** One-line description of what the unlocked surface becomes. */
  tagline?: string;
  /** Teaser copy shown while the tab is revealed-but-locked. */
  unlockHint?: string;
}

interface NavTabsFile {
  tabs: NavTabDef[];
}

export type ShellTabState = 'unlocked' | 'locked';

export interface ResolvedNavTab extends NavTabDef {
  state: ShellTabState;
}

/** The raw tab definitions, in canonical IA order. */
export function loadNavTabs(): NavTabDef[] {
  return (rawNavTabs as NavTabsFile).tabs;
}

/**
 * Pure tier → IA gate. Returns the tabs visible at `tier`, in order, each
 * tagged `unlocked` or `locked`. Hidden tabs (`tier < revealTier`) are omitted,
 * so the result is exactly the nav the player should see at that tier.
 */
export function resolveNavTabs(
  tier: number,
  defs: NavTabDef[] = loadNavTabs(),
): ResolvedNavTab[] {
  return defs
    .filter((d) => tier >= d.revealTier)
    .map((d) => ({
      ...d,
      state: tier >= d.unlockTier ? 'unlocked' : 'locked',
    }));
}
