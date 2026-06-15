import React from 'react';
import type { EventBus } from '../../game/EventBus';
import type { World } from '../../createWorld';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { SaveStore } from '../../game/SaveStore';
import { TradeEscalationModal } from '../../ui/TradeEscalationModal';
import { DiscountEscalationModal } from '../../ui/DiscountEscalationModal';
import { DayRecapModal } from '../../ui/DayRecap';
import { MonthCloseInterstitial } from '../../ui/MonthCloseInterstitial';
import { ChapterCard } from '../../ui/NarrativeBeat';
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
    endCard,
  } = dayLoop;

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
      {__DEV__ && world && (
        <AdminConsole
          bus={bus}
          clock={world.clock}
          economy={world.economy}
          inventory={world.inventory}
          saveStore={saveStore}
          telemetry={world.telemetry}
          customerPool={world.customerPool}
          onSaveCleared={handleSaveCleared}
        />
      )}
    </>
  );
}
