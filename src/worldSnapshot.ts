/**
 * World-serialization seam (#188, parent #186).
 *
 * The composition-root half of save/load: `snapshotWorld` collects each
 * stateful module's own `snapshot()` into one serializable `WorldSnapshot`;
 * `restoreWorld` fans the pieces back out via each module's `restore()`. No
 * module touches storage — SaveStore stays the sole gateway and the App
 * persists/loads the blob this returns.
 *
 * ─── CONTRACT (locked by the #188 HITL gate; every later #186 slice conforms) ──
 *  - The envelope is `{ version, modules }`. `version` versions the *envelope
 *    shape* (which module keys exist + how they nest); #196 owns its migrations.
 *  - `modules` is keyed by module name. Each value is that module's own
 *    self-versioned snapshot (its `schemaVersion`), so a module can evolve its
 *    blob without bumping the envelope. This mirrors the shape MarketEconomy's
 *    `compHistory`/`shocks` already use.
 *  - A fan-out slice adds exactly one `modules` key + one line in each of
 *    `snapshotWorld`/`restoreWorld`. Nothing else changes.
 *  - `restoreWorld` rehydrates onto a *freshly-created* World (same seed): the
 *    World is built first (modules wire their bus subscriptions), then state is
 *    overwritten in place. It never re-runs the seed→Day-1 rebuild.
 *
 * This tracer wires only the two smallest stateful values — `GameClock.day`
 * and `Economy.cash` — to prove the whole pipe end to end.
 */
import type { World } from './createWorld';
import type { GameClockSnapshot } from './game/GameClock';
import type { EconomySnapshot } from './game/Economy';
import type { InventorySnapshot } from './game/Inventory';
import type { InstalledBaseSnapshot } from './game/InstalledBase';
import type { PartsInventorySnapshot } from './game/PartsInventory';
import type { StaffOrgSnapshot } from './game/StaffOrg';
import type { StaffMoraleSnapshot } from './game/StaffMorale';
import {
  createDefaultHeatMonitorSnapshot,
  createDefaultNewsSnapshot,
  createDefaultWeeklyReportSnapshot,
  type MarketEconomySnapshot,
} from './game/MarketEconomy';
import type { CompetitorMarketSnapshot } from './game/CompetitorMarket';
import type { RegulatoryMeterState, ReputationSnapshot } from './game/Reputation';
import type {
  TierManagerSnapshot,
  BankruptcyMonitorState,
  IndictmentMonitorState,
  CareerEndingsMonitorState,
} from './game/CareerProgression';
import type { FollowUpPoolSnapshot } from './game/FollowUpPool';
import type { ServiceQueueSnapshot } from './game/ServiceQueue';
import type { BodyShopQueueSnapshot } from './game/BodyShopQueue';
import type { ServiceMarketingSnapshot } from './game/ServiceMarketing';
import type { ServiceInsightsSnapshot } from './game/ServiceInsights';
import type { BodyShopInsightsSnapshot } from './game/BodyShopInsights';
import type { DepartmentQueueSnapshot } from './game/DepartmentQueue';
import type { KPIDashboardSnapshot } from './game/KPIDashboard';
import {
  createDefaultTierGateSnapshot,
  type TierGateSnapshot,
} from './game/TierGate';
import type { TelemetrySnapshot } from './game/Telemetry';
import {
  createDefaultHistoryLogSnapshot,
  type HistoryLogSnapshot,
} from './game/HistoryLog';
import { loadTunables } from './game/data';
import {
  createDefaultDemandShaperSnapshot,
  type DemandShaperSnapshot,
} from './game/DemandShaper';
import type { PrepBet } from './game/PrepBet';
import {
  createDefaultRecordsSnapshot,
  type RecordsSnapshot,
} from './game/Records';
import {
  createDefaultMarketIntelSnapshot,
  type MarketIntelSnapshot,
} from './game/MarketIntel';
import {
  createDefaultFacilitySnapshot,
  type AnyFacilitySnapshot,
} from './game/Facility';

/** Envelope-shape version. Bumped only when module keys are added/restructured
 *  in a way that needs migration (#196), not when a module bumps its own
 *  `schemaVersion`. */
export const WORLD_SNAPSHOT_VERSION = 21;

// A `type` (not `interface`) so the concrete envelope stays assignable to the
// loose `PersistedWorldSnapshot` below — interfaces lack the implicit index
// signature that assignment requires, and `restoreWorld` accepts the loose form.
export type WorldSnapshot = {
  readonly version: number;
  readonly modules: {
    readonly gameClock: GameClockSnapshot;
    readonly economy: EconomySnapshot;
    readonly inventory: InventorySnapshot;
    // Per-owner Service-annuity registry: owner records + loyalty (#298).
    readonly installedBase: InstalledBaseSnapshot;
    // Service parts stock: part lots (category/qty/unitCost) (#299).
    readonly partsInventory: PartsInventorySnapshot;
    readonly staffOrg: StaffOrgSnapshot;
    readonly staffMorale: StaffMoraleSnapshot;
    readonly marketEconomy: MarketEconomySnapshot;
    readonly competitorMarket: CompetitorMarketSnapshot;
    readonly reputation: ReputationSnapshot;
    readonly regulatoryMeter: RegulatoryMeterState;
    // CareerProgression module: tier + business identity AND career progress
    // (customersServed) ride in one TierManager blob.
    readonly tierManager: TierManagerSnapshot;
    // BankruptcyMonitor debt-overhang state: insolvency streak + outstanding
    // T2 contraction debt + terminal flag (#270).
    readonly bankruptcyMonitor: BankruptcyMonitorState;
    // IndictmentMonitor severe-event pressure + terminal flag (#271).
    readonly indictmentMonitor: IndictmentMonitorState;
    // CareerEndingsMonitor pending PE offer + last-offer day + ended flag (#272).
    readonly careerEndingsMonitor: CareerEndingsMonitorState;
    // Queued/pending work + accumulated metrics (#193).
    readonly followUpPool: FollowUpPoolSnapshot;
    readonly serviceQueue: ServiceQueueSnapshot;
    // Service-marketing arm selections: retention campaign + conquest category (#307).
    readonly serviceMarketing: ServiceMarketingSnapshot;
    // ServiceInsights trailing window: per-category demand + per-day base health (#308).
    readonly serviceInsights: ServiceInsightsSnapshot;
    readonly departmentQueue: DepartmentQueueSnapshot;
    readonly kpiDashboard: KPIDashboardSnapshot;
    // Month-to-date tier-gate accruals + rolling samples (#232).
    readonly tierGate: TierGateSnapshot;
    readonly telemetry: TelemetrySnapshot;
    readonly demandShaper: DemandShaperSnapshot;
    // Durable player-facing history log (#208).
    readonly historyLog: HistoryLogSnapshot;
    // Service pricing-posture dial [0,1] — a World-level scalar (not a module),
    // backing get/setServicePricingPosture (#305 seam, persisted by #309).
    readonly servicePricingPosture: number;
    // Body-Shop Tier-3 gate (#312): only the tier gate is carried state — the
    // day's collision intake regenerates deterministically from masterSeed+day.
    readonly bodyShopQueue: BodyShopQueueSnapshot;
    // Body-Shop insurance↔retail channel posture [0,1] — a World-level scalar,
    // backing get/setBodyShopChannelPosture (#314 seam).
    readonly bodyShopChannelPosture: number;
    // BodyShopInsights trailing window: per-collision-category demand + per-day
    // conquest intake flow (#315).
    readonly bodyShopInsights: BodyShopInsightsSnapshot;
    // #322 Morning-prep bet (engagement spine tracer S4): the day's captured
    // stocking-vs-demand wager, or null when none was captured. Persisted so a
    // mid-day reload resolves the day-close Reveal against the same morning bet.
    readonly prepBet: PrepBet | null;
    // #329 Career high-water marks + the in-progress day/month accumulators
    // that feed them.
    readonly records: RecordsSnapshot;
    // #178 The wire subscriptions the player is paying for — the money half of
    // news access gating (the staff half is read off the live roster).
    readonly marketIntel: MarketIntelSnapshot;
    // #358 Built physical capacity — lot spaces + service/body bays. Ceilings
    // are derived from the live tier, so only what is BUILT is persisted.
    // #359 added in-flight construction jobs inside the same blob, which is the
    // module's own `schemaVersion` 1 → 2 and needs no envelope bump; the union
    // is what lets a v21 save written before construction still type as itself.
    readonly facility: AnyFacilitySnapshot;
    // Later #186 slices add keys here
    // — each a module's own self-versioned snapshot.
  };
};

/**
 * A persisted world snapshot of unknown vintage — the raw blob SaveStore reads
 * back, before migration. `version` discriminates which migration steps still
 * need to run; `modules` is treated opaquely until migrated up to current.
 * Every current `WorldSnapshot` is structurally a `PersistedWorldSnapshot`.
 */
export type PersistedWorldSnapshot = {
  readonly version: number;
  readonly modules: Readonly<Record<string, unknown>>;
};

/**
 * One forward migration step. Keyed in `WORLD_SNAPSHOT_MIGRATIONS` by the *old*
 * envelope version it upgrades *from* (mirrors `SaveStore/migrations.ts`). A
 * step transforms the `modules` map to the next version's shape — add/rename/
 * restructure keys — and is responsible only for that single version bump.
 */
export type WorldSnapshotMigration = (
  snap: PersistedWorldSnapshot,
) => PersistedWorldSnapshot;

/**
 * Registered world-snapshot migrations, keyed by source version. Each module-key
 * addition/restructure bumps `WORLD_SNAPSHOT_VERSION` and materializes the
 * behavior-neutral default for older saves.
 */
export const WORLD_SNAPSHOT_MIGRATIONS: Record<number, WorldSnapshotMigration> =
  {
    1: (snap) => ({
      version: 2,
      modules: {
        ...snap.modules,
        demandShaper: createDefaultDemandShaperSnapshot(
          loadTunables().demandShaper.segments,
        ),
      },
    }),
    2: (snap) => ({
      version: 3,
      modules: {
        ...snap.modules,
        regulatoryMeter: {
          pressure: 0,
          isTerminal: false,
          suspensionDaysRemaining: 0,
        },
      },
    }),
    3: (snap) => ({
      version: 4,
      modules: {
        ...snap.modules,
        historyLog: createDefaultHistoryLogSnapshot(),
      },
    }),
    4: (snap) => ({
      version: 5,
      modules: {
        ...snap.modules,
        tierGate: createDefaultTierGateSnapshot(),
      },
    }),
    5: (snap) => ({
      version: 6,
      modules: {
        ...snap.modules,
        bankruptcyMonitor: {
          insolventDayCount: 0,
          outstandingDebt: 0,
          isTerminal: false,
        },
      },
    }),
    6: (snap) => ({
      version: 7,
      modules: {
        ...snap.modules,
        indictmentMonitor: {
          pressure: 0,
          isTerminal: false,
        },
      },
    }),
    7: (snap) => ({
      version: 8,
      modules: {
        ...snap.modules,
        careerEndingsMonitor: {
          currentOffer: null,
          lastOfferDay: 0,
          isEnded: false,
        },
      },
    }),
    8: (snap) => ({
      version: 9,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#298 saves materialize an empty installed base
        // (the registry only accrues from sales made after this version).
        installedBase: { schemaVersion: 1, owners: [] },
      },
    }),
    9: (snap) => ({
      version: 10,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#299 saves materialize empty parts stock
        // (the player stocks parts only after this version).
        partsInventory: { schemaVersion: 1, lots: [] },
      },
    }),
    10: (snap) => ({
      version: 11,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#307 saves materialize no active marketing arm.
        serviceMarketing: {
          schemaVersion: 1,
          retentionCampaignId: 'none',
          conquestCategory: 'none',
        },
      },
    }),
    11: (snap) => ({
      version: 12,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#308 saves materialize an empty read-model
        // (the trailing window re-fills from the live streams as days play).
        serviceInsights: {
          schemaVersion: 1,
          demandWindow: [],
          dailyReturns: [],
          dailyDefections: [],
        },
      },
    }),
    12: (snap) => ({
      version: 13,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#309 saves materialize the neutral 0.5 posture
        // (the createWorld default), so an old save loads exactly as before.
        servicePricingPosture: 0.5,
      },
    }),
    13: (snap) => ({
      version: 14,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#314 saves materialize the Body-Shop gate at the
        // save's ACTUAL tier (read from the tierManager blob, not a hardcoded 1)
        // so a migrated Tier-3+ save activates the Body Shop immediately rather
        // than waiting for the next career:tier_up; plus the neutral 0.5 channel
        // posture (the createWorld default). An old save otherwise loads exactly
        // as before (the Body Shop is dark below Tier 3 regardless).
        bodyShopQueue: {
          schemaVersion: 1,
          currentTier:
            (snap.modules.tierManager as { currentTier?: number } | undefined)
              ?.currentTier ?? 1,
        },
        bodyShopChannelPosture: 0.5,
      },
    }),
    14: (snap) => ({
      version: 15,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#315 saves materialize an empty Body-Shop
        // read-model (the trailing window re-fills from the live stream as Tier-3
        // days play). Dark below Tier 3 regardless.
        bodyShopInsights: {
          schemaVersion: 1,
          intakeWindow: [],
          dailyIntake: [],
        },
      },
    }),
    15: (snap) => ({
      version: 16,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#322 saves have no captured morning bet, so the
        // day-close Reveal falls back to the S1 busy/slow + match scoreline until
        // the next day-open captures one.
        prepBet: null,
      },
    }),
    16: (snap) => ({
      version: 17,
      modules: {
        ...snap.modules,
        // Behavior-neutral: pre-#329 saves have no marks, so a loaded career
        // simply crowns its first record on the next qualifying day. Nothing
        // in the sim branches on a mark, so no prior behavior changes.
        records: createDefaultRecordsSnapshot(),
      },
    }),
    17: (snap) => ({
      version: 18,
      modules: {
        ...snap.modules,
        // #176 added the segment-heat monitor + the industry wire inside the
        // MarketEconomy blob, taking its own schemaVersion 1 → 2. Behavior-
        // neutral: an empty heat baseline is captured (silently) on the next
        // day tick, and the wire simply starts empty — a loaded career picks up
        // headlines from its next day rather than back-filling ones the player
        // never lived through.
        marketEconomy: {
          ...(snap.modules.marketEconomy as Record<string, unknown>),
          schemaVersion: 2,
          heat: createDefaultHeatMonitorSnapshot(),
          news: createDefaultNewsSnapshot(),
        },
      },
    }),
    18: (snap) => ({
      version: 19,
      modules: {
        ...snap.modules,
        // #177 added the weekly market report inside the MarketEconomy blob,
        // taking its own schemaVersion 2 → 3. Behavior-neutral: a loaded career
        // has no standing column and opens a fresh week on its next day tick,
        // so its first report covers the week it actually plays rather than
        // back-filling one from days the player never saw reported.
        marketEconomy: {
          ...(snap.modules.marketEconomy as Record<string, unknown>),
          schemaVersion: 3,
          weekly: createDefaultWeeklyReportSnapshot(),
        },
      },
    }),
    19: (snap) => ({
      version: 20,
      modules: {
        ...snap.modules,
        // #178 added MarketIntel — the wire subscriptions the player pays for.
        // Behavior-neutral: a loaded career starts subscribed to nothing, which
        // is what it was already paying for, and reads exactly the free lanes it
        // has been reading. Nothing is retroactively taken away, because gating
        // is read-side: the headlines it already lived through are still in the
        // ring buffer, and the ones it can no longer read were never numbers it
        // acted on.
        marketIntel: createDefaultMarketIntelSnapshot(),
      },
    }),
    20: (snap) => ({
      version: 21,
      modules: {
        ...snap.modules,
        // #358 added Facility — built lot spaces and bays, which used to be
        // per-tier constants nobody owned. Behavior-neutral: built capacity is
        // materialized at the save's ACTUAL tier (read from the tierManager
        // blob, not a hardcoded 1, same idiom as the #314 Body-Shop gate step),
        // which is exactly the numbers the retired `baysByTier` was already
        // giving that save. A migrated store keeps running the same bay counts;
        // what changed is that it now owns them.
        facility: createDefaultFacilitySnapshot(
          (snap.modules.tierManager as { currentTier?: number } | undefined)
            ?.currentTier ?? 1,
        ),
      },
    }),
  };

/**
 * Upgrade a persisted world snapshot to the current envelope shape, running
 * each registered step in order. Fail-safe by design (issue #196 AC): a
 * snapshot from a newer runtime, or a gap with no registered step, throws
 * rather than silently restoring a mismatched shape. `migrations`/`target` are
 * injectable so a version bump can be exercised in tests without shipping a
 * real new version.
 */
export function migrateWorldSnapshot(
  persisted: PersistedWorldSnapshot,
  migrations: Record<number, WorldSnapshotMigration> = WORLD_SNAPSHOT_MIGRATIONS,
  targetVersion: number = WORLD_SNAPSHOT_VERSION,
): WorldSnapshot {
  if (persisted.version > targetVersion) {
    throw new Error(
      `World snapshot was written by a newer game version ` +
        `(snapshot v${persisted.version}, runtime v${targetVersion}). Refusing to load.`,
    );
  }
  let snap = persisted;
  for (let from = persisted.version; from < targetVersion; from++) {
    const step = migrations[from];
    if (!step) {
      throw new Error(
        `No world-snapshot migration registered from v${from} to v${from + 1}.`,
      );
    }
    snap = step(snap);
  }
  return snap as unknown as WorldSnapshot;
}

export function snapshotWorld(world: World): WorldSnapshot {
  return {
    version: WORLD_SNAPSHOT_VERSION,
    modules: {
      gameClock: world.clock.snapshot(),
      economy: world.economy.snapshot(),
      inventory: world.inventory.snapshot(),
      installedBase: world.installedBase.snapshot(),
      partsInventory: world.partsInventory.snapshot(),
      staffOrg: world.staffOrg.snapshot(),
      staffMorale: world.staffMorale.snapshot(),
      marketEconomy: world.marketEconomy.snapshot(),
      competitorMarket: world.competitorMarket.snapshot(),
      reputation: world.reputation.snapshot(),
      regulatoryMeter: world.regulatoryMeter.getSerializableState(),
      tierManager: world.tierManager.snapshot(),
      bankruptcyMonitor: world.bankruptcyMonitor.getSerializableState(),
      indictmentMonitor: world.indictmentMonitor.getSerializableState(),
      careerEndingsMonitor: world.careerEndingsMonitor.getSerializableState(),
      followUpPool: world.followUpPool.snapshot(),
      serviceQueue: world.serviceQueue.snapshot(),
      serviceMarketing: world.serviceMarketing.snapshot(),
      serviceInsights: world.serviceInsights.snapshot(),
      departmentQueue: world.departmentQueue.snapshot(),
      kpiDashboard: world.kpiDashboard.snapshot(),
      tierGate: world.tierGate.snapshot(),
      telemetry: world.telemetry.snapshot(),
      demandShaper: world.demandShaper.snapshot(),
      historyLog: world.historyLog.snapshot(),
      servicePricingPosture: world.getServicePricingPosture(),
      bodyShopQueue: world.bodyShopQueue.snapshot(),
      bodyShopChannelPosture: world.getBodyShopChannelPosture(),
      bodyShopInsights: world.bodyShopInsights.snapshot(),
      prepBet: world.getPrepBet(),
      records: world.records.snapshot(),
      marketIntel: world.marketIntel.snapshot(),
      facility: world.facility.snapshot(),
    },
  };
}

export function restoreWorld(
  persisted: PersistedWorldSnapshot,
  world: World,
): void {
  // Single migration funnel (#196): every restore — App load, tests, future
  // callers — passes through here, so an older on-disk snapshot is upgraded to
  // the current shape before any module rehydrates. A current-version snapshot
  // is a no-op pass-through.
  const snap = migrateWorldSnapshot(persisted);
  world.clock.restore(snap.modules.gameClock);
  world.economy.restore(snap.modules.economy);
  world.inventory.restore(snap.modules.inventory);
  world.installedBase.restore(snap.modules.installedBase);
  world.partsInventory.restore(snap.modules.partsInventory);
  // StaffOrg roster restores first so StaffMorale rehydrates onto the same ids.
  world.staffOrg.restore(snap.modules.staffOrg);
  world.staffMorale.restore(snap.modules.staffMorale);
  world.marketEconomy.restore(snap.modules.marketEconomy);
  world.competitorMarket.restore(snap.modules.competitorMarket);
  world.reputation.restore(snap.modules.reputation);
  world.regulatoryMeter.restoreState(snap.modules.regulatoryMeter);
  world.tierManager.restore(snap.modules.tierManager);
  world.bankruptcyMonitor.restoreState(snap.modules.bankruptcyMonitor);
  world.indictmentMonitor.restoreState(snap.modules.indictmentMonitor);
  world.careerEndingsMonitor.restoreState(snap.modules.careerEndingsMonitor);
  world.followUpPool.restore(snap.modules.followUpPool);
  world.serviceQueue.restore(snap.modules.serviceQueue);
  world.serviceMarketing.restore(snap.modules.serviceMarketing);
  world.serviceInsights.restore(snap.modules.serviceInsights);
  world.departmentQueue.restore(snap.modules.departmentQueue);
  world.kpiDashboard.restore(snap.modules.kpiDashboard);
  world.tierGate.restore(snap.modules.tierGate);
  world.telemetry.restore(snap.modules.telemetry);
  world.demandShaper.restore(snap.modules.demandShaper);
  world.historyLog.restore(snap.modules.historyLog);
  world.setServicePricingPosture(snap.modules.servicePricingPosture);
  world.bodyShopQueue.restore(snap.modules.bodyShopQueue);
  world.setBodyShopChannelPosture(snap.modules.bodyShopChannelPosture);
  world.bodyShopInsights.restore(snap.modules.bodyShopInsights);
  world.setPrepBet(snap.modules.prepBet);
  world.marketIntel.restore(snap.modules.marketIntel);
  world.records.restore(snap.modules.records);
  world.facility.restore(snap.modules.facility);
}
