import rawNavTabs from '../../../data/nav-tabs.json';
import type { ShellTabKey } from './AppShell';

/**
 * The canonical, fixed 5-tab IA (fork 1, re-validated 2026-06-10). The nav is
 * NOT gated by tier — all five tabs are always present. Progression is altitude
 * rising inside each surface (spine §2), never tabs appearing or disappearing.
 * Home + Operations back live surfaces today; People/Finance/Growth are
 * placeholders until their per-surface rebrand slice lands.
 */
export interface NavTabDef {
  key: ShellTabKey;
  label: string;
  /** One-line description of what a strategic surface becomes (placeholder copy). */
  tagline?: string;
}

interface NavTabsFile {
  tabs: NavTabDef[];
}

/** The tab definitions, in canonical IA order. */
export function loadNavTabs(): NavTabDef[] {
  return (rawNavTabs as NavTabsFile).tabs;
}
