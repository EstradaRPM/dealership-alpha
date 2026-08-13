import React from 'react';
import { money } from '../../ui/kit';
import type { World } from '../../createWorld';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { LotVehicle } from '../../game/Inventory';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { TabStacks } from '../../ui/Navigator';
import type { FloorRenderLoop } from '../../ui/FloorRenderLoop';
import type { DayRecapModel } from '../../ui/DayRecap';
import type { CashDeltaSplit } from '../../ui/HomeTab';
import { DAYS_PER_WEEK, DAYS_PER_YEAR } from '../../game/GameClock';
import { projectFniPostures } from '../../game/DealEngine';
import {
  AppShell,
  loadNavTabs,
  composeShellTabs,
  type ShellTab,
  type ShellTabKey,
  type ShellStat,
} from '../../ui/AppShell';
import {
  HomeTab,
  BitePicker,
  buildHomeDashboard,
  buildGateStrip,
  buildMarketGlance,
} from '../../ui/HomeTab';
import { availableBites, type BiteId } from '../../game/ClockBite';
import { OperationsTab } from '../../ui/OperationsTab';
import { PeopleTabContainer } from './PeopleTabContainer';
import { GrowthTabContainer } from './GrowthTabContainer';
import { FinanceTabContainer } from './FinanceTabContainer';
import { RecoveryBanner } from '../../ui/NarrativeBeat';
import {
  FloorDashboard,
  type FloorDashboardModel,
  type FloorControls,
  type RegulatoryPressureModel,
} from '../../ui/FloorDashboard';
import type {
  DemandReadoutEntry,
  DemandReadoutModel,
} from '../../ui/DemandReadout';
import type { FloorEvent } from '../../ui/FloorDashboard';
import type { Levers } from '../useLevers';
import type { Hints } from '../useHints';
import type { Spine } from '../useSpine';
import {
  HERO_BY_TIER,
  RENDER_LOOP,
  REGULATORY_TUNABLES,
  TIER_CONFIG,
  HOURS_OF_OP,
  TRADE_POLICY,
  FNI_POSTURE,
  PRICING_STRATEGY_OPTIONS,
  DAYS_PER_MONTH,
  BODY_SHOP_MIN_TIER,
  humanizeRole,
  staffTaxonomy,
  buildTargetingLevers,
  buildCoverageGap,
  buildDemandEntries,
  buildHeatConsole,
  resolvePricingIntel,
  buildManagerStatus,
  buildRecoveryBanners,
  buildDepartmentDock,
  resolveBiteCoverage,
} from '../config';

export interface GameScreenProps {
  world: World;
  profile: CharacterProfile;
  lotVehicles: readonly LotVehicle[];
  grossToday: number;
  floorEvents: readonly FloorEvent[];
  cashDelta: CashDeltaSplit | null;
  floorLoop: FloorRenderLoop;
  levers: Levers;
  /** The teaching cluster (#386) — which consequence hints are still owed. */
  hints: Hints;
  /** The first-run spine (#213) — which region owes the next coachmark. */
  spine: Spine;
  /** Per-tab navigation stacks (#348): the active tab AND its stack position.
   *  One owner for "which tab, and where inside it" — this retired the lifted
   *  `shellTab` workaround the old unmount-the-shell pattern needed. */
  tabs: TabStacks<ShellTabKey>;
  /** The active tab's pushed sub-screen, or null at the tab's root. Handed to
   *  the shell, which renders it with the tab bar still mounted. */
  stackScreen?: React.ReactNode;
  lastRecap: DayRecapModel | null;
  setRecapModalOpen: (open: boolean) => void;
  handleNextDay: () => void;
  /** Run a bite above the day headless (#381). */
  handleRunBite: (biteId: BiteId) => void;
  handleDeptPress: (dept: DeptKey) => void;
  openInGameMenu: () => void;
  persistCurrentSave: () => void;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
  /** Keep the app-level cash mirror in step with an in-tab expense (a hire). */
  setCash: (n: number) => void;
  /** Force a re-render after a world write the EventBus doesn't announce. */
  bump: () => void;
}

// The live-game screen (#242 extraction): assembles every MANAGERIAL/FLOOR view
// model off the live World and renders either the full-screen FLOOR_OPEN HUD or
// the management AppShell. All inputs are props from the composition root; this
// component reads the World but never owns state.
export function GameScreen({
  world,
  profile,
  lotVehicles,
  grossToday,
  floorEvents,
  cashDelta,
  floorLoop,
  levers,
  hints,
  spine,
  tabs,
  stackScreen,
  lastRecap,
  setRecapModalOpen,
  handleNextDay,
  handleRunBite,
  handleDeptPress,
  openInGameMenu,
  persistCurrentSave,
  setLotVehicles,
  setCash,
  bump,
}: GameScreenProps) {
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
        ups: funnel.walkedIn,
        sold: funnel.sold,
        waiting: Math.max(0, funnel.walkedIn - funnel.staffEngaged),
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
        // Live Service card (#309): the ServiceDispatch capacity read-model,
        // written each tick by the per-day drain — same day clock as the floor.
        service: (() => {
          const load = world.serviceReadModel.read();
          return {
            intake: load.inProgress + load.waiting,
            inProgress: load.inProgress,
            waiting: load.waiting,
            avgWaitTicks: load.avgWaitTicks,
            utilization: load.utilization,
          };
        })(),
        // Live Body-Shop card (#315): the same DeptReadModel projection as the
        // Service card, off world.bodyShopReadModel. Shown only at/after Tier 3
        // (the Body Shop is dark before then — an all-zero card would be noise).
        bodyShop:
          world.tierManager.currentTier >= BODY_SHOP_MIN_TIER
            ? (() => {
                const load = world.bodyShopReadModel.read();
                return {
                  intake: load.inProgress + load.waiting,
                  inProgress: load.inProgress,
                  waiting: load.waiting,
                  avgWaitTicks: load.avgWaitTicks,
                  utilization: load.utilization,
                };
              })()
            : undefined,
      }
    : undefined;
  // Last-day recap reopen chip (#253). Driven by the persisted/captured
  // `lastRecap`, not the live funnel — so it stays present and truthful after
  // a reload (the funnel zeroes each day and isn't restored). Absent only
  // when no day has closed yet, where Home shows honest pre-Day-1 copy.
  const recapChip = lastRecap
    ? { day: lastRecap.day, onOpen: () => setRecapModalOpen(true) }
    : undefined;
  // MANAGERIAL pre-open Prep levers (#120), reduced in #346 to what the locked
  // IA §4 says Prep is: hours of operation + trade policy. Greyed by
  // `ownershipUnlocked` (⇔ MANAGERIAL). Everything else that used to be
  // assembled here moved to the room that owns it — the stock list, per-unit
  // pricing and sourcing to the Lot room, hiring to People, the advertising
  // campaign to the demand console.
  const leverProps = {
    enabled: loopState.ownershipUnlocked,
    hoursOptions: HOURS_OF_OP.options,
    hoursOfOpId: levers.hoursOfOpId,
    onSelectHours: levers.handleSelectHours,
    // Trade-policy lever (#172): strip the multiplier from the catalog (the
    // UI only needs id/label/blurb) and persist the choice per slot.
    tradePolicyOptions: TRADE_POLICY.policies.map((p) => ({
      id: p.id,
      label: p.label,
      blurb: p.blurb,
    })),
    tradePolicyId: levers.tradePolicyId,
    onSelectTradePolicy: levers.handleSelectTradePolicy,
    // F&I posture lever (#366): the store's standing instruction to the finance
    // desk. Same shape as the trade policy — the UI takes id/label/blurb and
    // never sees the markup. Whether the desk is staffed is read off the live
    // roster, because the posture is inert until someone works it (grill Q2).
    fniPostureOptions: FNI_POSTURE.postures.map((p) => ({
      id: p.id,
      label: p.label,
      blurb: p.blurb,
    })),
    fniPostureId: levers.fniPostureId,
    onSelectFniPosture: levers.handleSelectFniPosture,
    // Consequence hints (#386). Resolved here, not in the block: what a hint
    // says is `data/hints.json`'s, and whether it is still owed is the slot's
    // teaching cell — neither is something a lever surface should decide.
    hoursHint: hints.hintFor('hours_of_operation'),
    tradePolicyHint: hints.hintFor('trade_policy'),
    fniPostureHint: hints.hintFor('fni_posture'),
    fniDeskStaffed: world.staffOrg.currentRoster.some(
      (s) => s.role_id === 'f&i-manager',
    ),
    // F&I posture peak meter (#370). A pure read: the engine projects all three
    // postures over the store's OWN loan contracts — the credit mix that
    // matters is the one walking through this door — and names where the total
    // crests. Read fresh each render, like the demand readout below; nothing
    // here changes state, so re-rendering it is free and always current.
    fniPeak: (() => {
      const reading = projectFniPostures({
        book: world.kpiDashboard.getFinancedBook(),
        financeStructuringSkill: world.getFniStructuringSkill(),
      });
      return {
        postures: reading.postures,
        selectedId: levers.fniPostureId,
        peakId: reading.peakId,
        dealsRead: reading.dealsRead,
      };
    })(),
  };
  // Segment-heat readout (#198 / #278). Read live off DemandShaper each
  // render; reflects the trailing arrival window at MANAGERIAL time. #211
  // layers the active influence producers and the lot-coverage gap onto the
  // same read model so the mechanic stays reachable in the live flow.
  const observed = world.demandShaper.getObservedMix();
  const demandEntries: DemandReadoutEntry[] = buildDemandEntries(world);
  const demandReadout: DemandReadoutModel = {
    // Forward heat console (#280): the live spawn-driving heat vector — the
    // signal the player stocks and prices to. Distinct from the trailing
    // observed window below, which confirms what actually walked in. Band
    // resolution sharpens with the pricing-intel tier (#284): coarse by gut,
    // fine 5-band + index once a UCM is on staff.
    heatBands: buildHeatConsole(world, resolvePricingIntel(world)),
    entries: demandEntries,
    totalObserved: observed.reduce((sum, e) => sum + e.count, 0),
    targetingLevers: buildTargetingLevers(world),
    // Advertising campaign (#212), moved off Prep in #346: the locked IA §4
    // takes marketing/demand levers out of Operations and gives them to the
    // demand console, which Growth inherits with the rest of the stack.
    advertising: {
      // #349 prices the lever: each option carries its daily spend, formatted
      // here (the view renders strings, the world holds numbers). A campaign
      // with no visible price is a campaign with no decision in it.
      options: world.demandControls.advertisingOptions.map((o) => ({
        id: o.id,
        label: o.label,
        blurb: o.blurb,
        costLabel: o.dailyCost > 0 ? `${money(o.dailyCost)}/day` : undefined,
      })),
      selectedId: world.demandControls.getAdvertisingCampaignId(),
      onSelect: levers.handleSelectAdvertisingCampaign,
      hint: hints.hintFor('advertising_campaign'),
    },
    coverageGap: buildCoverageGap(demandEntries, lotVehicles),
    // The spine's second step (#213) draws under the coverage line it is about.
    // Null unless this is the step the player currently owes — the console
    // itself decides nothing.
    coachmark: spine.coachmarkFor('demand-readout'),
  };
  // The spine's first step is finished by GOING to the console, which is an
  // action the app already publishes. Every door counts — Home's market glance,
  // the gate strip (#349) and the tab bar are three ways to do the one thing the
  // step asks for, and a step that only one of them satisfied would leave a
  // player who used the tab bar staring at an instruction they had followed.
  const openGrowth = () => {
    spine.complete('spine_read_demand');
    tabs.setActiveTab('growth');
  };
  const changeTab = (key: ShellTabKey) => {
    if (key === 'growth') return openGrowth();
    tabs.setActiveTab(key);
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
    TIER_CONFIG.tiers[world.tierManager.currentTier - 1] ?? TIER_CONFIG.tiers[0];
  // Cash / reputation / tier now live once in the richer Home dashboard cards
  // (#238 HITL): the shell header already carries name + tier identity, so the
  // top strip keeps only REG PRESSURE — the one status with no other home.
  // Tone shifts with the pressure level so the chip reads as a dial: clear
  // green low, amber as it climbs, red once it's a real liability.
  const pressureRatio =
    regulatoryPressure.max > 0
      ? regulatoryPressure.pressure / regulatoryPressure.max
      : 0;
  const headerStats: ShellStat[] = [
    {
      label: 'REG PRESSURE',
      value: `${Math.round(regulatoryPressure.pressure)}/${Math.round(regulatoryPressure.max)}`,
      tone:
        pressureRatio >= 0.66
          ? 'danger'
          : pressureRatio >= 0.33
            ? 'reward'
            : 'positive',
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
  const seasonLean = Object.entries(
    world.weather.wantLeanForDay(world.clock.currentDay),
  )
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
    loopState.hasRecap ? { units: funnel.sold, gross: grossToday } : undefined,
    {
      current: world.tierManager.monthStreak,
      required: world.tierManager.requiredStreak,
      dossierReady: world.tierManager.dossierReady,
    },
  );
  const homeDashboard = buildHomeDashboard({
    businessName: world.tierManager.businessName || `${profile.name}'s Lot`,
    tierLabel: `Tier ${world.tierManager.currentTier} — ${tierEntry.label}`,
    tier: world.tierManager.currentTier,
    // #380: the position, off the engine's one getter — the HUD's cash headline
    // and the worth line under it are two readings of this single call.
    storeWorth: world.getStoreWorth(),
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
  // not tabs appearing/disappearing (spine §2). Every one of the five backs a
  // real, built room (5c layout rebuild #346–#351). Content is selected by key.
  const tabContent: Record<ShellTabKey, React.ReactNode> = {
    home: (
      <HomeTab
        state={loopState}
        dashboard={homeDashboard}
        onOpenOperations={() => tabs.setActiveTab('operations')}
        recapChip={recapChip}
        // #349: the market stack moved to Growth; Home keeps a glance built off
        // the very same console model, and both it and the gate strip route
        // there (locked IA rule 4 — Home never renders detail).
        marketGlance={buildMarketGlance(demandReadout)}
        onOpenGrowth={openGrowth}
        // The spine's opening step (#213): a fresh career lands on Home, so the
        // Market region is where the flow starts.
        coachmark={spine.coachmarkFor('home-region-market')}
      />
    ),
    operations: (
      <OperationsTab
        dock={buildDepartmentDock(world)}
        onDeptPress={handleDeptPress}
        leverProps={leverProps}
      />
    ),
    // The org tab (#347): roster + hiring pool + manager delegation, as three
    // sections of one surface. Hiring is People's charter, not Prep's (locked
    // IA §4), and it resolves in place — no pushed personnel route.
    people: (
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId={levers.selectedHiringRoleId}
        setSelectedHiringRoleId={levers.setSelectedHiringRoleId}
        hints={hints}
        setCash={setCash}
        bump={bump}
      />
    ),
    // The analytics tab (#351): the time-range chips over the headline stats,
    // the hero trend, the two breakdowns and the deal-KPI block — plus the two
    // records (deal history, month-close results) that used to be full-screen
    // routes behind the in-game menu.
    finance: (
      <FinanceTabContainer
        world={world}
        tabs={tabs}
        hints={hints}
        bump={bump}
        setCash={setCash}
      />
    ),
    // The compounding tab (#349): the demand console (readout + campaign lever +
    // the market reads) over the tier-gate detail board. Both were homeless —
    // the console rendered on Home against its glances-only charter, and the
    // gate had no detail surface at all.
    growth: (
      <GrowthTabContainer
        world={world}
        demandReadout={demandReadout}
        hints={hints}
        bump={bump}
        setCash={setCash}
      />
    ),
  };
  // #378: a tab with no composed room throws here. There is no render-time stub
  // to fall back to any more — that fallback is what kept a dead surface alive
  // long after all five rooms were built.
  const shellTabs: ShellTab[] = composeShellTabs(loadNavTabs(), tabContent);

  if (loopState.phase === 'FLOOR_OPEN' && floorModel) {
    // The live floor is a full-screen MODE entered via START DAY, not a
    // tab (#215). FloorSim emits floor:day_complete on the final tick,
    // flipping the controller back to MANAGERIAL → this re-renders the
    // shell.
    return (
      <FloorDashboard
        model={floorModel}
        controls={floorControls}
        onOpenGameMenu={openInGameMenu}
      />
    );
  }
  return (
    <AppShell
      businessName={world.tierManager.businessName || `${profile.name}'s Lot`}
      tierLabel={`Tier ${world.tierManager.currentTier} — ${tierEntry.label}`}
      tierCompact={`T${world.tierManager.currentTier}`}
      stats={headerStats}
      heroSource={HERO_BY_TIER[world.tierManager.currentTier] ?? HERO_BY_TIER[1]}
      onOpenGameMenu={openInGameMenu}
      tabs={shellTabs}
      activeTabKey={tabs.activeTab}
      onTabChange={changeTab}
      // A pushed sub-screen renders in the shell's body with the tab bar still
      // up (#348, locked IA §3) — walking into a room never unmounts the
      // console. The live floor below is the one carve-out.
      stackScreen={stackScreen}
      primaryAction={{
        // No "→" in the label — the shell's CTA draws the onward arrow itself.
        label: loopState.hasRecap ? 'Next Day' : 'Open Floor',
        onPress: handleNextDay,
        hint: hints.hintFor('run_day'),
        // The spine's fourth step (#213). The footer is on every tab, so the
        // step is reachable from wherever the player finished stocking.
        coachmark: spine.coachmarkFor('app-shell-action-footer'),
        // The clock-zoom ladder (#381), pinned above the day verb in the same
        // footer. The doors are resolved from the live roster with the same
        // act-gate predicates the engine gates on — you can skip ahead exactly
        // as far as your people can cover for you.
        picker: (
          <BitePicker
            options={availableBites(resolveBiteCoverage(world))}
            onRun={handleRunBite}
            hint={hints.hintFor('run_bite')}
          />
        ),
      }}
      // Persistent recovery banner (#326): derived from the live monitor state,
      // so it stays pinned across tabs while a debt overhang / license suspension
      // is active and clears itself once resolved. Renders nothing when clear.
      banner={<RecoveryBanner banners={buildRecoveryBanners(world)} />}
    />
  );
}
