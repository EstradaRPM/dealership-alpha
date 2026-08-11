import type { ReactNode } from 'react';
import rawNavTabs from '../../../data/nav-tabs.json';
import type { ShellTab, ShellTabKey } from './AppShell';

/**
 * The canonical, fixed 5-tab IA (fork 1, re-validated 2026-06-10). The nav is
 * NOT gated by tier — all five tabs are always present. Progression is altitude
 * rising inside each surface (spine §2), never tabs appearing or disappearing.
 * Every one of the five backs a real, built room (#378 deleted the last
 * placeholder surface); a tab with no room is a composition error, not a stub.
 */
export interface NavTabDef {
  key: ShellTabKey;
  label: string;
}

interface NavTabsFile {
  tabs: NavTabDef[];
}

/** The tab definitions, in canonical IA order. */
export function loadNavTabs(): NavTabDef[] {
  return (rawNavTabs as NavTabsFile).tabs;
}

/**
 * Bind each nav tab to the room the composition root built for it (#378).
 *
 * A tab with no composed content THROWS here rather than falling back to a
 * stub surface at render time. That fallback is what let a dead stub outlive
 * the rooms that replaced it — an unbuilt tab has to fail loudly at
 * composition, where whoever forgot to wire it is looking.
 */
export function composeShellTabs(
  defs: readonly NavTabDef[],
  content: Readonly<Record<ShellTabKey, ReactNode>>,
): ShellTab[] {
  return defs.map((tab) => {
    const room = content[tab.key];
    if (room === undefined) {
      throw new Error(
        `Nav tab "${tab.key}" has no composed room. Every tab in the fixed ` +
          `5-tab IA backs a real surface — wire it in the composition root ` +
          `instead of rendering a placeholder.`,
      );
    }
    return { key: tab.key, label: tab.label, content: room };
  });
}
