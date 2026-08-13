import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventBus } from '../../game/EventBus';
import type { World } from '../../createWorld';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { SaveStore } from '../../game/SaveStore';
import type {
  PlaytestContext,
  PlaytestLog,
  PlaytestProbe,
  PlaytestScriptStep,
  ProbeWhen,
} from '../../game/PlaytestLog';
import {
  attachPlaytestCapture,
  deriveGuideState,
  loadPlaytestScript,
  pendingProbes,
  DAY_DONE_STEP_ID,
} from '../../game/PlaytestLog';
import { PlaytestFlag } from '../../ui/PlaytestFlag';
import { PlaytestGuide } from '../../ui/PlaytestGuide';
import { TradeEscalationModal } from '../../ui/TradeEscalationModal';
import { DiscountEscalationModal } from '../../ui/DiscountEscalationModal';
import { DayRecapModal } from '../../ui/DayRecap';
import { MonthCloseInterstitial } from '../../ui/MonthCloseInterstitial';
import {
  ChapterCard,
  RecoveryBeatCard,
  StakesBeatCard,
} from '../../ui/NarrativeBeat';
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
    tradeVehicleSold,
    discountReview,
    discountCounterResult,
    discountOutcome,
    discountVehicleSold,
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
    stakesBeat,
    setStakesBeat,
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

  // ── #74 guided script (#333) ──────────────────────────────────────────────
  // The cursor lives in the log's own step entries, so `guideRev` only has to
  // force a recompute after an append — there is no second source of truth to
  // keep in sync, and a reset save can't desync it.
  const script = loadPlaytestScript();
  const [guideRev, setGuideRev] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideFocus, setGuideFocus] = useState<ProbeWhen>('day_open');
  // A boundary the guide *should* present at, held until nothing is stacked
  // above it. Set from the bus, spent by the effect below.
  const [guideDue, setGuideDue] = useState<ProbeWhen | null>(null);

  const guideState = useMemo(
    () => deriveGuideState(script, playtestLog.entries()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [script, playtestLog, guideRev],
  );

  const currentCtx = useCallback(
    (): PlaytestContext => ({
      day: world?.clock.currentDay ?? 0,
      phase: world?.dayLoop.state().phase ?? 'UNKNOWN',
      cash: world?.economy.cash ?? 0,
      tier: world?.tierManager.currentTier ?? 0,
    }),
    [world],
  );

  // The two moments a scripted instruction is actionable: the managerial window
  // ("before opening, hire a second salesperson") and after the day's close
  // ("did the day visibly change?"). Bus-driven rather than render-driven — a
  // phase change doesn't reliably re-render this overlay channel.
  useEffect(() => {
    if (!__DEV__ || world == null) return;
    const onPrep = () => setGuideDue('day_open');
    const onClose = () => setGuideDue('day_close');
    bus.subscribe('clock:managerial_prep', onPrep);
    bus.subscribe('floor:day_complete', onClose);
    return () => {
      bus.unsubscribe('clock:managerial_prep', onPrep);
      bus.unsubscribe('floor:day_complete', onClose);
    };
  }, [bus, world]);

  // Never stack the guide on top of a beat the player is already reading: the
  // recap, the month close, a chapter or recovery card, or the end card all own
  // the screen first. The due boundary just waits for them.
  const guideBlocked =
    recapModalOpen ||
    monthClose != null ||
    chapterQueue.length > 0 ||
    recoveryQueue.length > 0 ||
    endCard != null ||
    tradeReview != null ||
    discountReview != null;

  useEffect(() => {
    if (guideDue == null || guideBlocked || guideState.complete) return;
    // A day-close boundary with every probe already answered has nothing to
    // ask — don't interrupt for an empty card.
    if (guideDue === 'day_close' && pendingProbes(guideState, 'day_close').length === 0) {
      setGuideDue(null);
      return;
    }
    setGuideFocus(guideDue);
    setGuideOpen(true);
    setGuideDue(null);
  }, [guideDue, guideBlocked, guideState]);

  const toggleStep = useCallback(
    (step: PlaytestScriptStep, done: boolean) => {
      if (guideState.day == null) return;
      playtestLog.recordStep({
        ctx: currentCtx(),
        dayId: guideState.day.id,
        stepId: step.id,
        label: step.text,
        done,
      });
      setGuideRev((r) => r + 1);
    },
    [currentCtx, guideState, playtestLog],
  );

  const answerProbe = useCallback(
    (probe: PlaytestProbe, response: string) => {
      if (guideState.day == null) return;
      playtestLog.recordAnswer({
        ctx: currentCtx(),
        dayId: guideState.day.id,
        probeId: probe.id,
        prompt: probe.prompt,
        response,
      });
      setGuideRev((r) => r + 1);
    },
    [currentCtx, guideState, playtestLog],
  );

  const finishDay = useCallback(() => {
    if (guideState.day == null) return;
    playtestLog.recordStep({
      ctx: currentCtx(),
      dayId: guideState.day.id,
      stepId: DAY_DONE_STEP_ID,
      label: guideState.day.title,
      done: true,
    });
    setGuideRev((r) => r + 1);
    setGuideOpen(false);
  }, [currentCtx, guideState, playtestLog]);

  return (
    <>
      <TradeEscalationModal
        visible={tradeReview != null}
        review={tradeReview}
        onDecide={decideTrade}
        counterResult={tradeCounterResult}
        outcome={tradeOutcome}
        onDismiss={dismissTrade}
        vehicleSold={tradeVehicleSold}
      />
      <DiscountEscalationModal
        visible={discountReview != null}
        review={discountReview}
        onDecide={decideDiscount}
        counterResult={discountCounterResult}
        outcome={discountOutcome}
        onDismiss={dismissDiscount}
        vehicleSold={discountVehicleSold}
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
      {endCard == null && world != null && stakesBeat != null && (
        // The failure-stakes beat (#394): the one time the game states how a
        // career ends, while there is still something to do about it. Fires at
        // most once per career, so this is a single slot rather than a queue —
        // and it sits BELOW the recovery card in the same overlay stack, since
        // a hit that already landed outranks a warning about one that has not.
        <StakesBeatCard
          visible
          beat={stakesBeat}
          onConfirm={() => setStakesBeat(null)}
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
          {/* The guided script (#333): what the round asked you to do, presented
              at the boundary where it's actionable, rather than a doc you have
              to remember to consult on a second screen. */}
          <PlaytestGuide
            state={guideState}
            knownDark={script.knownDark}
            open={guideOpen}
            onOpenChange={setGuideOpen}
            onToggleStep={toggleStep}
            onAnswer={answerProbe}
            onDayDone={finishDay}
            focus={guideFocus}
          />
        </>
      )}
    </>
  );
}
