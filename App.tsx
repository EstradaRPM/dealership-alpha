import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  AppState,
  type ImageSourcePropType,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  createLegacyStore,
  createMultiSlotSaveStore,
  createSnapshotStore,
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
import { loadStaffArchetypes, loadStaffTaxonomy } from './src/game/NPC';
import { createWorld, makeSeed, type World } from './src/createWorld';
import {
  snapshotWorld,
  restoreWorld,
  type WorldSnapshot,
  type PersistedWorldSnapshot,
} from './src/worldSnapshot';
import { ThemeProvider } from './src/ui/theme';
import { CharacterCreation } from './src/ui/CharacterCreation';
import { MainMenu } from './src/ui/MainMenu';
import { InGameMenu } from './src/ui/InGameMenu';
import {
  AppShell,
  loadNavTabs,
  type ShellTab,
  type ShellTabKey,
  type ShellStat,
} from './src/ui/AppShell';
import {
  HomeTab,
  buildHomeDashboard,
  buildGateStrip,
  type CashDeltaSplit,
} from './src/ui/HomeTab';
import { DAYS_PER_WEEK, DAYS_PER_YEAR } from './src/game/GameClock';
import { OperationsTab } from './src/ui/OperationsTab';
import { StrategicTab } from './src/ui/StrategicTab';
import { SettingsScreen } from './src/ui/SettingsScreen';
import { LegacyWallView } from './src/ui/LegacyWall';
import { DayRecapModal, type DayRecapModel } from './src/ui/DayRecap';
import type {
  DemandCoverageGap,
  DemandReadoutEntry,
  DemandReadoutModel,
  DemandTargetingLever,
} from './src/ui/DemandReadout';
import { SALES_ARCHETYPES } from './src/game/CustomerPool';
import {
  FloorDashboard,
  type FloorDashboardModel,
  type FloorEvent,
  type FloorControls,
  type RegulatoryPressureModel,
} from './src/ui/FloorDashboard';
import { HandPlayModal, type HandPlayOutcome } from './src/ui/HandPlayModal';
import {
  TradeEscalationModal,
  type TradeDecision,
  type TradeReview,
} from './src/ui/TradeEscalationModal';
import {
  DiscountEscalationModal,
  type DiscountDecision,
  type DiscountReview,
} from './src/ui/DiscountEscalationModal';
import { useFloorRenderLoop } from './src/ui/FloorRenderLoop';
import { AuctionMenu } from './src/ui/AuctionMenu';
import {
  PersonnelScreen,
  type PersonnelRoleOption,
} from './src/ui/PersonnelScreen';
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
  SaveState,
  MultiSlotSaveStore,
  DriverFactory,
  LegacyEntry,
  LegacyStore,
  MidDayCheckpoint,
  SnapshotStore,
  SlotMetadata,
  WeeklySnapshot,
} from './src/game/SaveStore';
import type { LotVehicle } from './src/game/Inventory';
import { AdminConsole } from './src/ui/AdminConsole';
import { MonthCloseInterstitial } from './src/ui/MonthCloseInterstitial';
import { KPIDashboard } from './src/ui/KPIDashboard';
import { HistoryScreen } from './src/ui/HistoryScreen';
import { ChapterCard } from './src/ui/NarrativeBeat';
import { EndCard } from './src/ui/EndCard';
import type { EndCardData } from './src/game/EndCard';
import { loadRegulatoryTunables } from './src/game/Reputation';
import { useNavigator } from './src/ui/Navigator';
import { DepartmentScreen } from './src/ui/DepartmentScreen';
import type { DeptKey } from './src/game/DepartmentQueue';
import { loadTierConfig } from './src/game/CareerProgression';

// Tier-keyed hero art for the shell's header backdrop. Metro requires static
// require() calls — the map must live at module scope.
const HERO_BY_TIER: Partial<Record<number, ImageSourcePropType>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  1: require('./assets/hero/lot-tier1.jpg'),
  // 2 and 3 added when art lands (#251)
};

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

// Hours-of-op lever options (#120/#207). The selected option's scaled
// ticksPerDay is fed into FloorSim (via getHoursOfOpTicksPerDay → createWorld →
// the floor seam → createFloorSim's additive ticksPerDay override), so a longer
// shift literally runs more ticks — observable on the FLOOR-OPEN HUD clock.
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
const REGULATORY_TUNABLES = loadRegulatoryTunables();

// Tier ladder labels for the shell header (#215). Seed-free.
const TIER_CONFIG = loadTierConfig();

const DEFAULT_HIRING_ROLE_ID = 'salesperson';

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
function snapshotKey(slotId: string): string {
  return `snapshot:${slotId}`;
}

interface AppServices {
  bus: ReturnType<typeof createEventBus>;
  saveStore: SaveStore;
  slotStore: MultiSlotSaveStore;
  legacyStore: LegacyStore;
  snapshotStoreForActiveSlot(): Promise<SnapshotStore | null>;
}

function createAppServices(driverFactory: DriverFactory): AppServices {
  const slotStore: MultiSlotSaveStore = createMultiSlotSaveStore(driverFactory);
  const legacyStore: LegacyStore = createLegacyStore(driverFactory('legacy-wall'));
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

  return {
    bus: createEventBus(),
    saveStore,
    slotStore,
    legacyStore,
    async snapshotStoreForActiveSlot() {
      const activeSlotId = await slotStore.getActiveSlotId();
      return activeSlotId === null
        ? null
        : createSnapshotStore(driverFactory(snapshotKey(activeSlotId)));
    },
  };
}

// staffTaxonomy is seed-free: kept module-level so SKILL_CAPS (PersonnelScreen
// bars, #120) and the FLOOR-OPEN staff-strip department lookup don't depend on
// a built World.
const staffTaxonomy = loadStaffTaxonomy();
const staffArchetypes = loadStaffArchetypes();
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

const HIRABLE_ROLE_IDS = new Set(
  Object.values(staffArchetypes).map((a) => a.role_id),
);

function buildHiringRoleOptions(tier: number): PersonnelRoleOption[] {
  return Object.entries(staffTaxonomy.roles)
    .filter(([roleId, role]) => {
      if (!HIRABLE_ROLE_IDS.has(roleId)) return false;
      if (
        roleId !== DEFAULT_HIRING_ROLE_ID &&
        role.tier !== 'manager' &&
        role.tier !== 'gm'
      ) {
        return false;
      }
      return (role.hireTier ?? 1) <= tier;
    })
    .map(([id]) => ({ id, label: humanizeRole(id) }))
    .sort((a, b) => {
      if (a.id === DEFAULT_HIRING_ROLE_ID) return -1;
      if (b.id === DEFAULT_HIRING_ROLE_ID) return 1;
      return a.label.localeCompare(b.label);
    });
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

// Shape-check the persisted cash-delta split (#255) coming back out of the
// untyped save envelope; anything malformed degrades to "no delta yet".
function readPersistedCashDelta(value: unknown): CashDeltaSplit | null {
  if (value == null || typeof value !== 'object') return null;
  const { ops, stock } = value as Partial<CashDeltaSplit>;
  return typeof ops === 'number' && typeof stock === 'number'
    ? { ops, stock }
    : null;
}

export interface DealershipAppProps {
  driverFactory?: DriverFactory;
  onServicesReady?: (services: AppServices) => void;
}

export function DealershipApp({
  driverFactory,
  onServicesReady,
}: DealershipAppProps) {
  const servicesRef = useRef<AppServices | null>(null);
  if (servicesRef.current === null) {
    servicesRef.current = createAppServices(
      driverFactory ?? createSqliteDriverFactory(),
    );
  }
  const { bus, saveStore, slotStore, legacyStore, snapshotStoreForActiveSlot } =
    servicesRef.current;
  useEffect(() => {
    onServicesReady?.(servicesRef.current as AppServices);
  }, [onServicesReady]);
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
  // Cash "vs yesterday" delta for the Home dashboard (#230, split #255). The
  // refs hold the prior day's closing cash and the lifetime stock-acquisition
  // spend at that close; the day-complete handler diffs both against the live
  // Economy figures to split the day into an operating delta + an "into stock"
  // line, then re-snapshots. Null until the first day closes. Both baselines
  // and the computed split ride the save envelope (#255), so a load shows the
  // last closed day's delta immediately and the next close diffs correctly
  // even when the save was written mid-managerial-phase.
  const prevDayCashRef = useRef<number | null>(null);
  const prevDayAcquisitionSpendRef = useRef<number | null>(null);
  const [cashDelta, setCashDelta] = useState<CashDeltaSplit | null>(null);
  // Active shell tab, lifted out of AppShell so it survives a round-trip
  // through a sub-screen (auction / pricing / a department). The shell unmounts
  // on those navigations; without lifting this the tab would reset to Home on
  // return. Controlled via AppShell's activeTabKey/onTabChange.
  const [shellTab, setShellTab] = useState<ShellTabKey>('home');
  // Hours-of-op lever selection (#120/#207). The selected option's scaled
  // ticksPerDay is fed into FloorSim via a live getter (below), so a longer
  // shift literally makes the day run more ticks. The ref keeps the getter
  // reading the current selection without rebuilding the world; the lever is
  // greyed during FLOOR_OPEN, so the value is stable for the whole day
  // (replay-safe per the #99 determinism invariant).
  const [hoursOfOpId, setHoursOfOpId] = useState(HOURS_OF_OP.defaultId);
  const hoursOfOpIdRef = useRef(HOURS_OF_OP.defaultId);
  hoursOfOpIdRef.current = hoursOfOpId;
  const getHoursOfOpTicksPerDay = () => {
    const opt = HOURS_OF_OP.options.find((o) => o.id === hoursOfOpIdRef.current);
    return (opt ?? HOURS_OF_OP.options[0]).ticksPerDay;
  };
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
  const [selectedHiringRoleId, setSelectedHiringRoleId] = useState(
    DEFAULT_HIRING_ROLE_ID,
  );
  // Running today's gross (front + back) summed from closed deals — the
  // composed-state source for the FLOOR-OPEN HUD / stat grid (#116).
  const [grossToday, setGrossToday] = useState(0);
  // Per-day FLOOR-OPEN event log (#117): walk heartbeats as transient lines,
  // forced exceptions as tappable alert rows. Reset each "Next Day".
  const [floorEvents, setFloorEvents] = useState<readonly FloorEvent[]>([]);
  const eventSeq = useRef(0);
  // Per-day inventory-buyer match tally (#199): closed deals scored for
  // stock-vs-buyer fit, and how many cleared the strong-match threshold. Held
  // in a ref (not display state — the live beat is the floor toast) so the
  // day-close handler reads the final tally synchronously when it assembles the
  // recap. Reset each "Next Day" alongside grossToday/floorEvents.
  const matchTallyRef = useRef({ strong: 0, matched: 0 });
  // Mirror of `grossToday` updated synchronously in the close handler, so the
  // day-close recap captures the final figure without waiting on a re-render
  // (the state copy still feeds the live HUD / gate strip). Reset each day.
  const grossTodayRef = useRef(0);
  // Last completed day's recap (#253), the single source for both the modal
  // that pops on day close and the Today-region reopen chip. Persisted in the
  // save envelope so the chip — and its truthfulness — survives a reload;
  // restored on load, so a Day-15 save never falls back to "Night before Day 1".
  const [lastRecap, setLastRecap] = useState<DayRecapModel | null>(null);
  // Whether the recap modal is currently popped over Home (#253). Set true on
  // day close, dismissable, reopenable from the chip.
  const [recapModalOpen, setRecapModalOpen] = useState(false);
  // Re-render trigger for the headless DayLoopController lifecycle.
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  // Hand-play spotlight (#118). The composition root owns the grabbed
  // FloorSim session; the modal is a thin view that renders the pending gate
  // and dispatches the picked approach back through advance().
  const [handSession, setHandSession] = useState<HandPlaySession | null>(null);
  const [handResult, setHandResult] = useState<AdvanceResult | null>(null);
  const [tradeReview, setTradeReview] = useState<TradeReview | null>(null);
  const [tradeCounterResult, setTradeCounterResult] = useState<{
    readonly amount: number;
    readonly accepted: boolean;
  } | null>(null);
  const [discountReview, setDiscountReview] = useState<DiscountReview | null>(
    null,
  );
  const [discountCounterResult, setDiscountCounterResult] = useState<{
    readonly amount: number;
    readonly accepted: boolean;
  } | null>(null);
  // Month-close interstitial (#123): the 1-based month that just closed, or
  // null when none is pending. Set on clock:month_ended, cleared on dismiss —
  // the MANAGERIAL interrupt point between the day-recap and next-day prep.
  const [monthClose, setMonthClose] = useState<number | null>(null);
  const [settingsSnapshots, setSettingsSnapshots] = useState<
    readonly WeeklySnapshot[]
  >([]);
  const [inGameSlots, setInGameSlots] = useState<readonly SlotMetadata[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [inGameMenuStatus, setInGameMenuStatus] = useState('');
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
  const [legacyWallLegacies, setLegacyWallLegacies] = useState<
    readonly LegacyEntry[]
  >([]);

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
      tradeReview != null ||
      discountReview != null ||
      screen === 'in-game-menu' ||
      screen === 'kpi-dashboard' ||
      screen === 'history' ||
      (screen === 'settings' && world != null) ||
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
  const decideTrade = (decision: TradeDecision) => {
    if (!tradeReview) return;
    const result = worldRef.current?.resolvePlayerTradeDecision(
      tradeReview.customerId,
      decision,
    );
    if (!result) return;
    if (result.status === 'counter_rejected') {
      setTradeCounterResult({
        amount: result.amount,
        accepted: result.accepted,
      });
      return;
    }
    setTradeReview(null);
    setTradeCounterResult(null);
    const w = worldRef.current;
    if (w) {
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    }
    bump();
  };
  const decideDiscount = (decision: DiscountDecision) => {
    if (!discountReview) return;
    const result = worldRef.current?.resolvePlayerDiscountDecision(
      discountReview.customerId,
      decision,
    );
    if (!result) return;
    if (result.status === 'counter_rejected') {
      setDiscountCounterResult({
        amount: result.amount,
        accepted: result.accepted,
      });
      return;
    }
    setDiscountReview(null);
    setDiscountCounterResult(null);
    const w = worldRef.current;
    if (w) {
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    }
    bump();
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
    } else {
      tradePolicyIdRef.current = TRADE_POLICY.defaultId;
      setTradePolicyId(TRADE_POLICY.defaultId);
    }
    // Restore the persisted per-slot list-price strategy (#154).
    if (typeof state.pricingStrategy === 'string') {
      setPricingStrategyId(state.pricingStrategy);
    } else {
      setPricingStrategyId(PRICING_STRATEGIES.defaultStrategy);
    }
    if (typeof state.hoursOfOp === 'string') {
      setHoursOfOpId(state.hoursOfOp);
    } else {
      setHoursOfOpId(HOURS_OF_OP.defaultId);
    }
    const w = createWorld({
      bus,
      masterSeed: seed,
      characterProfile: character,
      getTradePolicyMultiplier,
      getHoursOfOpTicksPerDay,
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
    // Restore the persisted vs-yesterday baselines + the last computed delta
    // split (#255), so the Home card shows the last closed day's delta right
    // away instead of staying blank until the next close. The persisted
    // baselines (closing cash + lifetime stock spend at the last day close)
    // beat re-seeding from live figures, which a mid-managerial-phase save
    // would have polluted with post-close auction buys. Pre-#255 saves lack
    // all three fields → old behavior (re-seed, blank delta) as the fallback.
    prevDayCashRef.current =
      typeof state.prevDayCash === 'number' ? state.prevDayCash : w.economy.cash;
    prevDayAcquisitionSpendRef.current =
      typeof state.prevDayAcquisitionSpend === 'number'
        ? state.prevDayAcquisitionSpend
        : w.economy.inventoryAcquisitionSpend;
    setCashDelta(readPersistedCashDelta(state.cashDelta));
    // Restore the persisted last-day recap (#253): the chip reflects the real
    // last closed day, so a Day-15 save never shows "Night before Day 1". The
    // modal does not auto-pop on load — it pops only on an actual day close.
    setLastRecap((state.lastRecap as DayRecapModel | undefined) ?? null);
    setRecapModalOpen(false);
    setLotVehicles(w.inventory.getLotVehicles());
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

  const refreshSettingsSnapshots = async () => {
    const snapshotStore = await snapshotStoreForActiveSlot();
    setSettingsSnapshots(
      snapshotStore ? await snapshotStore.listSnapshots() : [],
    );
  };

  const refreshInGameSlots = async () => {
    const [slots, active] = await Promise.all([
      slotStore.listSlots(),
      slotStore.getActiveSlotId(),
    ]);
    setInGameSlots(slots);
    setActiveSlotId(active);
  };

  const buildCurrentSaveState = async (
    overrides: SaveState = {},
    worldSnapshot?: WorldSnapshot,
  ): Promise<SaveState> => {
    const existing = await saveStore.load();
    const liveWorld = worldSnapshot ?? (worldRef.current
      ? snapshotWorld(worldRef.current)
      : undefined);
    return {
      ...(existing ?? {}),
      ...(liveWorld ? { world: liveWorld } : {}),
      ...overrides,
    };
  };

  const persistCurrentSave = (overrides: SaveState = {}) => {
    void (async () => {
      await saveStore.save(await buildCurrentSaveState(overrides));
    })();
  };

  const saveCurrentGame = async () => {
    const w = worldRef.current;
    if (!w) return;
    const worldSnapshot = snapshotWorld(w);
    const nextState = await buildCurrentSaveState({}, worldSnapshot);
    await saveStore.save(nextState);
    const cp = w.dayLoop.checkpoint();
    if (cp) {
      await slotStore.writeCheckpoint(cp);
    } else {
      await slotStore.clearCheckpoint();
    }
    await refreshInGameSlots();
  };

  const openInGameMenu = () => {
    setInGameMenuStatus('');
    void refreshInGameSlots();
    nav.navigate('in-game-menu');
  };

  const handleManualSave = async () => {
    setInGameMenuStatus('Saving...');
    try {
      await saveCurrentGame();
      setInGameMenuStatus('Saved.');
    } catch (err) {
      console.error('Save current game failed', err);
      setInGameMenuStatus('Save failed. Check the Expo console.');
    }
  };

  const handleInGameLoadSlot = async (slotId: string) => {
    try {
      setInGameMenuStatus('Saving current game...');
      await saveCurrentGame();
      setInGameMenuStatus('Loading save...');
      await slotStore.selectSlot(slotId);
      await loadActiveSlotIntoGame();
      setInGameMenuStatus('');
    } catch (err) {
      console.error('Save and load failed', err);
      setInGameMenuStatus('Save/load failed. Check the Expo console.');
    }
  };

  const resetSessionState = () => {
    setProfile(null);
    setWorld(null);
    setLotVehicles([]);
    setCash(0);
    setCashDelta(null);
    prevDayCashRef.current = null;
    prevDayAcquisitionSpendRef.current = null;
    setGrossToday(0);
    grossTodayRef.current = 0;
    setFloorEvents([]);
    matchTallyRef.current = { strong: 0, matched: 0 };
    setLastRecap(null);
    setRecapModalOpen(false);
    setHandSession(null);
    setHandResult(null);
    setTradeReview(null);
    setTradeCounterResult(null);
    setDiscountReview(null);
    setDiscountCounterResult(null);
    setMonthClose(null);
    setChapterQueue([]);
    setEndCard(null);
  };

  const handleReturnToMainMenu = async () => {
    try {
      setInGameMenuStatus('Saving current game...');
      await saveCurrentGame();
      resetSessionState();
      setInGameMenuStatus('');
      nav.reset('main-menu');
    } catch (err) {
      console.error('Save and return to main menu failed', err);
      setInGameMenuStatus('Save failed. Check the Expo console.');
    }
  };

  const openSettings = () => {
    setSettingsSnapshots([]);
    void refreshSettingsSnapshots();
    nav.navigate('settings');
  };

  const openLegacyWall = () => {
    setLegacyWallLegacies([]);
    void (async () => {
      setLegacyWallLegacies(await legacyStore.listLegacies());
    })();
    nav.navigate('legacy-wall');
  };

  const openKPIDashboard = () => {
    nav.navigate('kpi-dashboard');
  };

  const openHistory = () => {
    nav.navigate('history');
  };

  const handleRollback = async (index: number) => {
    const snapshotStore = await snapshotStoreForActiveSlot();
    const state = await snapshotStore?.rollbackToSnapshot(index);
    if (!state) {
      await refreshSettingsSnapshots();
      return;
    }
    await saveStore.save(state);
    await slotStore.clearCheckpoint();
    await loadActiveSlotIntoGame();
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
        // blob (preserving character/seed/policy — the same merge-with-existing
        // write the policy/strategy setters use). The adapter derives the
        // slot's `day` metadata from this snapshot. The recap rides the same
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

    const onTradeEscalated = ({
      customerId,
      currentVehicle,
      book,
      allowanceAsk,
      payoff,
      target,
      recommendedCounter,
      staffConfidence,
    }: {
      customerId: string;
      currentVehicle: TradeReview['currentVehicle'];
      book: number;
      allowanceAsk: number;
      payoff: number;
      target: number;
      recommendedCounter: number;
      staffConfidence: number;
    }) => {
      setTradeCounterResult(null);
      setTradeReview({
        customerId,
        currentVehicle,
        book,
        allowanceAsk,
        payoff,
        target,
        recommendedCounter,
        staffConfidence,
      });
    };

    const onDiscountEscalated = ({
      customerId,
      vehicle,
      marketPrice,
      customerAskPrice,
      salespersonFloorPrice,
      recommendedCounter,
      minimumAcceptablePrice,
      frontGrossAtFloor,
      canAcceptAsk,
    }: {
      customerId: string;
      vehicle: DiscountReview['vehicle'];
      marketPrice: number;
      customerAskPrice: number;
      salespersonFloorPrice: number;
      recommendedCounter: number;
      minimumAcceptablePrice: number;
      frontGrossAtFloor: number;
      canAcceptAsk: boolean;
    }) => {
      setDiscountCounterResult(null);
      setDiscountReview({
        customerId,
        vehicle,
        marketPrice,
        customerAskPrice,
        salespersonFloorPrice,
        recommendedCounter,
        minimumAcceptablePrice,
        frontGrossAtFloor,
        canAcceptAsk,
      });
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
    bus.subscribe('inventory:vehicle_acquired_via_trade', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    bus.subscribe('deal:closed', onDealClosed);
    bus.subscribe('staff:auto_resolved', onAutoResolved);
    bus.subscribe('floor:exception_raised', onExceptionRaised);
    bus.subscribe('trade:escalated', onTradeEscalated);
    bus.subscribe('discount:escalated', onDiscountEscalated);
    return () => {
      bus.unsubscribe('floor:day_complete', onDayComplete);
      bus.unsubscribe('clock:month_ended', onMonthEnded);
      bus.unsubscribe('career:tier_up', onTierUp);
      bus.unsubscribe('career:game_over', onGameOver);
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_acquired_via_trade', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
      bus.unsubscribe('deal:closed', onDealClosed);
      bus.unsubscribe('staff:auto_resolved', onAutoResolved);
      bus.unsubscribe('floor:exception_raised', onExceptionRaised);
      bus.unsubscribe('trade:escalated', onTradeEscalated);
      bus.unsubscribe('discount:escalated', onDiscountEscalated);
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
    grossTodayRef.current = 0;
    setFloorEvents([]);
    matchTallyRef.current = { strong: 0, matched: 0 };
    // Leaving MANAGERIAL → the day-close recap modal is done; the chip keeps
    // the prior recap reachable until the next day closes over it (#253).
    setRecapModalOpen(false);
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
    resetSessionState();
    nav.reset('main-menu');
  };

  const handleEndCardDismiss = () => {
    const completed = endCard;
    void (async () => {
      try {
        if (completed) {
          await legacyStore.appendLegacy({
            playerName: completed.playerName,
            backstoryId: completed.backstoryId,
            careerYear: completed.careerYear,
            tierReached: completed.tierReached,
            reason: completed.reason,
            flavorText: completed.flavorText,
            completedAt: new Date().toISOString(),
          });
        }
        await saveStore.clear();
        setEndCard(null);
        handleSaveCleared();
      } catch (err) {
        console.error('End-card dismissal failed', err);
      }
    })();
  };

  // Persist the trade-policy choice into the active slot (#172). Mirrors
  // CharacterCreation's merge-with-existing write so the character/seed blob is
  // preserved. The ref updates immediately so the live multiplier getter
  // reflects the new policy before the persist resolves.
  const handleSelectTradePolicy = (id: string) => {
    tradePolicyIdRef.current = id;
    setTradePolicyId(id);
    persistCurrentSave({ tradePolicy: id });
  };

  const handleSelectAdvertisingCampaign = (id: string) => {
    const w = worldRef.current;
    if (!w) return;
    w.demandControls.setAdvertisingCampaign(id);
    bump();
    persistCurrentSave();
  };

  // Persist the list-price strategy choice into the active slot (#154). Same
  // merge-with-existing write as the trade policy above.
  const handleSelectPricingStrategy = (id: string) => {
    setPricingStrategyId(id);
    persistCurrentSave({ pricingStrategy: id });
  };

  const handleSelectHours = (id: string) => {
    setHoursOfOpId(id);
    persistCurrentSave({ hoursOfOp: id });
  };

  let content: React.ReactNode = <View style={styles.container} />;
  // True while the management AppShell is on screen: its hero header bleeds
  // behind the status bar, so the root SafeAreaView must NOT pad the top edge
  // (the shell pads its own content by the inset). Every other screen keeps
  // the full inset.
  let shellOwnsTopInset = false;

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
            setHoursOfOpId(HOURS_OF_OP.defaultId);
            tradePolicyIdRef.current = TRADE_POLICY.defaultId;
            setTradePolicyId(TRADE_POLICY.defaultId);
            setPricingStrategyId(PRICING_STRATEGIES.defaultStrategy);
            nav.reset('character-creation');
          }}
          onContinue={() => void loadActiveSlotIntoGame()}
          onLoadGame={() => void loadActiveSlotIntoGame()}
          onSettings={openSettings}
          onLegacyWall={openLegacyWall}
        />
      </>
    );
  } else if (screen === 'settings') {
    content = (
      <>
        <StatusBar style="light" />
        <SettingsScreen
          snapshots={settingsSnapshots}
          onRollback={(index) => void handleRollback(index)}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'legacy-wall') {
    content = (
      <>
        <StatusBar style="light" />
        <LegacyWallView
          visible
          legacies={legacyWallLegacies}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'in-game-menu') {
    content = (
      <>
        <StatusBar style="light" />
        <InGameMenu
          slots={inGameSlots}
          activeSlotId={activeSlotId}
          status={inGameMenuStatus}
          onClose={() => nav.back()}
          onSave={() => void handleManualSave()}
          onLoadSlot={(slotId) => void handleInGameLoadSlot(slotId)}
          onReturnToMainMenu={() => void handleReturnToMainMenu()}
          onSettings={openSettings}
          onKPIDashboard={openKPIDashboard}
          onHistory={openHistory}
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
              getHoursOfOpTicksPerDay,
            });
            setWorld(w);
            setCash(w.economy.cash);
            // Seed the vs-yesterday baselines (#230/#255): first day's delta
            // is measured against the night-before-Day-1 cash + (zero)
            // lifetime stock spend.
            prevDayCashRef.current = w.economy.cash;
            prevDayAcquisitionSpendRef.current = w.economy.inventoryAcquisitionSpend;
            setCashDelta(null);
            // Fresh game → no recap yet; Home shows honest pre-Day-1 copy (#253).
            setLastRecap(null);
            setRecapModalOpen(false);
            setProfile(p);
            nav.reset('game');
          }}
        />
      </>
    );
  } else if (screen === 'kpi-dashboard' && world) {
    content = (
      <>
        <StatusBar style="light" />
        <KPIDashboard
          snapshot={world.kpiDashboard.getSnapshot()}
          onClose={() => nav.back()}
        />
      </>
    );
  } else if (screen === 'history' && world) {
    content = (
      <>
        <StatusBar style="light" />
        <HistoryScreen
          entries={world.historyLog.getEntries()}
          onClose={() => nav.back()}
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
          onBuy={(listingId) => {
            world.inventory.buyFromAuction(listingId);
            persistCurrentSave();
          }}
          onRequestInspection={(listingId) => {
            world.inventory.requestInspection(listingId);
            setCash(world.economy.cash);
            persistCurrentSave();
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
              persistCurrentSave();
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
    const roleOptions = buildHiringRoleOptions(world.tierManager.currentTier);
    const selectedRoleId = roleOptions.some(
      (role) => role.id === selectedHiringRoleId,
    )
      ? selectedHiringRoleId
      : roleOptions[0]?.id ?? DEFAULT_HIRING_ROLE_ID;
    content = (
      <>
        <StatusBar style="light" />
        <PersonnelScreen
          roleOptions={roleOptions}
          selectedRoleId={selectedRoleId}
          candidates={world.staffOrg.getCandidates(selectedRoleId)}
          roster={world.staffOrg.currentRoster}
          skillCaps={SKILL_CAPS}
          cash={cash}
          onSelectRole={setSelectedHiringRoleId}
          onHire={(candidateId) => {
            world.staffOrg.hire(candidateId);
            setCash(world.economy.cash);
            bump();
          }}
          onFire={(staffId) => {
            world.staffOrg.fire(staffId);
            bump();
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
    const regulatoryPressure: RegulatoryPressureModel = {
      pressure: world.regulatoryMeter.pressure,
      max: REGULATORY_TUNABLES.pressureMax,
    };
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
          regulatoryPressure,
          staff: world.staffOrg.currentRoster.map((s) => ({
            id: s.id,
            role: humanizeRole(s.role_id),
            department:
              staffTaxonomy.roles[s.role_id]?.department ?? 'unassigned',
            morale: world.staffMorale.getMorale(s.id),
          })),
          events: floorEvents,
          inventory: {
            unitsOnLot: lotVehicles.length,
            flooredValue,
            avgDaysInInventory,
          },
        }
      : undefined;
    // Last-day recap reopen chip (#253). Driven by the persisted/captured
    // `lastRecap`, not the live funnel — so it stays present and truthful after
    // a reload (the funnel zeroes each day and isn't restored). Absent only
    // when no day has closed yet, where Home shows honest pre-Day-1 copy.
    const recapChip = lastRecap
      ? { day: lastRecap.day, onOpen: () => setRecapModalOpen(true) }
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
        persistCurrentSave();
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
      onSelectHours: handleSelectHours,
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
    // Live-clock speed/pause controls (#121), wired into the floor MODE.
    const floorControls: FloorControls | undefined = floor
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
      : undefined;
    // Shell header chrome (#215): business identity + the consequence strip.
    const tierEntry =
      TIER_CONFIG.tiers[world.tierManager.currentTier - 1] ??
      TIER_CONFIG.tiers[0];
    // Cash / reputation / tier now live once in the richer Home dashboard cards
    // (#238 HITL): the shell header already carries name + tier identity, so the
    // top strip keeps only REG PRESSURE — the one status with no other home.
    const headerStats: ShellStat[] = [
      {
        label: 'REG PRESSURE',
        value: `${Math.round(regulatoryPressure.pressure)}/${Math.round(regulatoryPressure.max)}`,
      },
    ];
    // Home status dashboard (#230): formatted entirely in the model builder from
    // primitives read off the live World. The inventory nudge reuses the demand
    // coverage gap (recent buyers wanting a category the lot can't cover) and
    // deep-links into Operations.
    // Weather readout (#231): today's conditions + an honest one-day forecast.
    // Both are pure projections of (masterSeed, day) off the live World.
    const todayWeather = world.weather.weatherForDay(world.clock.currentDay);
    const forecastWeather = world.weather.weatherForDay(world.clock.currentDay + 1);
    // Season demand lean (#231 S2): the SPACED axes today's season nudges
    // buyer wants toward, highest lean first — the readable surface of the
    // want-vector bias the auto-resolve match runs through. Positive deltas
    // only (what the season *favors*); the effect itself is emergent.
    const seasonLean = Object.entries(world.weather.wantLeanForDay(world.clock.currentDay))
      .filter(([, delta]) => delta > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([axis]) => axis);
    // Vehicle-attribute demand lean (#231 S4): the attribute axes today's
    // weather (season + condition) favors — the readable surface of the match
    // tilt toward weather-aligned units (snow → AWD, summer → open-top).
    // Positive leans only (what the day *favors*); the effect itself is emergent.
    const weatherLean = Object.entries(
      world.weather.attributeLeanForDay(world.clock.currentDay),
    )
      .filter(([, delta]) => delta > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([axis]) => axis);
    // Monthly tier-gate progress strip (#233 S3b): the engine's live per-face
    // projections, structured into the full gate strip — pace bars, cash gauge,
    // CSI sparkline, % on track. The day's haul (the just-closed day's units +
    // gross, while the recap still holds) is the daily-contribution tick that
    // visibly fills the bars (decision 1's reward beat).
    const gateModel = buildGateStrip(
      world.tierGate.getProgress(),
      loopState.hasRecap
        ? { units: funnel.sold, gross: grossToday }
        : undefined,
    );
    const homeDashboard = buildHomeDashboard({
      businessName: world.tierManager.businessName || `${profile.name}'s Lot`,
      tierLabel: `Tier ${world.tierManager.currentTier} — ${tierEntry.label}`,
      tier: world.tierManager.currentTier,
      cash: world.economy.cash,
      cashDelta,
      reputation: world.reputation.reviewScore,
      currentDay: world.clock.currentDay,
      season: world.clock.currentSeason,
      daysPerWeek: DAYS_PER_WEEK,
      daysPerMonth: DAYS_PER_MONTH,
      daysPerYear: DAYS_PER_YEAR,
      pendingLeads: world.departmentQueue.getQueue('sales').length,
      inventoryCount: lotVehicles.length,
      inService: world.departmentQueue.getQueue('service').length,
      gate: gateModel.faces.length > 0 ? gateModel : undefined,
      weather: {
        temperatureF: todayWeather.temperatureF,
        conditionLabel: todayWeather.conditionLabel,
        forecastTemperatureF: forecastWeather.temperatureF,
        forecastConditionLabel: forecastWeather.conditionLabel,
        seasonLean,
        weatherLean,
        // #231 S3: daily weather → traffic-volume outlook. Surfacing tomorrow's
        // makes reading the forecast an actionable planning signal.
        trafficOutlook: world.weather.trafficOutlookForDay(world.clock.currentDay),
        forecastTrafficOutlook: world.weather.trafficOutlookForDay(
          world.clock.currentDay + 1,
        ),
      },
    });
    // The fixed 5-tab IA (#215). All five tabs are ALWAYS present — navigation
    // is never gated by tier; progression is altitude rising inside a surface,
    // not tabs appearing/disappearing (spine §2). Home + Operations back live
    // surfaces today; People/Finance/Growth show a placeholder until their own
    // per-surface rebrand slice lands. Per-tab content is selected by key.
    const tabContent: Record<ShellTabKey, React.ReactNode> = {
      home: (
        <HomeTab
          state={loopState}
          dashboard={homeDashboard}
          onOpenOperations={() => setShellTab('operations')}
          recapChip={recapChip}
          demandReadout={demandReadout}
        />
      ),
      operations: (
        <OperationsTab
          badges={world.departmentQueue.getBadges()}
          onDeptPress={handleDeptPress}
          leverProps={leverProps}
          onOpenAuction={() => nav.navigate('auction')}
        />
      ),
      people: null,
      finance: null,
      growth: null,
    };
    const shellTabs: ShellTab[] = loadNavTabs().map((tab) => ({
      key: tab.key,
      label: tab.label,
      content:
        tabContent[tab.key] ??
        (tab.tagline ? (
          <StrategicTab title={tab.label} tagline={tab.tagline} />
        ) : null),
    }));
    const floorIsOpen = loopState.phase === 'FLOOR_OPEN' && !!floorModel;
    shellOwnsTopInset = !floorIsOpen;
    content = (
      <View style={styles.container}>
        <StatusBar style="light" />
        {loopState.phase === 'FLOOR_OPEN' && floorModel ? (
          // The live floor is a full-screen MODE entered via START DAY, not a
          // tab (#215). FloorSim emits floor:day_complete on the final tick,
          // flipping the controller back to MANAGERIAL → this re-renders the
          // shell.
          <FloorDashboard
            model={floorModel}
            controls={floorControls}
            onExceptionPress={openHandPlay}
            onCherryPick={floor && floor.canGrab() ? cherryPick : undefined}
            onOpenGameMenu={openInGameMenu}
          />
        ) : (
          <AppShell
            businessName={
              world.tierManager.businessName || `${profile.name}'s Lot`
            }
            tierLabel={`Tier ${world.tierManager.currentTier} — ${tierEntry.label}`}
            tierCompact={`T${world.tierManager.currentTier}`}
            stats={headerStats}
            heroSource={
              HERO_BY_TIER[world.tierManager.currentTier] ?? HERO_BY_TIER[1]
            }
            onOpenGameMenu={openInGameMenu}
            tabs={shellTabs}
            activeTabKey={shellTab}
            onTabChange={setShellTab}
            primaryAction={{
              label: loopState.hasRecap ? 'Next Day →' : 'Open Floor →',
              onPress: handleNextDay,
            }}
          />
        )}
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
          onDismiss={handleEndCardDismiss}
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
      {/* Single injectable theme (#225): every kit surface reads tokens from
          here, so swapping this theme object re-skins the whole UI in one place. */}
      <ThemeProvider>
        <View style={styles.container}>
          <SafeAreaView
            style={styles.safeArea}
            edges={
              // The shell's hero header bleeds behind the status bar and pads
              // its own content by the inset; every other screen keeps the top
              // edge.
              shellOwnsTopInset
                ? ['bottom', 'left', 'right']
                : ['top', 'bottom', 'left', 'right']
            }
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
          <TradeEscalationModal
            visible={tradeReview != null}
            review={tradeReview}
            onDecide={decideTrade}
            counterResult={tradeCounterResult}
          />
          <DiscountEscalationModal
            visible={discountReview != null}
            review={discountReview}
            onDecide={decideDiscount}
            counterResult={discountCounterResult}
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
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return <DealershipApp />;
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
