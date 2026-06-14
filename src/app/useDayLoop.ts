import { useEffect, useRef, useState } from 'react';
import type { EventBus } from '../game/EventBus';
import type { Navigator } from '../ui/Navigator';
import type { World } from '../createWorld';
import type { LotVehicle } from '../game/Inventory';
import type { FloorEvent } from '../ui/FloorDashboard';
import type { DayRecapModel } from '../ui/DayRecap';
import type { CashDeltaSplit } from '../ui/HomeTab';
import type { ShellTabKey } from '../ui/AppShell';
import type { SaveState } from '../game/SaveStore';
import { snapshotWorld, type WorldSnapshot } from '../worldSnapshot';
import type { AppServices } from './services';
import type { EndCardData } from '../game/EndCard';
import { STRONG_MATCH_THRESHOLD, DAYS_PER_MONTH } from './config';

interface TierUpEvent {
  fromTier: number;
  toTier: number;
  day: number;
}

export interface DayLoopDeps {
  services: AppServices;
  worldRef: React.MutableRefObject<World | null>;
  nav: Navigator;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
  setCash: (n: number) => void;
  setFloorEvents: React.Dispatch<React.SetStateAction<readonly FloorEvent[]>>;
  eventSeq: React.MutableRefObject<number>;
  bump: () => void;
  buildCurrentSaveState: (
    overrides?: SaveState,
    worldSnapshot?: WorldSnapshot,
  ) => Promise<SaveState>;
}

export interface DayLoop {
  grossToday: number;
  setGrossToday: React.Dispatch<React.SetStateAction<number>>;
  grossTodayRef: React.MutableRefObject<number>;
  matchTallyRef: React.MutableRefObject<{ strong: number; matched: number }>;
  cashDelta: CashDeltaSplit | null;
  setCashDelta: (d: CashDeltaSplit | null) => void;
  prevDayCashRef: React.MutableRefObject<number | null>;
  prevDayAcquisitionSpendRef: React.MutableRefObject<number | null>;
  lastRecap: DayRecapModel | null;
  setLastRecap: (r: DayRecapModel | null) => void;
  recapModalOpen: boolean;
  setRecapModalOpen: (open: boolean) => void;
  monthClose: number | null;
  setMonthClose: (m: number | null) => void;
  shellTab: ShellTabKey;
  setShellTab: (t: ShellTabKey) => void;
  chapterQueue: readonly TierUpEvent[];
  setChapterQueue: React.Dispatch<React.SetStateAction<readonly TierUpEvent[]>>;
  endCard: EndCardData | null;
  setEndCard: (d: EndCardData | null) => void;
  handleNextDay: () => void;
  /** Reset all day-cycle accumulators / interrupts (session teardown). */
  reset: () => void;
}

// The day-cycle cluster (#242): per-day accumulators (gross, match tally, the
// vs-yesterday cash baselines), the day-close reward beat (recap modal + chip),
// the active shell tab, and the interrupt channel (month-close, chapter beats,
// terminal end-card). Owns the day-cycle EventBus subscriptions — including the
// floor:day_complete nexus that fans out across the world + save clusters via
// the injected setters / save helpers.
export function useDayLoop({
  services,
  worldRef,
  nav,
  setLotVehicles,
  setCash,
  setFloorEvents,
  eventSeq,
  bump,
  buildCurrentSaveState,
}: DayLoopDeps): DayLoop {
  const { bus, saveStore, slotStore, snapshotStoreForActiveSlot } = services;
  // Running today's gross (front + back) summed from closed deals — the
  // composed-state source for the FLOOR-OPEN HUD / stat grid (#116).
  const [grossToday, setGrossToday] = useState(0);
  // Mirror of `grossToday` updated synchronously in the close handler, so the
  // day-close recap captures the final figure without waiting on a re-render
  // (the state copy still feeds the live HUD / gate strip). Reset each day.
  const grossTodayRef = useRef(0);
  // Per-day inventory-buyer match tally (#199): closed deals scored for
  // stock-vs-buyer fit, and how many cleared the strong-match threshold. Held
  // in a ref (not display state — the live beat is the floor toast) so the
  // day-close handler reads the final tally synchronously when it assembles the
  // recap. Reset each "Next Day" alongside grossToday/floorEvents.
  const matchTallyRef = useRef({ strong: 0, matched: 0 });
  // Cash "vs yesterday" delta for the Home dashboard (#230, split #255). The
  // refs hold the prior day's closing cash and the lifetime stock-acquisition
  // spend at that close; the day-complete handler diffs both against the live
  // Economy figures to split the day into an operating delta + an "into stock"
  // line, then re-snapshots. Null until the first day closes.
  const prevDayCashRef = useRef<number | null>(null);
  const prevDayAcquisitionSpendRef = useRef<number | null>(null);
  const [cashDelta, setCashDelta] = useState<CashDeltaSplit | null>(null);
  // Last completed day's recap (#253), the single source for both the modal
  // that pops on day close and the Today-region reopen chip.
  const [lastRecap, setLastRecap] = useState<DayRecapModel | null>(null);
  const [recapModalOpen, setRecapModalOpen] = useState(false);
  // Month-close interstitial (#123): the 1-based month that just closed, or
  // null when none is pending.
  const [monthClose, setMonthClose] = useState<number | null>(null);
  // Active shell tab, lifted out of AppShell so it survives a round-trip
  // through a sub-screen (auction / pricing / a department). The shell unmounts
  // on those navigations; without lifting this the tab would reset to Home on
  // return.
  const [shellTab, setShellTab] = useState<ShellTabKey>('home');
  // Event-interrupt overlay channel (#84 / design record #127). Non-terminal
  // beats (career:tier_up / chapter rebrand) enqueue silently during
  // FLOOR_OPEN and drain as sequential full-bleed acknowledge-cards at the
  // MANAGERIAL boundary, FIFO by emission order.
  const [chapterQueue, setChapterQueue] = useState<readonly TierUpEvent[]>([]);
  // Terminal end-of-career data (#127 decision 2). Set on career:game_over.
  const [endCard, setEndCard] = useState<EndCardData | null>(null);

  const handleNextDay = () => {
    // MANAGERIAL → FLOOR_OPEN. The live render loop (#121) now drives the
    // owned FloorSim's step() at the player's chosen cadence; the day no
    // longer runs to exhaustion synchronously. FloorSim emits
    // floor:day_complete on the final tick, which flips the controller back
    // to MANAGERIAL (its own subscription) and re-renders.
    const w = worldRef.current;
    if (!w) return;
    setGrossToday(0);
    grossTodayRef.current = 0;
    setFloorEvents([]);
    matchTallyRef.current = { strong: 0, matched: 0 };
    // Leaving MANAGERIAL → the day-close recap modal is done; the chip keeps
    // the prior recap reachable until the next day closes over it (#253).
    setRecapModalOpen(false);
    w.dayLoop.nextDay();
    bump();
  };

  const reset = () => {
    setCashDelta(null);
    prevDayCashRef.current = null;
    prevDayAcquisitionSpendRef.current = null;
    setGrossToday(0);
    grossTodayRef.current = 0;
    matchTallyRef.current = { strong: 0, matched: 0 };
    setLastRecap(null);
    setRecapModalOpen(false);
    setMonthClose(null);
    setChapterQueue([]);
    setEndCard(null);
  };

  // Day-cycle lifecycle stays in sync with the EventBus.
  useEffect(() => {
    const onDayComplete = () => {
      const w = worldRef.current;
      bump();
      if (w) {
        setLotVehicles(w.inventory.getLotVehicles());
        setCash(w.economy.cash);
        // Cash vs-yesterday delta (#230), split ops-vs-stock (#255): diff the
        // just-closed day's cash and lifetime acquisition spend against the
        // prior close. Stock buys are an asset swap, not a loss — adding the
        // day's acquisition spend back into the raw cash change yields the
        // operating delta, with the spend broken out as its own line.
        const closingCash = w.economy.cash;
        const acquisitionSpend = w.economy.inventoryAcquisitionSpend;
        const prevDayCash = prevDayCashRef.current;
        let deltaSplit: CashDeltaSplit | null = null;
        if (prevDayCash != null) {
          const stock =
            acquisitionSpend - (prevDayAcquisitionSpendRef.current ?? 0);
          deltaSplit = { ops: closingCash - prevDayCash + stock, stock };
          setCashDelta(deltaSplit);
        }
        prevDayCashRef.current = closingCash;
        prevDayAcquisitionSpendRef.current = acquisitionSpend;
        // Day-close reward beat (#253): capture the just-closed day's recap
        // from the live funnel + the synchronously-mirrored gross/match refs,
        // pop it as a modal over Home, and persist it in the save envelope so
        // the reopen chip survives a reload. The captured model is the single
        // source for both the modal and the chip (the live funnel zeroes out
        // on the next day and isn't restored on load).
        const funnel = w.capacityManager.getDayFunnel();
        const recapModel: DayRecapModel = {
          day: w.clock.currentDay,
          potentialTraffic: funnel.potentialTraffic,
          walkedIn: funnel.walkedIn,
          staffEngaged: funnel.staffEngaged,
          sold: funnel.sold,
          gross: grossTodayRef.current,
          leakCause: funnel.leakCause,
          strongMatches: matchTallyRef.current.strong,
          matchedSales: matchTallyRef.current.matched,
        };
        setLastRecap(recapModel);
        setRecapModalOpen(true);
        // Cross-day autosave (#194): persist the world snapshot into the
        // active slot at the day boundary, merged with the slot's existing
        // blob (preserving character/seed/policy). The recap rides the same
        // write as a top-level envelope field (#253), and so do the cash-delta
        // baselines + the computed split (#255) — written only here, at the
        // close that moves them; every other save merges-with-existing and
        // carries them forward untouched.
        void (async () => {
          const worldSnapshot = snapshotWorld(w);
          const nextState = await buildCurrentSaveState(
            {
              lastRecap: recapModel,
              prevDayCash: closingCash,
              prevDayAcquisitionSpend: acquisitionSpend,
              cashDelta: deltaSplit,
            },
            worldSnapshot,
          );
          await saveStore.save(nextState);
          if (worldSnapshot.modules.gameClock.day % 7 === 0) {
            const snapshotStore = await snapshotStoreForActiveSlot();
            await snapshotStore?.saveSnapshot(nextState, {
              day: worldSnapshot.modules.gameClock.day,
              tier: worldSnapshot.modules.tierManager.currentTier,
            });
          }
        })();
      }
      // Day closed → the active slot's mid-day checkpoint is obsolete (#122 /
      // #109: caller clears it on day-complete).
      void slotStore.clearCheckpoint();
    };
    const onDealClosed = ({
      frontGross,
      backGross,
    }: {
      frontGross: number;
      backGross: number;
    }) => {
      grossTodayRef.current += frontGross + backGross;
      setGrossToday((g) => g + frontGross + backGross);
    };
    // Match-payoff beat (#199): every closed deal carries the want-axis fit of
    // the stocked unit. Tally all closes; a strong match also drops a live
    // floor toast ("you had what they wanted") into the event log.
    const onAutoResolved = ({
      outcome,
      matchQuality,
    }: {
      outcome: 'closed' | 'no_sale';
      matchQuality?: number;
    }) => {
      if (outcome !== 'closed') return;
      const strong = (matchQuality ?? 0) >= STRONG_MATCH_THRESHOLD;
      matchTallyRef.current = {
        strong: matchTallyRef.current.strong + (strong ? 1 : 0),
        matched: matchTallyRef.current.matched + 1,
      };
      if (strong) {
        setFloorEvents((log) => [
          ...log,
          {
            kind: 'match',
            key: `m${eventSeq.current++}`,
            text: 'Easy sale — you had what they wanted.',
          },
        ]);
      }
    };
    const onExceptionRaised = ({
      tick,
      customerId,
      department,
    }: {
      day: number;
      tick: number;
      customerId: string;
      department: string;
    }) =>
      setFloorEvents((log) => [
        ...log,
        {
          kind: 'exception',
          key: `e${eventSeq.current++}`,
          customerId,
          text: `t${tick} · ${department} exception — needs you`,
        },
      ]);

    // Month-close hook (#123): clock:month_ended fans out during the Next Day
    // transition (advanceDay) when the ending day completes a month. Latching
    // the interstitial here interrupts at MANAGERIAL — the render loop holds
    // (see useFloorRenderLoop hold) so the new month's floor stays paused
    // behind the screen until the player dismisses it.
    const onMonthEnded = ({ day }: { day: number }) =>
      setMonthClose(Math.ceil(day / DAYS_PER_MONTH));

    // Non-terminal interrupt (#127 decision 1): a tier-up / chapter beat.
    // Enqueued here regardless of phase; it surfaces only when the queue
    // drains at the MANAGERIAL boundary (see the ChapterCard overlay).
    const onTierUp = (e: TierUpEvent) => setChapterQueue((q) => [...q, e]);
    // Terminal interrupt (#127 decision 2/4): preempts everything — the rest
    // of the non-terminal queue is moot once the run is over. Hard-stops the
    // sim (the held render loop) and routes to the EndCard via a Navigator
    // reset (a new unreachable starting point).
    const onGameOver = ({ data }: { day: number; data: EndCardData }) => {
      setChapterQueue([]);
      setEndCard(data);
      nav.reset('end-card');
    };

    bus.subscribe('floor:day_complete', onDayComplete);
    bus.subscribe('clock:month_ended', onMonthEnded);
    bus.subscribe('career:tier_up', onTierUp);
    bus.subscribe('career:game_over', onGameOver);
    bus.subscribe('deal:closed', onDealClosed);
    bus.subscribe('staff:auto_resolved', onAutoResolved);
    bus.subscribe('floor:exception_raised', onExceptionRaised);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('clock:month_ended', onMonthEnded);
      bus.unsubscribe('career:tier_up', onTierUp);
      bus.unsubscribe('career:game_over', onGameOver);
      bus.unsubscribe('deal:closed', onDealClosed);
      bus.unsubscribe('staff:auto_resolved', onAutoResolved);
      bus.unsubscribe('floor:exception_raised', onExceptionRaised);
    };
  }, []);

  return {
    grossToday,
    setGrossToday,
    grossTodayRef,
    matchTallyRef,
    cashDelta,
    setCashDelta,
    prevDayCashRef,
    prevDayAcquisitionSpendRef,
    lastRecap,
    setLastRecap,
    recapModalOpen,
    setRecapModalOpen,
    monthClose,
    setMonthClose,
    shellTab,
    setShellTab,
    chapterQueue,
    setChapterQueue,
    endCard,
    setEndCard,
    handleNextDay,
    reset,
  };
}
