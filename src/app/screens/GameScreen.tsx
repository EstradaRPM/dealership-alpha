import React from 'react';
import type { World } from '../../createWorld';
import type { CharacterProfile } from '../../game/CareerProgression';
import type { LotVehicle } from '../../game/Inventory';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { Navigator } from '../../ui/Navigator';
import type { FloorRenderLoop } from '../../ui/FloorRenderLoop';
import type { DayRecapModel } from '../../ui/DayRecap';
import type { CashDeltaSplit } from '../../ui/HomeTab';
import { DAYS_PER_WEEK, DAYS_PER_YEAR } from '../../game/GameClock';
import {
  AppShell,
  loadNavTabs,
  type ShellTab,
  type ShellTabKey,
  type ShellStat,
} from '../../ui/AppShell';
import { HomeTab, buildHomeDashboard, buildGateStrip } from '../../ui/HomeTab';
import { OperationsTab } from '../../ui/OperationsTab';
import { StrategicTab } from '../../ui/StrategicTab';
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
import {
  HERO_BY_TIER,
  RENDER_LOOP,
  REGULATORY_TUNABLES,
  TIER_CONFIG,
  HOURS_OF_OP,
  TRADE_POLICY,
  PRICING_STRATEGY_OPTIONS,
  DAYS_PER_MONTH,
  BODY_SHOP_MIN_TIER,
  SEGMENT_LABELS,
  humanizeRole,
  staffTaxonomy,
  buildTargetingLevers,
  buildCoverageGap,
  buildHeatConsole,
  resolvePricingIntel,
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
  nav: Navigator;
  shellTab: ShellTabKey;
  setShellTab: (t: ShellTabKey) => void;
  lastRecap: DayRecapModel | null;
  setRecapModalOpen: (open: boolean) => void;
  handleNextDay: () => void;
  handleDeptPress: (dept: DeptKey) => void;
  openInGameMenu: () => void;
  persistCurrentSave: () => void;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
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
  nav,
  shellTab,
  setShellTab,
  lastRecap,
  setRecapModalOpen,
  handleNextDay,
  handleDeptPress,
  openInGameMenu,
  persistCurrentSave,
  setLotVehicles,
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
    onOpenPricing: (vehicleId: string) =>
      nav.navigate('pricing', { vehicleId }),
    pricingStrategyOptions: PRICING_STRATEGY_OPTIONS,
    pricingStrategyId: levers.pricingStrategyId,
    onSelectPricingStrategy: levers.handleSelectPricingStrategy,
    // #285 (spine S13): the strategy is a standing auto-pricing policy once a
    // UCM is on staff (the same roster signal S12's intel-precision reads).
    autoPricingActive: world.staffOrg.currentRoster.some(
      (s) => s.role_id === 'used-car-manager',
    ),
    onOpenAuction: () => nav.navigate('auction'),
    onOpenHiring: () => nav.navigate('personnel'),
    rosterCount: world.staffOrg.currentRoster.length,
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
    advertisingOptions: world.demandControls.advertisingOptions,
    advertisingCampaignId: world.demandControls.getAdvertisingCampaignId(),
    onSelectAdvertisingCampaign: levers.handleSelectAdvertisingCampaign,
  };
  // Segment-heat readout (#198 / #278). Read live off DemandShaper each
  // render; reflects the trailing arrival window at MANAGERIAL time. #211
  // layers the active influence producers and the lot-coverage gap onto the
  // same read model so the mechanic stays reachable in the live flow.
  const observed = world.demandShaper.getObservedMix();
  const demandEntries: DemandReadoutEntry[] = observed.map((e) => ({
    segment: e.segment,
    label: SEGMENT_LABELS[e.segment] ?? e.segment,
    share: e.share,
    count: e.count,
    trend: e.trend,
  }));
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
        onOpenService={() => nav.navigate('service')}
        onOpenBodyShop={
          world.tierManager.currentTier >= BODY_SHOP_MIN_TIER
            ? () => nav.navigate('bodyShop')
            : undefined
        }
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
      activeTabKey={shellTab}
      onTabChange={setShellTab}
      primaryAction={{
        label: loopState.hasRecap ? 'Next Day →' : 'Open Floor →',
        onPress: handleNextDay,
      }}
    />
  );
}
