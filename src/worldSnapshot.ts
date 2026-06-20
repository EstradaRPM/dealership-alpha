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
import type { StaffOrgSnapshot } from './game/StaffOrg';
import type { StaffMoraleSnapshot } from './game/StaffMorale';
import type { MarketEconomySnapshot } from './game/MarketEconomy';
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

/** Envelope-shape version. Bumped only when module keys are added/restructured
 *  in a way that needs migration (#196), not when a module bumps its own
 *  `schemaVersion`. */
export const WORLD_SNAPSHOT_VERSION = 9;

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
    readonly departmentQueue: DepartmentQueueSnapshot;
    readonly kpiDashboard: KPIDashboardSnapshot;
    // Month-to-date tier-gate accruals + rolling samples (#232).
    readonly tierGate: TierGateSnapshot;
    readonly telemetry: TelemetrySnapshot;
    readonly demandShaper: DemandShaperSnapshot;
    // Durable player-facing history log (#208).
    readonly historyLog: HistoryLogSnapshot;
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
      departmentQueue: world.departmentQueue.snapshot(),
      kpiDashboard: world.kpiDashboard.snapshot(),
      tierGate: world.tierGate.snapshot(),
      telemetry: world.telemetry.snapshot(),
      demandShaper: world.demandShaper.snapshot(),
      historyLog: world.historyLog.snapshot(),
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
  world.departmentQueue.restore(snap.modules.departmentQueue);
  world.kpiDashboard.restore(snap.modules.kpiDashboard);
  world.tierGate.restore(snap.modules.tierGate);
  world.telemetry.restore(snap.modules.telemetry);
  world.demandShaper.restore(snap.modules.demandShaper);
  world.historyLog.restore(snap.modules.historyLog);
}
