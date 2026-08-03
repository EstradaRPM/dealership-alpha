import React, { useState } from 'react';
import type { World } from '../../createWorld';
import type { TabStacks } from '../../ui/Navigator';
import type { ShellTabKey } from '../../ui/AppShell';
import {
  FinanceTab,
  buildFinanceDashboard,
  financeRangeWindow,
  financePriorWindow,
  type FinanceRangeId,
} from '../../ui/FinanceTab';
import { buildMarketState } from '../config';

export interface FinanceTabContainerProps {
  world: World;
  /** Per-tab stacks (#348) — the two sibling screens push onto Finance's own. */
  tabs: TabStacks<ShellTabKey>;
}

/**
 * Finance's composition seam (#351). Reads the live world each render — no
 * memo, no world state of its own — exactly the shape `GrowthTabContainer`
 * established.
 *
 * The selected time range is **view state, not world state**: it is a lens over
 * numbers the engine already owns, not a decision the player made, so it lives
 * here and is never persisted. Everything it selects comes back off the engine's
 * own range reads — `kpiDashboard.getSnapshot(window)`,
 * `kpiDashboard.getDailyTotals(window)` and `economy.getPnL(from, to)` — so the
 * dashboard never re-derives a number the modules already compute.
 */
export function FinanceTabContainer({ world, tabs }: FinanceTabContainerProps) {
  const [rangeId, setRangeId] = useState<FinanceRangeId>('today');
  const currentDay = world.clock.currentDay;
  const window = financeRangeWindow(rangeId, currentDay);
  const prior = financePriorWindow(rangeId, currentDay);
  // A prior window that ends before day 1 never happened, so the deltas are
  // suppressed rather than compared against a period the career did not have.
  const hasPriorWindow = prior.toDay >= 1;
  const priorClamped = { fromDay: Math.max(1, prior.fromDay), toDay: prior.toDay };

  const model = buildFinanceDashboard({
    rangeId,
    currentDay,
    kpi: world.kpiDashboard.getSnapshot(window),
    priorKpi: world.kpiDashboard.getSnapshot(priorClamped),
    pnl: world.economy.getPnL(window.fromDay, window.toDay),
    priorPnl: world.economy.getPnL(priorClamped.fromDay, priorClamped.toDay),
    daily: world.kpiDashboard.getDailyTotals(window),
    hasPriorWindow,
  });

  return (
    <FinanceTab
      model={model}
      marketState={buildMarketState(world)}
      onSelectRange={setRangeId}
      onOpenHistory={() => tabs.navigate('dealHistory')}
      onOpenMonthResults={() => tabs.navigate('monthResults')}
    />
  );
}
