import React, { useState } from 'react';
import type { World } from '../../createWorld';
import type { TabStacks } from '../../ui/Navigator';
import type { ShellTabKey } from '../../ui/AppShell';
import {
  FinanceTab,
  buildFinanceDashboard,
  buildCreditFacilityPanel,
  creditDrawNotice,
  creditRepayNotice,
  financeRangeWindow,
  financePriorWindow,
  financeHasPriorWindow,
  type FinanceRangeId,
} from '../../ui/FinanceTab';
import { buildStoreWorth } from '../../ui/StoreWorth';
import { buildMarketState } from '../config';
import type { Hints } from '../useHints';

export interface FinanceTabContainerProps {
  world: World;
  /** Per-tab stacks (#348) — the two sibling screens push onto Finance's own. */
  tabs: TabStacks<ShellTabKey>;
  /** The teaching cluster (#386/#388) — resolved here, marked on each write. */
  hints: Hints;
  /** Force a re-render after a world write the EventBus doesn't announce. */
  bump: () => void;
  /**
   * Sync the shell's cash mirror after a world write that moves money (#393) —
   * the same prop `GrowthTabContainer` takes for a build, and for the same
   * reason: a draw lands cash the HUD would otherwise keep the old figure for.
   */
  setCash: (n: number) => void;
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
export function FinanceTabContainer({
  world,
  tabs,
  hints,
  bump,
  setCash,
}: FinanceTabContainerProps) {
  const [rangeId, setRangeId] = useState<FinanceRangeId>('today');
  const currentDay = world.clock.currentDay;
  const window = financeRangeWindow(rangeId, currentDay);
  const prior = financePriorWindow(rangeId, currentDay);
  // A prior window that does not fit entirely inside the career never happened
  // at full length, so the deltas are suppressed rather than compared against a
  // shorter period (#376 — a clamped prior window is a *different span*, and a
  // seven-day window against three real days reports a collapse that is only
  // the clamp).
  const hasPriorWindow = financeHasPriorWindow(rangeId, currentDay);
  const priorClamped = { fromDay: Math.max(1, prior.fromDay), toDay: Math.max(1, prior.toDay) };

  const model = buildFinanceDashboard({
    rangeId,
    currentDay,
    kpi: world.kpiDashboard.getSnapshot(window),
    priorKpi: world.kpiDashboard.getSnapshot(priorClamped),
    pnl: world.economy.getPnL(window.fromDay, window.toDay),
    priorPnl: world.economy.getPnL(priorClamped.fromDay, priorClamped.toDay),
    departmentPnl: world.economy.getDepartmentPnL(window.fromDay, window.toDay),
    daily: world.kpiDashboard.getDailyTotals(window),
    hasPriorWindow,
  });

  return (
    <FinanceTab
      model={model}
      // #380: a POSITION, not a window — read off the engine's one getter, the
      // same call the Home HUD's headline pair is built from, so the two rooms
      // can never state two totals.
      storeWorth={buildStoreWorth(world.getStoreWorth())}
      // #393: the facility, read the same way — a position, off the module's
      // one `getFacility()`. `null` for a store whose line is worth nothing, and
      // the room simply draws no panel.
      creditFacility={buildCreditFacilityPanel(world.creditFacility.getFacility())}
      onDrawCredit={(amount) => {
        // The engine owns every rule the button could get wrong — the ceiling,
        // the affordability, what a refusal costs (nothing) — so this commits
        // and reports back rather than guarding first, the #359 shape. The
        // notice is built against the state the refusal was decided from, so
        // the headroom the player is told is the one the next press is judged
        // against.
        const result = world.creditFacility.draw(amount);
        if (!result.ok) {
          return creditDrawNotice(result.reason, world.creditFacility.getFacility());
        }
        hints.markUsed('credit_line');
        setCash(world.economy.cash);
        bump();
        return null;
      }}
      onRepayCredit={(amount) => {
        const result = world.creditFacility.repay(amount);
        if (!result.ok) {
          return creditRepayNotice(result.reason, world.creditFacility.getFacility());
        }
        hints.markUsed('credit_line');
        setCash(world.economy.cash);
        bump();
        return null;
      }}
      creditHint={hints.hintFor('credit_line')}
      marketState={buildMarketState(world)}
      onSelectRange={setRangeId}
      onOpenHistory={() => tabs.navigate('dealHistory')}
      onOpenMonthResults={() => tabs.navigate('monthResults')}
    />
  );
}
