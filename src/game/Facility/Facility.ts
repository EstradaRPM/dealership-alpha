import type { EventBus } from '../EventBus';
import {
  buildSpecFor,
  ceilingsAtTier,
  loadFacilityData,
  type FacilityDataTable,
} from './facilityData';
import {
  FACILITY_CAPACITY_KINDS,
  type AnyFacilitySnapshot,
  type ConstructionJob,
  type Facility,
  type FacilityBuildOption,
  type FacilityBuildResult,
  type FacilityCapacity,
  type FacilityCapacityKind,
  type FacilitySnapshot,
} from './types';

/** The narrow slice of `Economy` construction spends through (#359). */
export interface FacilitySpender {
  readonly cash: number;
  postExpense(amount: number, label: string): void;
}

export interface FacilityDeps {
  bus: EventBus;
  /** The live dealership tier. Read per call — the ceiling moves with it. */
  getTier: () => number;
  /**
   * Where a construction job's cash comes from. Narrow by design: this module
   * spends and never reads the ledger back.
   */
  economy: FacilitySpender;
  /**
   * Live current-day read, not a latched cursor — a restore fires no clock
   * event, and a job scheduled off a stale day would land on the wrong morning.
   */
  getCurrentDay: () => number;
  /** Catalog; injectable so a test can state the scale it is exercising. */
  data?: FacilityDataTable;
}

/**
 * Built capacity for a store standing at `tier` — every kind at its ceiling.
 *
 * This is what a **new** world starts holding (#358 seeds it at construction)
 * and what a pre-facility save migrates to, so neither changes behavior from
 * when bays were a per-tier constant. Growth past this point is construction
 * (#359), and it is only ever bought.
 */
export function createDefaultFacilitySnapshot(
  tier: number,
  data: FacilityDataTable = loadFacilityData(),
): FacilitySnapshot {
  return { schemaVersion: 2, built: ceilingsAtTier(data, tier), jobs: [], jobSeq: 0 };
}

/**
 * The Facility module (#358/#359, A2 R1): what the store has physically built,
 * and the construction that builds more of it.
 *
 * It owns three numbers and hands them out through one read. Everything that
 * used to ask the tier for a bay count now asks here — one bay truth — and the
 * tier's number became the *ceiling* rather than the answer.
 *
 * **Desks come with the tier; buildings are bought.** Construction (#359) is the
 * only thing that raises a built number: it costs cash now and lands days later,
 * which is what puts facility spend in direct competition with inventory cash
 * and forces you to buy capacity ahead of demand rather than in response to it.
 */
export function createFacility(deps: FacilityDeps): Facility {
  const data = deps.data ?? loadFacilityData();
  // Seeded to the starting tier's constants, so a fresh world runs exactly the
  // bay counts the retired `baysByTier` gave it.
  let built: FacilityCapacity = ceilingsAtTier(data, deps.getTier());
  let jobs: ConstructionJob[] = [];
  let jobSeq = 0;

  const byLandingDay = (a: ConstructionJob, b: ConstructionJob) =>
    a.completesOnDay - b.completesOnDay;

  const inFlightUnits = (kind: FacilityCapacityKind) =>
    jobs.reduce((sum, job) => (job.kind === kind ? sum + job.units : sum), 0);

  /**
   * What the next purchase of `kind` would be. Committed capacity — built PLUS
   * in flight — is what the ceiling is measured against, so paying twice for the
   * same slot is impossible.
   */
  function optionFor(kind: FacilityCapacityKind): FacilityBuildOption {
    const spec = buildSpecFor(data, kind);
    const ceiling = ceilingsAtTier(data, deps.getTier())[kind];
    const flight = inFlightUnits(kind);
    // The block, clamped to the room left. A block is the size of one job, not
    // a divisor — 5 against a gap of 3 builds 3 and is priced for 3, so the
    // ceiling is always exactly reachable without a second pricing rule.
    const units = Math.max(0, Math.min(spec.blockSize, ceiling - built[kind] - flight));
    const cost = units * spec.unitCost;
    const refusal =
      units === 0 ? ('at-ceiling' as const)
      : deps.economy.cash < cost ? ('cannot-afford' as const)
      : undefined;
    return {
      kind,
      built: built[kind],
      ceiling,
      inFlight: flight,
      units,
      cost,
      unitCost: spec.unitCost,
      days: spec.days,
      ...(refusal ? { refusal } : {}),
      jobs: jobs.filter((job) => job.kind === kind).sort(byLandingDay),
    };
  }

  /**
   * Land every job whose day has come. Settled on `clock:day_started` so newly
   * finished capacity is standing before the day's drain snapshots its bay
   * count — construction finishes overnight, the way a real one does.
   */
  deps.bus.subscribe('clock:day_started', ({ day }) => {
    const landed = jobs.filter((job) => job.completesOnDay <= day).sort(byLandingDay);
    if (landed.length === 0) return;
    jobs = jobs.filter((job) => job.completesOnDay > day);
    for (const job of landed) {
      built = { ...built, [job.kind]: built[job.kind] + job.units };
      deps.bus.publish('facility:capacity_built', {
        kind: job.kind,
        units: job.units,
        built: built[job.kind],
        day,
      });
    }
  });

  return {
    getBuilt: () => built,
    // Derived from the LIVE tier, never stored: tier-up must not be able to
    // leave a stale ceiling behind, and there is nothing to migrate.
    getCeilings: () => ceilingsAtTier(data, deps.getTier()),
    getBuildOptions: () => FACILITY_CAPACITY_KINDS.map(optionFor),
    getJobs: () => [...jobs].sort(byLandingDay),

    build(kind) {
      const option = optionFor(kind);
      // A refusal changes nothing at all — no cash moves, no job is scheduled.
      if (option.refusal) return { ok: false, reason: option.refusal } satisfies FacilityBuildResult;
      const day = deps.getCurrentDay();
      const job: ConstructionJob = {
        id: `build-${++jobSeq}`,
        kind,
        units: option.units,
        cost: option.cost,
        startedOnDay: day,
        completesOnDay: day + option.days,
      };
      // Paid in full at commit, like the frontline hold's acquisition: the
      // money leaves now, the capacity arrives later. That gap IS the decision.
      deps.economy.postExpense(job.cost, CONSTRUCTION_EXPENSE_LABEL);
      jobs = [...jobs, job];
      return { ok: true, job };
    },

    snapshot: () => ({ schemaVersion: 2, built, jobs: [...jobs], jobSeq }),
    restore: (snap: AnyFacilitySnapshot) => {
      built = snap.built;
      // A #358 v1 save predates construction, so it restores as "nothing being
      // built" — which is exactly the state every save was already in.
      jobs = snap.schemaVersion === 2 ? snap.jobs.map((job) => ({ ...job })) : [];
      jobSeq = snap.schemaVersion === 2 ? snap.jobSeq : 0;
    },
  };
}

/**
 * The ledger label every construction job posts under. One stable string,
 * because Finance groups expense bars by label.
 */
export const CONSTRUCTION_EXPENSE_LABEL = 'Construction';
