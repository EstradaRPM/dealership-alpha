import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  createMultiSlotSaveStore,
  createSqliteDriverFactory,
} from './src/game/SaveStore';
import { createEventBus } from './src/game/EventBus';
import type {
  HandPlaySession,
  AdvanceResult,
} from './src/game/FloorSim';
import { loadTunables } from './src/game/data';
import {
  loadTradePolicyConfig,
  resolveTradePolicyMultiplier,
} from './src/game/DealEngine';
import { loadInventoryConfig } from './src/game/Inventory';
import { loadStaffTaxonomy } from './src/game/NPC';
import { createWorld, makeSeed, type World } from './src/createWorld';
import {
  snapshotWorld,
  restoreWorld,
  type WorldSnapshot,
  type PersistedWorldSnapshot,
} from './src/worldSnapshot';
import { CharacterCreation } from './src/ui/CharacterCreation';
import { MainMenu } from './src/ui/MainMenu';
import { DayLoopShell } from './src/ui/DayLoopShell';
import type { DayRecapModel } from './src/ui/DayRecap';
import type {
  DemandCoverageGap,
  DemandReadoutEntry,
  DemandReadoutModel,
  DemandTargetingLever,
} from './src/ui/DemandReadout';
import { SALES_ARCHETYPES } from './src/game/CustomerPool';
import type {
  FloorDashboardModel,
  FloorEvent,
} from './src/ui/FloorDashboard';
import { HandPlayModal, type HandPlayOutcome } from './src/ui/HandPlayModal';
import { useFloorRenderLoop } from './src/ui/FloorRenderLoop';
import { AuctionMenu } from './src/ui/AuctionMenu';
import { PersonnelScreen } from './src/ui/PersonnelScreen';
import { PricingScreen } from './src/ui/PricingScreen';
import {
  loadPricingStrategiesConfig,
  suggestListPrice,
  classifyPricePosition,
  deriveCompetitorComps,
} from './src/game/MarketEconomy';
import type { CharacterProfile } from './src/game/CareerProgression';
import type {
  SaveStore,
  MultiSlotSaveStore,
  MidDayCheckpoint,
} from './src/game/SaveStore';
import type { LotVehicle } from './src/game/Inventory';
import { AdminConsole } from './src/ui/AdminConsole';
import { MonthCloseInterstitial } from './src/ui/MonthCloseInterstitial';
import { ChapterCard } from './src/ui/NarrativeBeat';
import { EndCard } from './src/ui/EndCard';
import type { EndCardData } from './src/game/EndCard';
import { useNavigator } from './src/ui/Navigator';
import { BottomNav } from './src/ui/BottomNav';
import { DepartmentScreen } from './src/ui/DepartmentScreen';
import type { DeptKey } from './src/game/DepartmentQueue';

const DEPT_TITLES: Record<DeptKey, string> = {
  sales: 'Sales',
  service: 'Service',
  bdc: 'BDC',
  office: 'Office',
  lot: 'Lot',
};

// Hand-play modal default (#118): sourced from a tunable, never a magic
// number. false ⇒ opening the modal auto-pauses the day; true ⇒ the day
// keeps running live behind it (the #74/#105 felt-pacing comparison path).
const HAND_PLAY_LIVE = loadTunables().handPlay.playtestLiveDefault;

// Representative open-hours window for the FLOOR-OPEN HUD clock (#121).
const RENDER_LOOP = loadTunables().renderLoop;

// Want-axis fit a closed deal must clear to count as a "strong match" (#199) —
// drives the floor toast + DayRecap tally. Tunable, never a magic number.
const STRONG_MATCH_THRESHOLD = loadTunables().matchPayoff.strongMatchThreshold;

// Hours-of-op lever options (#120). "Wired only": the lever selects an id and
// the composition root holds the scaled ticksPerDay. Feeding it into FloorSim
// is a downstream slice (FloorSim/#99 is locked and reads its own value).
const HOURS_OF_OP = loadTunables().ownership.hoursOfOp;

// Paid pre-purchase inspection cost shown on the auction-board action (#164).
const INSPECTION_COST = loadInventoryConfig().inspection.cost;

// Aged-unit threshold for the pricing-screen aging warning (#173/#175).
const AGED_THRESHOLD_DAYS = loadInventoryConfig().carrying.agedThresholdDays;

// Trade-acquisition policy catalog (#172). Seed-free; the selected id persists
// per save slot and resolves to the acceptance-target multiplier the trade
// resolver reads. Default = market (1.0).
const TRADE_POLICY = loadTradePolicyConfig();

// List-price strategy catalog (#154). Seed-free; the selected id persists per
// save slot and drives the staff-suggested list price on the pricing screen
// (#175). Default = market.
const PRICING_STRATEGIES = loadPricingStrategiesConfig();
const PRICING_STRATEGY_OPTIONS = Object.entries(PRICING_STRATEGIES.strategies).map(
  ([id, s]) => ({ id, label: s.label, blurb: s.blurb }),
);

// Primary customer-facing role the Hiring lever recruits for (v1 slice is
// sales-only; multi-role hiring is downstream).
const HIRING_ROLE_ID = 'salesperson';

// ── Composition root (#114) ──────────────────────────────────────────────────
// Seed-free, must outlive world (re)construction. The store reads the
// persisted per-save masterSeed (#96) before the seed-dependent World is
// built; bus stays stable so the render-loop hook + bus subscriptions have a
// bus before the seed is known.
//
// Multi-slot store (#194): the active slot holds one game's full world
// trajectory; the per-slot checkpoint cell (#109/#122) lives beside it,
// isolated, so the in-progress FloorSim checkpoint can never collide with the
// main save blob and never bleeds between slots.
const slotStore: MultiSlotSaveStore = createMultiSlotSaveStore(
  createSqliteDriverFactory(),
);
// Active-slot-backed SaveStore adapter (#194). The character/admin/end-card
// flows depend on the narrow single-blob SaveStore surface (save/load/clear);
// this presents exactly that, always addressing whichever slot is active.
// Slot creation/selection is owned entirely by the start menu (#195) — by the
// time anything saves, the MainMenu has already created+selected the active
// slot, so there is no lazy auto-create here. The slot-picker `day`/`tier`
// metadata is read off the persisted world snapshot when present, else 0/1.
const saveStore: SaveStore = {
  async save(state) {
    const snap = state.world as WorldSnapshot | undefined;
    const day = snap?.modules.gameClock.day ?? 0;
    const tier = snap?.modules.tierManager.currentTier ?? 1;
    await slotStore.save(state, { day, tier });
  },
  load: () => slotStore.load(),
  async clear() {
    const id = await slotStore.getActiveSlotId();
    if (id !== null) await slotStore.deleteSlot(id);
  },
};
const bus = createEventBus();

// staffTaxonomy is seed-free: kept module-level so SKILL_CAPS (PersonnelScreen
// bars, #120) and the FLOOR-OPEN staff-strip department lookup don't depend on
// a built World.
const staffTaxonomy = loadStaffTaxonomy();
// skill_id → cap, for the PersonnelScreen skill bars (Hiring lever, #120).
const SKILL_CAPS: Record<string, number> = Object.fromEntries(
  Object.entries(staffTaxonomy.skills).map(([id, s]) => [id, s.cap]),
);

// role_id → humanized label + serving department, for the impressionistic
// FLOOR-OPEN staff strip (#117). Pure read mapping off the role catalog.
function humanizeRole(roleId: string): string {
  return roleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// persona id → human label for the #198 observed-mix readout. Sourced from the
// same SALES_ARCHETYPES table the spawn draw resolves against — never a magic
// string list.
const PERSONA_LABELS: Record<string, string> = Object.fromEntries(
  SALES_ARCHETYPES.map((a) => [a.personId, a.label]),
);
const DEMAND_SHAPER = loadTunables().demandShaper;
const COVERAGE_CATEGORY_LABELS: Record<string, string> = {
  sedan: 'sedans',
  truck: 'trucks',
  suv: 'SUVs',
};

function buildTargetingLevers(world: World): DemandTargetingLever[] {
  return world.demandShaper.getInfluenceInputs().map((input) => ({
    id: input.id,
    label: input.label,
    lean: Object.entries(input.weights)
      .filter(([, weight]) => weight > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([persona, weight]) => ({
        persona,
        label: PERSONA_LABELS[persona] ?? persona,
        weight,
      })),
  }));
}

function buildCoverageGap(
  entries: readonly DemandReadoutEntry[],
  lotVehicles: readonly LotVehicle[],
): DemandCoverageGap | null {
  const personaCategory = DEMAND_SHAPER.coverageCategoryByPersona ?? {};
  const wantedByCategory: Record<string, number> = {};
  for (const entry of entries) {
    const category = personaCategory[entry.persona];
    if (!category) continue;
    wantedByCategory[category] = (wantedByCategory[category] ?? 0) + entry.count;
  }
  const stockedByCategory: Record<string, number> = {};
  for (const vehicle of lotVehicles) {
    stockedByCategory[vehicle.category] =
      (stockedByCategory[vehicle.category] ?? 0) + 1;
  }
  const [category, wantedCount] =
    Object.entries(wantedByCategory)
      .filter(([, wanted]) => wanted > 0)
      .sort(([, a], [, b]) => b - a)
      .find(([category]) => (stockedByCategory[category] ?? 0) === 0) ?? [];
  if (!category || wantedCount == null) return null;
  return {
    category,
    label: COVERAGE_CATEGORY_LABELS[category] ?? category,
    wantedCount,
    stockCount: stockedByCategory[category] ?? 0,
  };
}

// Month-close cadence — sourced from the same tunable GameClock uses, never
// a magic number. clock:month_ended fires on endingDay % daysPerMonth === 0.
const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;

export default function App() {
  const nav = useNavigator('loading');
  const screen = nav.current.route;
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  // Fresh root RNG seed (#96) for the next brand-new game. Re-minted each time
  // the player starts a New Game from the menu, so two new games created in one
  // app session don't clone the same world. CharacterCreation persists it into
  // the active slot; an existing save ignores it and rebuilds from its own seed.
  const [newGameSeed, setNewGameSeed] = useState(makeSeed);
  // The seed-dependent composition root (#96). Null until the per-save
  // masterSeed is resolved — from the persisted save on load, or the fresh
  // newGameSeed at character creation. Built exactly once per game.
  const [world, setWorld] = useState<World | null>(null);
  // Latest world for bus handlers / AppState listener (their effects mount
  // once with [] before the world exists).
  const worldRef = useRef<World | null>(null);
  worldRef.current = world;
  const [lotVehicles, setLotVehicles] = useState<readonly LotVehicle[]>([]);
  const [cash, setCash] = useState(0);
  // Hours-of-op lever selection (#120). Composition-root state only — the
  // downstream slice wires HOURS_OF_OP.options[…].ticksPerDay into FloorSim.
  const [hoursOfOpId, setHoursOfOpId] = useState(HOURS_OF_OP.defaultId);
  // Per-slot trade-acquisition policy (#172). Initialized from the persisted
  // slot setting on load (or the catalog default for a fresh slot). The ref
  // feeds the live getter handed to createWorld so a mid-game change applies on
  // the next trade without rebuilding the world.
  const [tradePolicyId, setTradePolicyId] = useState(TRADE_POLICY.defaultId);
  const tradePolicyIdRef = useRef(TRADE_POLICY.defaultId);
  tradePolicyIdRef.current = tradePolicyId;
  const getTradePolicyMultiplier = () =>
    resolveTradePolicyMultiplier(tradePolicyIdRef.current, TRADE_POLICY);
  // Per-slot list-price strategy (#154). Restored from the persisted slot
  // setting on load; drives the pricing screen's staff suggestion (#175).
  const [pricingStrategyId, setPricingStrategyId] = useState(
    PRICING_STRATEGIES.defaultStrategy,
  );
  // Running today's gross (front + back) summed from closed deals — the
  // composed-state source for the FLOOR-OPEN HUD / stat grid (#116).
  const [grossToday, setGrossToday] = useState(0);
  // Per-day FLOOR-OPEN event log (#117): walk heartbeats as transient lines,
  // forced exceptions as tappable alert rows. Reset each "Next Day".
  const [floorEvents, setFloorEvents] = useState<readonly FloorEvent[]>([]);
  const eventSeq = useRef(0);
  // Per-day inventory-buyer match tally (#199): closed deals scored for
  // stock-vs-buyer fit, and how many cleared the strong-match threshold. Feeds
  // the floor toast (live) + the DayRecap tally (MANAGERIAL). Reset each
  // "Next Day" alongside grossToday/floorEvents.
  const [matchTally, setMatchTally] = useState({ strong: 0, matched: 0 });
  // Re-render trigger for the headless DayLoopController lifecycle.
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  // Hand-play spotlight (#118). The composition root owns the grabbed
  // FloorSim session; the modal is a thin view that renders the pending gate
  // and dispatches the picked approach back through advance().
  const [handSession, setHandSession] = useState<HandPlaySession | null>(null);
  const [handResult, setHandResult] = useState<AdvanceResult | null>(null);
  // Month-close interstitial (#123): the 1-based month that just closed, or
  // null when none is pending. Set on clock:month_ended, cleared on dismiss —
  // the MANAGERIAL interrupt point between the day-recap and next-day prep.
  const [monthClose, setMonthClose] = useState<number | null>(null);
  // Event-interrupt overlay channel (#84 / design record #127). Lives in the
  // composition root, layered ABOVE the Navigator — NOT a RouteParamMap route.
  // Non-terminal beats (career:tier_up / chapter rebrand) enqueue silently
  // during FLOOR_OPEN and drain as sequential full-bleed acknowledge-cards at
  // the MANAGERIAL boundary, FIFO by emission order (bus delivers in publish
  // order, so array order == emission order). Acknowledgement is OUT of the
  // tick-stamped action log by construction — it never enters the live sim,
  // so it carries zero replay-determinism risk (#127 decision 1/6).
  const [chapterQueue, setChapterQueue] = useState<
    readonly { fromTier: number; toTier: number; day: number }[]
  >([]);
  // Terminal end-of-career data (#127 decision 2). Set on career:game_over —
  // hard-stops the sim (held render loop) and routes to the EndCard via a
  // Navigator reset. Preempts the non-terminal queue (#127 decision 4).
  const [endCard, setEndCard] = useState<EndCardData | null>(null);

  // The live clock (#121). Drives the owned FloorSim's step() at a tunable
  // cadence; speed/pause are pure render multipliers (game logic is
  // wall-clock-free). A hand-play modal open in auto-pause mode holds the
  // interval without touching the player's pause state.
  const floorLoop = useFloorRenderLoop({
    floor: world?.dayLoop.currentFloor() ?? null,
    active: world ? world.dayLoop.state().phase === 'FLOOR_OPEN' : false,
    bus,
    onTick: bump,
    hold:
      (handSession != null && !HAND_PLAY_LIVE) ||
      monthClose != null ||
      chapterQueue.length > 0 ||
      endCard != null,
  });

  // Open the modal on a specific grabbable customer (forced-exception row or
  // a cherry-pick the composition root already selected). When not running
  // live, the day is already idle here (the render loop is #121) — auto-pause
  // is the default and holds until the player resumes.
  const openHandPlay = (customerId: string) => {
    const f = world?.dayLoop.currentFloor();
    if (!f || !f.canGrab()) return;
    setHandSession(f.grab(customerId));
    setHandResult(null);
  };
  const cherryPick = () => {
    const f = world?.dayLoop.currentFloor();
    if (!f || !f.canGrab()) return;
    const next = f.grabbableCustomers()[0];
    if (next) openHandPlay(next.id);
  };
  const chooseApproach = (choiceId: string) => {
    if (!handSession) return;
    // advance() burns handPlay.tickCostPerGate deterministic ticks inside
    // FloorSim regardless of pause state; the clock jumps on resume.
    const r = handSession.advance(choiceId);
    setHandResult(r.status === 'continue' ? null : r);
    bump();
  };
  const closeHandPlay = () => {
    setHandSession(null);
    setHandResult(null);
  };

  // Build (and route into) the game from whichever slot is currently active.
  // Called by the start menu's Continue/Load after it has selected the slot
  // (#195). The slot must already hold a character; the menu never offers an
  // empty/character-less slot for resume.
  const loadActiveSlotIntoGame = async () => {
    const state = await saveStore.load();
    if (!state?.character) return;
    // Per-save masterSeed (#96): the SaveStore v1→v2 migration backfills the
    // fixed legacy 42 for pre-#96 saves, so a number is guaranteed here; the
    // ?? 42 is a defensive belt only.
    const seed = typeof state.masterSeed === 'number' ? state.masterSeed : 42;
    const character = state.character as CharacterProfile;
    // Restore the persisted per-slot trade policy (#172) before any trade can
    // resolve. The ref backs the live multiplier getter handed to createWorld.
    if (typeof state.tradePolicy === 'string') {
      tradePolicyIdRef.current = state.tradePolicy;
      setTradePolicyId(state.tradePolicy);
    }
    // Restore the persisted per-slot list-price strategy (#154).
    if (typeof state.pricingStrategy === 'string') {
      setPricingStrategyId(state.pricingStrategy);
    }
    const w = createWorld({
      bus,
      masterSeed: seed,
      characterProfile: character,
      getTradePolicyMultiplier,
    });
    // World-state restore (#188 tracer): rehydrate the persisted world
    // snapshot (day + cash) onto the freshly-built World instead of leaving it
    // reset to "night before Day 1". Done before the checkpoint-resume block
    // below so the mid-day guard (`cp.day === clock.currentDay`) compares
    // against the restored day. Fan-out modules (#186 slices 2–6) extend the
    // snapshot; this call site never changes.
    if (state.world) {
      // restoreWorld migrates the persisted (possibly older) snapshot to the
      // current envelope shape before rehydrating (#196).
      restoreWorld(state.world as PersistedWorldSnapshot, w);
    }
    setWorld(w);
    setCash(w.economy.cash);
    setProfile(character);
    nav.reset('game');
    // Mid-day cold-start resume (#122): if a checkpoint exists for the day the
    // clock currently sits on, recreate the FloorSim and replay its action log
    // to land in the byte-exact pre-background state. A stale checkpoint (the
    // clock can't honor it) is discarded, never misapplied. The checkpoint
    // lives in the active slot's own cell (#194), so it never bleeds slots.
    const cp: MidDayCheckpoint | null = await slotStore.readCheckpoint();
    if (cp && cp.day === w.clock.currentDay) {
      w.dayLoop.resume(cp);
      bump();
    } else if (cp) {
      await slotStore.clearCheckpoint();
    }
  };

  // Boot to the start menu (#195). No auto-load into the last game — the
  // player chooses New Game / Continue / Load. Continue resumes the
  // most-recently-played slot; both Continue and Load route through
  // loadActiveSlotIntoGame once the menu has selected the slot.
  useEffect(() => {
    nav.reset('main-menu');
  }, []);

  // Lifecycle + Auction-relevant state stay in sync with the EventBus.
  useEffect(() => {
    const onDayComplete = () => {
      const w = worldRef.current;
      bump();
      if (w) {
        setLotVehicles(w.inventory.getLotVehicles());
        setCash(w.economy.cash);
        // Cross-day autosave (#194): persist the world snapshot into the
        // active slot at the day boundary, merged with the slot's existing
        // blob (preserving character/seed/policy — the same merge-with-existing
        // write the policy/strategy setters use). The adapter derives the
        // slot's `day` metadata from this snapshot.
        void saveStore
          .load()
          .then((existing) =>
            saveStore.save({ ...(existing ?? {}), world: snapshotWorld(w) }),
          );
      }
      // Day closed → the active slot's mid-day checkpoint is obsolete (#122 /
      // #109: caller clears it on day-complete).
      void slotStore.clearCheckpoint();
    };
    const onVehiclePurchased = () => {
      const w = worldRef.current;
      if (!w) return;
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    };
    const onVehicleSold = () => {
      const w = worldRef.current;
      if (w) setLotVehicles(w.inventory.getLotVehicles());
    };
    const onRevenue = () => {
      const w = worldRef.current;
      if (w) setCash(w.economy.cash);
    };
    const onDealClosed = ({
      frontGross,
      backGross,
    }: {
      frontGross: number;
      backGross: number;
    }) => setGrossToday((g) => g + frontGross + backGross);
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
      setMatchTally((t) => ({
        strong: t.strong + (strong ? 1 : 0),
        matched: t.matched + 1,
      }));
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
    // drains at the MANAGERIAL boundary (see the ChapterCard overlay below).
    const onTierUp = (e: { fromTier: number; toTier: number; day: number }) =>
      setChapterQueue((q) => [...q, e]);
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
    bus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    bus.subscribe('deal:closed', onDealClosed);
    bus.subscribe('staff:auto_resolved', onAutoResolved);
    bus.subscribe('floor:exception_raised', onExceptionRaised);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('clock:month_ended', onMonthEnded);
      bus.unsubscribe('career:tier_up', onTierUp);
      bus.unsubscribe('career:game_over', onGameOver);
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
      bus.unsubscribe('deal:closed', onDealClosed);
      bus.unsubscribe('staff:auto_resolved', onAutoResolved);
      bus.unsubscribe('floor:exception_raised', onExceptionRaised);
    };
  }, []);

  // Pause-on-background → persist the mid-day checkpoint (#122). The OS gives
  // no reliable "about to be killed" hook, so we snapshot on every
  // background/inactive transition while the floor is open; resume replays it
  // deterministically on the next cold start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') return;
      const cp = worldRef.current?.dayLoop.checkpoint();
      // A mid-day checkpoint only exists while a game is loaded, so an active
      // slot is always present here (#194 — written into the active slot's
      // isolated checkpoint cell).
      if (cp) void slotStore.writeCheckpoint(cp);
    });
    return () => sub.remove();
  }, []);

  const handleNextDay = () => {
    // MANAGERIAL → FLOOR_OPEN. The live render loop (#121) now drives the
    // owned FloorSim's step() at the player's chosen cadence; the day no
    // longer runs to exhaustion synchronously. FloorSim emits
    // floor:day_complete on the final tick, which flips the controller back
    // to MANAGERIAL (its own subscription) and re-renders.
    if (!world) return;
    setGrossToday(0);
    setFloorEvents([]);
    setMatchTally({ strong: 0, matched: 0 });
    world.dayLoop.nextDay();
    bump();
  };

  // Bottom-nav dispatch (#76). Sales is the hand-play workspace, not a
  // resolve-list — it opens the existing cherry-pick/hand-play path. The
  // other four push the generic DepartmentScreen. Always responds; never
  // gated on badge count (see #71).
  const handleDeptPress = (dept: DeptKey) => {
    if (dept === 'sales') {
      cherryPick();
      return;
    }
    nav.navigate('department', { dept });
  };

  // After a save is wiped (EndCard "New Career" or the dev AdminConsole), the
  // active slot is gone — return to the start menu (#195) rather than straight
  // into character-creation, which would have no slot to write into. The
  // player picks New Game from there.
  const handleSaveCleared = () => {
    setProfile(null);
    setWorld(null);
    nav.reset('main-menu');
  };

  // Persist the trade-policy choice into the active slot (#172). Mirrors
  // CharacterCreation's merge-with-existing write so the character/seed blob is
  // preserved. The ref updates immediately so the live multiplier getter
  // reflects the new policy before the persist resolves.
  const handleSelectTradePolicy = (id: string) => {
    tradePolicyIdRef.current = id;
    setTradePolicyId(id);
    void saveStore
      .load()
      .then((existing) =>
        saveStore.save({ ...(existing ?? {}), tradePolicy: id }),
      );
  };

  const handleSelectAdvertisingCampaign = (id: string) => {
    const w = worldRef.current;
    if (!w) return;
    w.demandControls.setAdvertisingCampaign(id);
    bump();
    void saveStore
      .load()
      .then((existing) =>
        saveStore.save({ ...(existing ?? {}), world: snapshotWorld(w) }),
      );
  };

  // Persist the list-price strategy choice into the active slot (#154). Same
  // merge-with-existing write as the trade policy above.
  const handleSelectPricingStrategy = (id: string) => {
    setPricingStrategyId(id);
    void saveStore
      .load()
      .then((existing) =>
        saveStore.save({ ...(existing ?? {}), pricingStrategy: id }),
      );
  };

  let content: React.ReactNode = <View style={styles.container} />;

  if (screen === 'main-menu') {
    content = (
      <>
        <StatusBar style="light" />
        <MainMenu
          saveStore={slotStore}
          onNewGame={() => {
            // The menu already created + selected the fresh slot. Mint a new
            // root seed for this game (so back-to-back new games don't clone),
            // then collect the character — it persists into the active slot.
            setNewGameSeed(makeSeed());
            nav.reset('character-creation');
          }}
          onContinue={() => void loadActiveSlotIntoGame()}
          onLoadGame={() => void loadActiveSlotIntoGame()}
        />
      </>
    );
  } else if (screen === 'character-creation') {
    content = (
      <>
        <StatusBar style="light" />
        <CharacterCreation
          saveStore={saveStore}
          masterSeed={newGameSeed}
          onComplete={(p: CharacterProfile) => {
            // New game → build the World from the freshly-minted seed that
            // CharacterCreation just persisted (#96).
            const w = createWorld({
              bus,
              masterSeed: newGameSeed,
              characterProfile: p,
              getTradePolicyMultiplier,
            });
            setWorld(w);
            setCash(w.economy.cash);
            setProfile(p);
            nav.reset('game');
          }}
        />
      </>
    );
  } else if (screen === 'auction' && world) {
    content = (
      <>
        <StatusBar style="light" />
        <AuctionMenu
          listings={world.inventory.getAuctionListings()}
          lotVehicles={lotVehicles}
          cash={cash}
          valuationFor={world.marketEconomy.valuationFor}
          sourceLabelFor={world.marketEconomy.sourceLabelFor}
          conditionReadFor={(l) =>
            world.staffOrg.assessCondition({
              id: l.id,
              reconEstimate: l.reconCost,
              condition: l.condition,
              mileage: l.mileage,
              sourceId: l.sourceId,
            })
          }
          bus={bus}
          inspectionCost={INSPECTION_COST}
          onBuy={(listingId) => world.inventory.buyFromAuction(listingId)}
          onRequestInspection={(listingId) => {
            world.inventory.requestInspection(listingId);
            setCash(world.economy.cash);
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'pricing' && world) {
    const { vehicleId } = nav.current.params as { vehicleId: string };
    const v = world.inventory.getLotVehicles().find((x) => x.id === vehicleId);
    if (!v) {
      // Unit sold/abandoned while the screen was queued — bounce to the game.
      content = <View style={styles.container} />;
      nav.back();
    } else {
      const { bookValue, marketPrice } = world.marketEconomy.valuationFor(v);
      const strategyEntry =
        PRICING_STRATEGIES.strategies[pricingStrategyId] ??
        PRICING_STRATEGIES.strategies[PRICING_STRATEGIES.defaultStrategy];
      const suggestion = suggestListPrice(
        { bookValue, marketPrice, strategy: pricingStrategyId },
        { config: PRICING_STRATEGIES },
      );
      const ucm = world.staffOrg.currentRoster.find(
        (s) => s.role_id === 'used-car-manager',
      );
      content = (
        <>
          <StatusBar style="light" />
          <PricingScreen
            vehicle={{
              id: v.id,
              year: v.year,
              make: v.make,
              model: v.model,
              trim: v.trim,
              bookValue,
              marketPrice,
              vehicleCost: v.purchasePrice + v.reconCost,
              initialAskingPrice: v.askingPrice,
              daysInInventory: v.daysInInventory,
              carryingCostToDate: v.carryingCostToDate,
              dailyCarryingCost: v.dailyCarryingCost,
              aged: v.aged,
              agedThresholdDays: AGED_THRESHOLD_DAYS,
            }}
            comps={deriveCompetitorComps(
              marketPrice,
              // #183: the live drifting roster (CompetitorMarket is now wired
              // into the World), so the comparables panel reflects the actual
              // post-drift market rather than the static base catalog.
              [...world.competitorMarket.getCompetitors()],
              { config: PRICING_STRATEGIES },
            ).slice(0, 4)}
            suggestion={{
              price: suggestion.suggestedPrice,
              source: ucm ? 'ucm' : 'heuristic',
              pricingSkill: ucm?.skills['pricing'],
              strategyLabel: strategyEntry.label,
            }}
            predictDays={(ask) =>
              world.marketEconomy.predictDaysToSell(
                { ...v, daysOnLot: v.daysInInventory },
                ask,
              )
            }
            classifyPosition={(ask) =>
              classifyPricePosition(ask, marketPrice, {
                config: PRICING_STRATEGIES,
              })
            }
            enabled={world.dayLoop.state().ownershipUnlocked}
            onCommit={(price) => {
              world.inventory.setAskingPrice(v.id, price);
              setLotVehicles(world.inventory.getLotVehicles());
            }}
            onClose={() => nav.back()}
          />
        </>
      );
    }
  } else if (screen === 'department' && world) {
    const dept = (nav.current.params as { dept: DeptKey }).dept;
    content = (
      <>
        <StatusBar style="light" />
        <DepartmentScreen
          title={DEPT_TITLES[dept]}
          items={world.departmentQueue.getQueue(dept)}
          onResolve={(id) => {
            world.departmentQueue.resolveItem(id);
            bump();
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'personnel' && world) {
    content = (
      <>
        <StatusBar style="light" />
        <PersonnelScreen
          roleId={HIRING_ROLE_ID}
          candidates={world.staffOrg.getCandidates(HIRING_ROLE_ID)}
          skillCaps={SKILL_CAPS}
          cash={cash}
          onHire={(candidateId) => {
            world.staffOrg.hire(candidateId);
            setCash(world.economy.cash);
          }}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'game' && profile && world) {
    const loopState = world.dayLoop.state();
    const floor = world.dayLoop.currentFloor();
    const funnel = world.capacityManager.getDayFunnel();
    const flooredValue = lotVehicles.reduce(
      (sum, v) => sum + v.purchasePrice + v.reconCost,
      0,
    );
    const avgDaysInInventory =
      lotVehicles.length === 0
        ? 0
        : lotVehicles.reduce((sum, v) => sum + v.daysInInventory, 0) /
          lotVehicles.length;
    const floorModel: FloorDashboardModel | undefined = floor
      ? {
          day: loopState.day,
          tick: floor.currentTick,
          ticksPerDay: floor.ticksPerDay,
          openHour: RENDER_LOOP.openHour,
          closeHour: RENDER_LOOP.closeHour,
          cash: world.economy.cash,
          exceptionPending: floor
            .grabbableCustomers()
            .some((c) => c.source === 'exception' && c.mustHandle),
          ups: funnel.walkedIn,
          sold: funnel.sold,
          pendingWarm: Math.max(0, funnel.walkedIn - funnel.staffEngaged),
          gross: grossToday,
          staff: world.staffOrg.currentRoster.map((s) => ({
            id: s.id,
            role: humanizeRole(s.role_id),
            department:
              staffTaxonomy.roles[s.role_id]?.department ?? 'unassigned',
          })),
          events: floorEvents,
          inventory: {
            unitsOnLot: lotVehicles.length,
            flooredValue,
            avgDaysInInventory,
          },
        }
      : undefined;
    // Just-ended-day recap (#119). In MANAGERIAL the funnel + running gross
    // still hold the day that just closed (both reset on the next
    // clock:day_started / handleNextDay). Absent on the night before Day 1.
    const recap: DayRecapModel | undefined = loopState.hasRecap
      ? {
          day: loopState.day,
          potentialTraffic: funnel.potentialTraffic,
          walkedIn: funnel.walkedIn,
          staffEngaged: funnel.staffEngaged,
          sold: funnel.sold,
          gross: grossToday,
          leakCause: funnel.leakCause,
          strongMatches: matchTally.strong,
          matchedSales: matchTally.matched,
        }
      : undefined;
    // MANAGERIAL pre-open ownership levers (#120). Assembled here in the
    // composition root; greyed by `ownershipUnlocked` (⇔ MANAGERIAL).
    const leverProps = {
      enabled: loopState.ownershipUnlocked,
      vehicles: lotVehicles.map((v) => ({
        id: v.id,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim,
        suggestedRetail: v.suggestedRetail,
        askingPrice: v.askingPrice,
        daysInInventory: v.daysInInventory,
        carryingCostToDate: v.carryingCostToDate,
        dailyCarryingCost: v.dailyCarryingCost,
        aged: v.aged,
      })),
      onSetAskingPrice: (vehicleId: string, price: number) => {
        world.inventory.setAskingPrice(vehicleId, price);
        setLotVehicles(world.inventory.getLotVehicles());
      },
      onOpenPricing: (vehicleId: string) => nav.navigate('pricing', { vehicleId }),
      pricingStrategyOptions: PRICING_STRATEGY_OPTIONS,
      pricingStrategyId,
      onSelectPricingStrategy: handleSelectPricingStrategy,
      onOpenAuction: () => nav.navigate('auction'),
      onOpenHiring: () => nav.navigate('personnel'),
      rosterCount: world.staffOrg.currentRoster.length,
      hoursOptions: HOURS_OF_OP.options,
      hoursOfOpId,
      onSelectHours: setHoursOfOpId,
      // Trade-policy lever (#172): strip the multiplier from the catalog (the
      // UI only needs id/label/blurb) and persist the choice per slot.
      tradePolicyOptions: TRADE_POLICY.policies.map((p) => ({
        id: p.id,
        label: p.label,
        blurb: p.blurb,
      })),
      tradePolicyId,
      onSelectTradePolicy: handleSelectTradePolicy,
      advertisingOptions: world.demandControls.advertisingOptions,
      advertisingCampaignId: world.demandControls.getAdvertisingCampaignId(),
      onSelectAdvertisingCampaign: handleSelectAdvertisingCampaign,
    };
    // Observed persona-mix readout (#198). Read live off DemandShaper each
    // render; reflects the trailing arrival window at MANAGERIAL time. #211
    // layers the active influence producers and the lot-coverage gap onto the
    // same read model so the mechanic stays reachable in the live flow.
    const observed = world.demandShaper.getObservedMix();
    const demandEntries: DemandReadoutEntry[] = observed.map((e) => ({
      persona: e.persona,
      label: PERSONA_LABELS[e.persona] ?? e.persona,
      share: e.share,
      count: e.count,
      trend: e.trend,
    }));
    const demandReadout: DemandReadoutModel = {
      entries: demandEntries,
      totalObserved: observed.reduce((sum, e) => sum + e.count, 0),
      targetingLevers: buildTargetingLevers(world),
      coverageGap: buildCoverageGap(demandEntries, lotVehicles),
    };
    content = (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.container}>
        <DayLoopShell
          profile={profile}
          state={loopState}
          tier={world.tierManager.currentTier}
          cash={world.economy.cash}
          reputation={world.reputation.reviewScore}
          onNextDay={handleNextDay}
          onOpenAuction={() => nav.navigate('auction')}
          floorModel={floorModel}
          floorControls={
            floor
              ? {
                  speed: floorLoop.speed,
                  speeds: floorLoop.speeds,
                  paused: floorLoop.paused,
                  onSetSpeed: (s) => {
                    if (floorLoop.paused) floorLoop.togglePause();
                    floorLoop.setSpeed(s);
                  },
                  onTogglePause: floorLoop.togglePause,
                  onSkipToClose: floorLoop.skipToClose,
                }
              : undefined
          }
          recap={recap}
          onExceptionPress={openHandPlay}
          onCherryPick={floor && floor.canGrab() ? cherryPick : undefined}
          leverProps={leverProps}
          demandReadout={demandReadout}
        />
        </View>
        <BottomNav
          badges={world.departmentQueue.getBadges()}
          onPress={handleDeptPress}
        />
      </View>
    );
  } else if (screen === 'end-card' && endCard) {
    // Terminal EndCard (#127 decision 2/5). The only Navigator-reset target of
    // the interrupt channel; "New Career" wipes the slot and returns to the
    // start menu (#195), where the player picks New Game (handleSaveCleared
    // clears profile/world and resets to main-menu).
    content = (
      <>
        <StatusBar style="light" />
        <EndCard
          visible
          data={endCard}
          onDismiss={() => {
            void saveStore.clear();
            setEndCard(null);
            handleSaveCleared();
          }}
        />
      </>
    );
  } else if (screen !== 'loading') {
    content = (
      <View style={styles.container}>
        <StatusBar style="auto" />
      </View>
    );
  }

  const handOutcome: HandPlayOutcome | null = !handSession
    ? null
    : handResult == null
      ? handSession.currentGate
        ? {
            status: 'continue',
            gate: handSession.currentGate,
            choices: handSession.choices.map((c) => ({
              id: c.id,
              label: c.label,
            })),
          }
        : null
      : handResult.status === 'walk'
        ? { status: 'walk', cause: handResult.outcome.cause }
        : { status: 'closed' };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <SafeAreaView
          style={styles.safeArea}
          edges={['top', 'bottom', 'left', 'right']}
        >
          {content}
        </SafeAreaView>
        <HandPlayModal
          visible={handSession != null}
          customerId={handSession?.customerId ?? null}
          playLive={HAND_PLAY_LIVE}
          outcome={handOutcome}
          onChoose={chooseApproach}
          onClose={closeHandPlay}
        />
        {monthClose != null && world && (
          <MonthCloseInterstitial
            model={{
              month: monthClose,
              tier: 1,
              isUnlocked: world.kpiDashboard.isUnlocked,
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
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#111',
  },
});
