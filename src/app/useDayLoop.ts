import { useEffect, useReducer, useRef, useState } from 'react';
import type { EventBus } from '../game/EventBus';
import type { Navigator } from '../ui/Navigator';
import type { World } from '../createWorld';
import type { LotVehicle } from '../game/Inventory';
import type { FloorEvent } from '../ui/FloorDashboard';
import type { DayRecapModel } from '../ui/DayRecap';
import {
  buildReveal,
  winReactionText,
  walkOffReactionText,
  isStarworthyWalkOff,
  type ClosedSale,
  type WalkOff,
  type BrokenRecord,
} from '../ui/Reveal';
import type { CashDeltaSplit } from '../ui/HomeTab';
import { buildRecoveryBeat, type RecoveryBeat } from '../ui/NarrativeBeat';
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
  /** The current day's gross, read live off `Records` (#331). */
  grossToday: number;
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
  chapterQueue: readonly TierUpEvent[];
  setChapterQueue: React.Dispatch<React.SetStateAction<readonly TierUpEvent[]>>;
  /** Non-terminal recovery beats (#326): survivable contractions / consent
   *  decrees, drained one at a time like the chapter queue. */
  recoveryQueue: readonly RecoveryBeat[];
  setRecoveryQueue: React.Dispatch<React.SetStateAction<readonly RecoveryBeat[]>>;
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
  // Today's gross (front + back) for the FLOOR-OPEN HUD / stat grid (#116).
  // This hook keeps NO tally of its own (#331): the number is owned by
  // `Records`, which accumulates it with the same front+back formula the tier
  // gate grades, persists it, and is replay-safe. A close only bumps the render
  // trigger below; the value is re-read from the engine on the render that
  // follows. Reading at render rather than inside the `deal:closed` handler is
  // also what makes it order-proof: this hook subscribes at mount, before a
  // World (and therefore Records) exists, so an in-handler read could miss the
  // very deal that triggered it. Same reason a mid-day reload is correct for
  // free — the restored world carries the day's haul, no re-seeding needed.
  const [, bumpDealTick] = useReducer((n: number) => n + 1, 0);
  const grossToday = worldRef.current?.records.getDayTotals().gross ?? 0;
  // Per-day inventory-buyer match tally (#199): closed deals scored for
  // stock-vs-buyer fit, and how many cleared the strong-match threshold. Held
  // in a ref (not display state — the live beat is the floor toast) so the
  // day-close handler reads the final tally synchronously when it assembles the
  // recap. Reset each "Next Day" alongside grossToday/floorEvents.
  const matchTallyRef = useRef({ strong: 0, matched: 0 });
  // Per-close win records (#320): the individual sales the Reveal ranks by
  // drama into starred win reactions, alongside the aggregate tally above.
  // Reset each day the same way matchTallyRef is.
  const closesRef = useRef<ClosedSale[]>([]);
  // Per-walk-off loss records (#321): every `no_sale` outcome with a customer
  // session, the Reveal's negative-half counterpart to closesRef. Reset each
  // day the same way.
  const walkOffsRef = useRef<WalkOff[]>([]);
  // High-water marks broken during this bite (#330): the crowned third track of
  // the Reveal's drama pool. Records settles the day's marks inside
  // `floor:day_complete` and is wired in `createWorld`, so it subscribes ahead
  // of this hook's day-close handler — every crown for the just-closed day is
  // already in this ref when the Reveal is assembled (guarded in
  // `tests/Records.test.ts` at the bus level). The one mark that settles later,
  // `bestMonthGross` (on `clock:month_ended`, during the Next Day transition),
  // lands in the *following* day's ref and crowns on that day's Reveal — the
  // month's result is news you get the morning after it closes. Reset each day
  // the same way closesRef/walkOffsRef are.
  const recordsRef = useRef<BrokenRecord[]>([]);
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
  // NOTE: the active shell tab used to be lifted here, because a sub-screen
  // unmounted the shell and the tab would snap back to Home on return. #348
  // retired that: sub-screens render inside the shell now, and `TabStacks` owns
  // the active tab together with each tab's stack position.
  // Event-interrupt overlay channel (#84 / design record #127). Non-terminal
  // beats (career:tier_up / chapter rebrand) enqueue silently during
  // FLOOR_OPEN and drain as sequential full-bleed acknowledge-cards at the
  // MANAGERIAL boundary, FIFO by emission order.
  const [chapterQueue, setChapterQueue] = useState<readonly TierUpEvent[]>([]);
  // Non-terminal recovery beats (#326). The four survivable hits — bankruptcy /
  // indictment / AG contractions and the Tier 3+ consent decree — enqueue here
  // when they fire and drain as sequential full-bleed acknowledge-cards, the
  // same channel shape as chapterQueue but framed as "climbing back," never the
  // terminal end-card path.
  const [recoveryQueue, setRecoveryQueue] = useState<readonly RecoveryBeat[]>([]);
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
    setFloorEvents([]);
    matchTallyRef.current = { strong: 0, matched: 0 };
    closesRef.current = [];
    walkOffsRef.current = [];
    recordsRef.current = [];
    // Leaving MANAGERIAL → the day-close recap modal is done; the chip keeps
    // the prior recap reachable until the next day closes over it (#253).
    setRecapModalOpen(false);
    w.dayLoop.nextDay();
    // #322 capture the committed post-prep bet for the day now opening (lot
    // stocking lean vs. the demand-heat read), so the day-close Reveal can
    // resolve it. Post-nextDay: the clock now sits on the day being played.
    w.captureDayStartPrepBet();
    bump();
  };

  const reset = () => {
    setCashDelta(null);
    prevDayCashRef.current = null;
    prevDayAcquisitionSpendRef.current = null;
    matchTallyRef.current = { strong: 0, matched: 0 };
    closesRef.current = [];
    walkOffsRef.current = [];
    recordsRef.current = [];
    setLastRecap(null);
    setRecapModalOpen(false);
    setMonthClose(null);
    setChapterQueue([]);
    setRecoveryQueue([]);
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
        // The just-closed day's haul, straight off the engine. Records clears
        // its day accumulators on `clock:day_started` (the Next Day
        // transition), not at day-complete, so the closed day's final figure is
        // still standing here — and it survives a reload, which the old
        // in-hook tally did not (#331).
        const dayGross = w.records.getDayTotals().gross;
        const recapModel: DayRecapModel = {
          day: w.clock.currentDay,
          potentialTraffic: funnel.potentialTraffic,
          walkedIn: funnel.walkedIn,
          staffEngaged: funnel.staffEngaged,
          sold: funnel.sold,
          gross: dayGross,
          leakCause: funnel.leakCause,
          strongMatches: matchTallyRef.current.strong,
          matchedSales: matchTallyRef.current.matched,
          reveal: buildReveal(
            funnel,
            dayGross,
            matchTallyRef.current,
            closesRef.current,
            walkOffsRef.current,
            w.getPrepBet(),
            recordsRef.current,
          ),
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
    // A close moves the day's gross inside Records; re-render so the HUD picks
    // the new figure up (the value itself is read at render — see grossToday).
    const onDealClosed = () => {
      bumpDealTick();
    };
    // Match-payoff beat (#199): every closed deal carries the want-axis fit of
    // the stocked unit. Tally all closes; a strong match also drops a live
    // floor toast with the per-customer win detail (#320) into the event log,
    // and every close is recorded for the day-close Reveal to rank into
    // starred win reactions. Walk-off half (#321): every `no_sale` with a
    // customer session is recorded for the Reveal to rank into starred loss
    // reactions, and a painful/instructive one also drops a live floor toast —
    // the boring middle (routine no-closes, patience drain, ...) stays silent
    // on the floor and only shows up as a number at day-close.
    const onAutoResolved = ({
      outcome,
      matchQuality,
      customerId,
      vehicleCategory,
      archetypeLabel,
      wantedCategory,
      reason,
      grossImpact,
    }: {
      outcome: 'closed' | 'no_sale';
      matchQuality?: number;
      customerId: string;
      vehicleCategory?: 'sedan' | 'truck' | 'suv';
      archetypeLabel?: string;
      wantedCategory?: 'sedan' | 'truck' | 'suv';
      reason?: string;
      grossImpact: number;
    }) => {
      if (outcome !== 'closed') {
        if (archetypeLabel && reason) {
          const walkOff: WalkOff = { customerId, archetypeLabel, wantedCategory, reason };
          walkOffsRef.current = [...walkOffsRef.current, walkOff];
          if (isStarworthyWalkOff(reason)) {
            setFloorEvents((log) => [
              ...log,
              {
                kind: 'walk',
                key: `w${eventSeq.current++}`,
                text: walkOffReactionText(walkOff),
              },
            ]);
          }
        }
        return;
      }
      const strong = (matchQuality ?? 0) >= STRONG_MATCH_THRESHOLD;
      matchTallyRef.current = {
        strong: matchTallyRef.current.strong + (strong ? 1 : 0),
        matched: matchTallyRef.current.matched + 1,
      };
      if (vehicleCategory && archetypeLabel) {
        const sale: ClosedSale = {
          customerId,
          archetypeLabel,
          vehicleCategory,
          matchQuality: matchQuality ?? 0,
          gross: grossImpact,
        };
        closesRef.current = [...closesRef.current, sale];
        if (strong) {
          setFloorEvents((log) => [
            ...log,
            {
              kind: 'match',
              key: `m${eventSeq.current++}`,
              text: winReactionText(sale),
            },
          ]);
        }
      }
    };
    // Crowned-record accumulation (#330): every mark Records breaks during this
    // bite is held for the day-close Reveal, which ranks the crownworthy ones
    // into the same drama pool as the day's wins and walk-offs. No filtering
    // here — the feed owns which breaks earn a crown.
    const onRecordBroken = (record: BrokenRecord) => {
      recordsRef.current = [...recordsRef.current, record];
    };
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
      setRecoveryQueue([]);
      setEndCard(data);
      nav.reset('end-card');
    };

    // Survivable-hit interrupts (#326). Each of the four recovery events builds
    // a beat and enqueues it; they drain (endCard == null) as full-bleed
    // acknowledge-cards, distinct from the terminal onGameOver path above.
    const enqueueRecovery = (beat: RecoveryBeat) =>
      setRecoveryQueue((q) => [...q, beat]);
    const onBankruptcyContraction = (p: {
      fromTier: number;
      debtPrincipal: number;
    }) =>
      enqueueRecovery(
        buildRecoveryBeat({
          kind: 'bankruptcy_contraction',
          fromTier: p.fromTier,
          debtPrincipal: p.debtPrincipal,
        }),
      );
    const onIndictmentContraction = (p: {
      fromTier: number;
      stakePenalty: number;
    }) =>
      enqueueRecovery(
        buildRecoveryBeat({
          kind: 'indictment_contraction',
          fromTier: p.fromTier,
          stakePenalty: p.stakePenalty,
        }),
      );
    const onAgContraction = (p: { fromTier: number; suspensionDays: number }) =>
      enqueueRecovery(
        buildRecoveryBeat({
          kind: 'ag_complaint_contraction',
          fromTier: p.fromTier,
          suspensionDays: p.suspensionDays,
        }),
      );
    const onConsentDecree = (p: {
      tier: number;
      cashCost: number;
      reputationHit: number;
    }) =>
      enqueueRecovery(
        buildRecoveryBeat({
          kind: 'ag_complaint_consent_decree',
          tier: p.tier,
          cashCost: p.cashCost,
          reputationHit: p.reputationHit,
        }),
      );

    bus.subscribe('floor:day_complete', onDayComplete);
    bus.subscribe('clock:month_ended', onMonthEnded);
    bus.subscribe('career:tier_up', onTierUp);
    bus.subscribe('career:game_over', onGameOver);
    bus.subscribe('career:bankruptcy_contraction', onBankruptcyContraction);
    bus.subscribe('career:indictment_contraction', onIndictmentContraction);
    bus.subscribe('regulatory:ag_complaint_contraction', onAgContraction);
    bus.subscribe('regulatory:ag_complaint_consent_decree', onConsentDecree);
    bus.subscribe('deal:closed', onDealClosed);
    bus.subscribe('staff:auto_resolved', onAutoResolved);
    bus.subscribe('records:broken', onRecordBroken);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('clock:month_ended', onMonthEnded);
      bus.unsubscribe('career:tier_up', onTierUp);
      bus.unsubscribe('career:game_over', onGameOver);
      bus.unsubscribe('career:bankruptcy_contraction', onBankruptcyContraction);
      bus.unsubscribe('career:indictment_contraction', onIndictmentContraction);
      bus.unsubscribe('regulatory:ag_complaint_contraction', onAgContraction);
      bus.unsubscribe('regulatory:ag_complaint_consent_decree', onConsentDecree);
      bus.unsubscribe('deal:closed', onDealClosed);
      bus.unsubscribe('staff:auto_resolved', onAutoResolved);
      bus.unsubscribe('records:broken', onRecordBroken);
    };
  }, []);

  return {
    grossToday,
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
    chapterQueue,
    setChapterQueue,
    recoveryQueue,
    setRecoveryQueue,
    endCard,
    setEndCard,
    handleNextDay,
    reset,
  };
}
