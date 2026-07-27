import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EventBus } from '../../game/EventBus';
import type { World } from '../../createWorld';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { SaveStore } from '../../game/SaveStore';
import type { PlaytestContext, PlaytestLog } from '../../game/PlaytestLog';
import { attachPlaytestCapture } from '../../game/PlaytestLog';
import { PlaytestFlag } from '../../ui/PlaytestFlag';
import { TradeEscalationModal } from '../../ui/TradeEscalationModal';
import { DiscountEscalationModal } from '../../ui/DiscountEscalationModal';
import { DayRecapModal } from '../../ui/DayRecap';
import { MonthCloseInterstitial } from '../../ui/MonthCloseInterstitial';
import { ChapterCard, RecoveryBeatCard } from '../../ui/NarrativeBeat';
import { AdminConsole } from '../../ui/AdminConsole';
import type { Modals } from '../useModals';
import type { DayLoop } from '../useDayLoop';

export interface AppOverlaysProps {
  modals: Modals;
  dayLoop: DayLoop;
  world: World | null;
  profile: CharacterProfile | null;
  bus: EventBus;
  saveStore: SaveStore;
  /** #74 playtest recorder (#332). */
  playtestLog: PlaytestLog;
  handleSaveCleared: () => void;
  bump: () => void;
}

// The full-bleed overlay channel layered above the Navigator (#242 extraction):
// hand-play / trade / discount spotlights, the day-close recap beat, and the
// month-close / chapter / end-of-career interrupts, plus the dev AdminConsole.
// Stacking order is preserved from App.tsx — the recap renders before the
// month-close / chapter overlays so those stack on top at a boundary.
export function AppOverlays({
  modals,
  dayLoop,
  world,
  profile,
  bus,
  saveStore,
  playtestLog,
  handleSaveCleared,
  bump,
}: AppOverlaysProps) {
  const {
    tradeReview,
    tradeCounterResult,
    tradeOutcome,
    discountReview,
    discountCounterResult,
    discountOutcome,
    decideTrade,
    decideDiscount,
    dismissTrade,
    dismissDiscount,
  } = modals;
  const {
    recapModalOpen,
    lastRecap,
    setRecapModalOpen,
    monthClose,
    setMonthClose,
    chapterQueue,
    setChapterQueue,
    recoveryQueue,
    setRecoveryQueue,
    endCard,
  } = dayLoop;

  // ── #74 playtest capture (#332) ───────────────────────────────────────────
  // Stays attached for the whole session while a world exists: the finance mix
  // is a *rate* question, so a partial sample answers it wrongly. `deal:closed`
  // carries no day, hence the clock cursor.
  const [flagCount, setFlagCount] = useState(() => playtestLog.count());
  const pendingCtx = useRef<PlaytestContext | null>(null);

  useEffect(() => {
    if (!__DEV__ || world == null) return;
    return attachPlaytestCapture(bus, playtestLog, () => world.clock.currentDay);
  }, [bus, playtestLog, world]);

  // Stamped on FAB tap, spent on save — the useful moment is when the player
  // reacted, not when they finished typing the note.
  const stampContext = useCallback(() => {
    pendingCtx.current = {
      day: world?.clock.currentDay ?? 0,
      phase: world?.dayLoop.state().phase ?? 'UNKNOWN',
      cash: world?.economy.cash ?? 0,
      tier: world?.tierManager.currentTier ?? 0,
    };
  }, [world]);

  const saveFlag = useCallback(
    (note: string) => {
      playtestLog.flag(
        note,
        pendingCtx.current ?? { day: 0, phase: 'UNKNOWN', cash: 0, tier: 0 },
      );
      pendingCtx.current = null;
      setFlagCount(playtestLog.count());
    },
    [playtestLog],
  );

  return (
    <>
      <TradeEscalationModal
        visible={tradeReview != null}
        review={tradeReview}
        onDecide={decideTrade}
        counterResult={tradeCounterResult}
        outcome={tradeOutcome}
        onDismiss={dismissTrade}
      />
      <DiscountEscalationModal
        visible={discountReview != null}
        review={discountReview}
        onDecide={decideDiscount}
        counterResult={discountCounterResult}
        outcome={discountOutcome}
        onDismiss={dismissDiscount}
      />
      {/* Day-close reward beat (#253): pops over Home on day close,
          dismissable, and reopenable from the Today-region chip. Rendered
          before the month-close / chapter overlays so those stack on top
          at a month or tier boundary. */}
      <DayRecapModal
        visible={recapModalOpen}
        model={lastRecap}
        onDismiss={() => setRecapModalOpen(false)}
      />
      {monthClose != null && world && (
        <MonthCloseInterstitial
          model={{
            month: monthClose,
            tier: 1,
            snapshot: world.kpiDashboard.getSnapshot(),
          }}
          onDismiss={() => setMonthClose(null)}
        />
      )}
      {endCard == null &&
        world != null &&
        chapterQueue.length > 0 &&
        world.dayLoop.state().phase === 'MANAGERIAL' && (
          // Non-terminal drain (#127 decision 1/3): one full-bleed
          // acknowledge-card at a time, at the MANAGERIAL boundary, before
          // the EOD recap (this Modal renders over the DayLoopShell recap).
          // onConfirm applies the tier-up rebrand and pops the queue head;
          // remaining beats surface FIFO on the next render.
          <ChapterCard
            visible
            toTier={chapterQueue[0].toTier}
            defaultBusinessName={
              world.tierManager.businessName || (profile?.name ?? '')
            }
            onConfirm={(opts) => {
              world.tierManager.applyTierUp(opts);
              setChapterQueue((q) => q.slice(1));
              bump();
            }}
          />
        )}
      {endCard == null && world != null && recoveryQueue.length > 0 && (
        // Recovery beat (#326): a survivable-hit acknowledge-card, drained FIFO
        // one at a time. Non-terminal — it stacks above the chapter card and
        // never touches the end-card path. onConfirm just pops the head; the
        // persistent recovery banner (derived from monitor state) carries the
        // ongoing "climbing back" reminder after the beat is dismissed.
        <RecoveryBeatCard
          visible
          beat={recoveryQueue[0]}
          onConfirm={() => setRecoveryQueue((q) => q.slice(1))}
        />
      )}
      {__DEV__ && world && (
        <>
          <AdminConsole
            bus={bus}
            clock={world.clock}
            economy={world.economy}
            inventory={world.inventory}
            saveStore={saveStore}
            telemetry={world.telemetry}
            customerPool={world.customerPool}
            playtestLog={playtestLog}
            tier={world.tierManager.currentTier}
            onSaveCleared={handleSaveCleared}
          />
          {/* Sits above the DEV FAB and is the cheaper of the two to reach —
              reacting to something must cost one tap, or the observation is
              lost and the felt-day-length reading gets corrupted by the
              context switch. */}
          <PlaytestFlag
            count={flagCount}
            onOpen={stampContext}
            onSave={saveFlag}
          />
        </>
      )}
    </>
  );
}
