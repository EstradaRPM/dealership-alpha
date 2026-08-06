import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffTaxonomy } from '../NPC/StaffTaxonomy';
import type { StaffArchetypeCatalog } from '../NPC/schemas/staff-archetype';
import {
  createStaff,
  rehydrateStaff,
  promoteStaff,
  compositeRatio,
  type StaffWithComposites,
} from '../NPC/factories/StaffFactory';
import type { Staff } from '../NPC/schemas/staff';
import { createRng, deriveSeed } from '../Rng';
import { loadStaffOrgConfig, type StaffOrgConfig } from './staffOrgData';
import { loadStaffSlots, slotTotalFor, type StaffSlotTable } from './staffSlots';
import {
  loadStaffPay,
  gradeFor,
  dailyWageFor,
  MAX_GRADE,
  type StaffPayTable,
} from './staffPay';
import type { CandidateListing } from './types';
import {
  computeConditionRead,
  deriveConditionReadSeed,
  CONDITION_READING_SKILL_ID,
  type ConditionRead,
} from './conditionRead';

/**
 * Narrow vehicle shape the UCM reads. Decoupled from `AuctionListing` so
 * StaffOrg stays independent of Inventory's surface — callers project the
 * minimum needed fields (#163). The realized-recon seam reads `mileage`,
 * `condition`, `sourceId`, `reconEstimate` to produce the hidden truth the
 * read is anchored on.
 */
export interface ConditionAssessInput {
  readonly id: string;
  readonly reconEstimate: number;
  readonly condition: 'clean' | 'average' | 'rough';
  readonly mileage: number;
  readonly sourceId: string;
}

export interface StaffOrgDeps {
  bus: EventBus;
  economy: Economy;
  masterSeed: number;
  taxonomy: StaffTaxonomy;
  archetypes: StaffArchetypeCatalog;
  config?: StaffOrgConfig;
  /**
   * The per-role, per-tier desk table (#352). Defaults to
   * `data/staff-slots.json`; injectable so a test can state the scarcity it is
   * exercising instead of depending on shipped balance numbers.
   */
  slots?: StaffSlotTable;
  /**
   * The salary book (#353) — daily wage per role × grade, plus the grade bands.
   * Defaults to `data/staff-pay.json`; injectable so a test can state the wages
   * it is exercising (or opt out of the drain entirely) instead of depending on
   * shipped balance numbers.
   */
  pay?: StaffPayTable;
  /**
   * The rival stores that can come for your people (#357) — their display
   * names, read fresh each morning so a market that changes changes who
   * poaches. A function rather than a `CompetitorMarket` reference: StaffOrg
   * needs one string per rival and must not grow a dependency on the module
   * that happens to hold them today.
   *
   * Omit — or return an empty list — and no rival offer ever fires. That is the
   * honest "there is nobody to poach you" rather than a disable flag, and it
   * keeps every suite that hires people for other reasons free of them.
   */
  rivalNames?: () => readonly string[];
  getTier?: () => number;
  /**
   * Hidden-truth provider for the UCM condition read (#163). Receives the
   * narrow vehicle shape and returns the realized recon cost the engine
   * already rolled (or will roll) for that vehicle. Omit to disable
   * `assessCondition` entirely — without a truth seam, `assessCondition`
   * always returns null even when a UCM is on staff (the test/fixture path).
   */
  realizedReconFor?: (vehicle: ConditionAssessInput) => number;
}

/**
 * An outstanding raise demand (#356, C1 R2). Growth never silently reprices
 * anyone: the wage tracks `paidGrade`, so when someone's ability outgrows what
 * they signed at, they come and ask — and the player answers **Pay it** or
 * **Refuse**. `currentGrade > paidGrade` is the entire trigger; there is no
 * second state machine and no new counters (internal call 2).
 *
 * Both wages are captured at ask time so the prompt cannot quietly restate
 * itself: the number the player agreed to is the number they were shown.
 *
 * **A rival's offer is this same object with a name and a deadline on it**
 * (#357, R2's closing paragraph): *"Northside offered Marcus $610/day. He'll
 * take it Friday."* Retention and poaching are one moment with one pair of
 * buttons — not a second mechanic — so they are one type, one event family and
 * one prompt. What the two answers *mean* differs, and only there: declining a
 * rival is a departure, declining a raise is a cooldown.
 */
export interface RaiseRequest {
  readonly staffId: string;
  readonly roleId: string;
  /** The day they asked, or the day the offer arrived. */
  readonly day: number;
  /** What they are on now — the wage the daily drain is charging for them. */
  readonly currentWage: number;
  /**
   * What it takes to keep them: `wage(role, grade)` when they are asking for
   * themselves, or the rival's bid (that wage plus the poaching premium).
   */
  readonly askedWage: number;
  readonly paidGrade: number;
  readonly grade: number;
  /**
   * The rival who made the offer (#357) — present only on a poach. Its absence
   * is what makes this a plain raise demand; no separate kind field, because a
   * kind that can disagree with the fields it describes is a bug waiting.
   */
  readonly rivalName?: string;
  /**
   * The morning they leave if nothing is answered. Present only alongside
   * `rivalName` — a raise demand has no deadline, since refusing one is an
   * answer the player gives rather than one the clock gives for them.
   */
  readonly deadlineDay?: number;
}

/**
 * Persistence surface for StaffOrg (#190, parent #186). Captures the hired
 * roster (source of truth for "who is on payroll") plus `currentDay` so the
 * candidate-id namespace stays stable across a reload. The candidate pool is
 * intentionally NOT persisted — it is cleared every `clock:day_started` and
 * regenerated deterministically from `masterSeed`, so the seed + catalog stay
 * the canonical artifact (same pattern as Inventory's auction board, #189).
 * Roster entries are stored as plain `Staff`: the `effectiveness` /
 * `trustworthiness` composites are non-enumerable derived getters that JSON
 * drops, then `restore` re-attaches via `rehydrateStaff`.
 */
export interface StaffOrgSnapshot {
  readonly schemaVersion: 1;
  readonly currentDay: number;
  readonly roster: readonly Staff[];
  /**
   * Raise demands waiting on an answer (#356). Optional because a save written
   * before this slice has none — `restore` reads a missing key as "nobody is
   * asking", which is behavior-neutral: the trigger re-evaluates on the next
   * `clock:day_started` and re-asks for anyone who has outgrown their pay.
   * Inside StaffOrg's own blob, so this is the module's `schemaVersion`
   * business and needs no envelope bump (`docs/save-migration-recipe.md`).
   */
  readonly raiseRequests?: readonly RaiseRequest[];
  /**
   * `[staffId, dayTheyMayAskAgain]` for members whose ask was refused. Carried
   * separately from the requests because a running cooldown is precisely the
   * state of *not* having a request — losing it on reload would let a refused
   * member ask again the next morning, which is the nag the cooldown exists to
   * prevent.
   */
  readonly raiseCooldowns?: readonly (readonly [string, number])[];
}

/**
 * A legal, currently-available promotion target for a roster member (#324).
 * `getPromotionOptions` returns one per outgoing role edge that (a) is a legal
 * edge in the data, (b) is unlocked at the current dealership tier, and (c) the
 * staffer's own `promotion_gates` are satisfied for. UI renders an affordance
 * per option; an empty list means "no promote button".
 */
export interface PromotionOption {
  readonly toRoleId: string;
}

/**
 * One role's desks at the current tier (#352). `total` is the tier's slot count
 * from `data/staff-slots.json`; `filled` is how many of them the live roster
 * sits in. An open slot is the whole hire affordance — the People surface reads
 * this rather than re-deriving a ceiling, so it never offers a press that
 * `hire()` would throw on.
 */
export interface RoleSlots {
  readonly roleId: string;
  readonly filled: number;
  readonly total: number;
}

/**
 * What one roster member costs (#353, C1 R1). The People surface reads this
 * rather than re-deriving a wage from the pay book, so the number on the card
 * is the number the ledger charges.
 *
 * `grade` and `paidGrade` are deliberately two fields. Growth never silently
 * reprices anyone (R2): the wage tracks the grade the person was **hired at**,
 * and when their ability outgrows it they come and ask. `grade > paidGrade` is
 * the whole raise trigger.
 */
export interface StaffPay {
  readonly staffId: string;
  readonly roleId: string;
  /** Current, derived from grown skills — climbs with tenure and closed deals. */
  readonly grade: number;
  /** The grade the wage is set at; moves only when a raise is accepted. */
  readonly paidGrade: number;
  /** `wage(role, paidGrade)` — exactly what the daily drain charges. */
  readonly dailyWage: number;
  /**
   * `wage(role, grade)` — what someone this good asks for (#356). Equal to
   * `dailyWage` for anyone paid at their current grade; above it for anyone who
   * has outgrown their pay. Exposed rather than left for consumers to re-derive
   * because it is the one comparison two separate mechanics read: the raise
   * trigger, and StaffMorale's nightly pay-vs-market adjustment.
   */
  readonly askingWage: number;
}

export interface StaffOrg {
  readonly currentRoster: readonly StaffWithComposites[];
  /**
   * How many bodies the current tier allows on payroll (#347) — now **derived**
   * as the sum of the tier's role slots (#352), not a separate number. There is
   * exactly one ceiling in the game and it is the slot table; a second one that
   * could disagree with it is a bug waiting.
   */
  readonly headcountCap: number;
  /**
   * The desks for one role at the current tier (#352). `total` 0 means the tier
   * has not opened that desk yet; an unknown role throws, same as `hire()`.
   */
  getSlots(roleId: string): RoleSlots;
  /**
   * Every role's desks at the current tier, in the slot table's order (#352).
   * The People surface renders this as the slot board — the all-roles read that
   * keeps the screen from re-deriving the ceiling role by role.
   */
  getSlotBoard(): readonly RoleSlots[];
  /**
   * What the store burns in wages every day (#353) — the sum of every rostered
   * member's daily wage, charged overnight whether the floor produced or not.
   * 0 with nobody on the roster, and nothing is posted in that case.
   */
  readonly dailyPayroll: number;
  /**
   * Grade + wage for every rostered member, in roster order (#353). The
   * all-roster read the People surface renders, parallel to `getSlotBoard`.
   */
  getPayBoard(): readonly StaffPay[];
  /**
   * Every raise demand waiting on an answer, in roster order (#356). The People
   * surface renders one prompt per entry; empty means nobody is asking.
   */
  getRaiseRequests(): readonly RaiseRequest[];
  /** The outstanding demand for one member, or `null`. */
  getRaiseRequest(staffId: string): RaiseRequest | null;
  /**
   * **Pay it** — or **Match**, when a rival is on the prompt (#356/#357). Moves
   * the wage to the number they were quoted and `paidGrade` to the grade they
   * asked at, then announces the answer for StaffMorale to reward. Throws
   * `StaffOrgError` when that member has no outstanding demand — the surface
   * only offers the button when one is live, so a throw here means a stale
   * press, not a message for the player.
   */
  acceptRaise(staffId: string): void;
  /**
   * **Refuse** — or **Let them go** (#356/#357). Turning down a raise holds the
   * wage, drops morale (StaffMorale's answer to the same event) and starts
   * `raiseCooldownDays`; there is deliberately no new quit path, since a
   * refusal that pushes morale under the threshold is taken from there by the
   * existing `StaffMorale` → `staff:quit` machinery.
   *
   * Turning down a **rival's** offer is the one difference between the two: the
   * rival is hiring them, so they leave now, through that same `staff:quit`.
   * There is no cooldown to start on someone who no longer works here.
   */
  refuseRaise(staffId: string): void;
  /** #190 SaveStore seam: capture/rehydrate the hired roster. */
  snapshot(): StaffOrgSnapshot;
  restore(snap: StaffOrgSnapshot): void;
  getCandidates(roleId: string): readonly CandidateListing[];
  hire(candidateId: string): void;
  fire(staffId: string): void;
  /**
   * The legal, tier-unlocked, gate-satisfied promotion targets for a roster
   * member (#324). Empty when the staffer meets no gate, has no outgoing edge,
   * or every target is tier-locked. Throws `StaffOrgError` if `staffId` isn't
   * on the roster.
   */
  getPromotionOptions(staffId: string): readonly PromotionOption[];
  /**
   * Promote a roster member up a legal role edge (#324). Moves the *existing*
   * staffer (id preserved, so morale/dispatch bindings survive) to `toRoleId`
   * via `NPC.promoteStaff`. Throws `StaffOrgError` if the staffer isn't on the
   * roster, the edge is illegal, the target is tier-locked, or the staffer's
   * promotion gates aren't met — the same predicate `getPromotionOptions` uses.
   */
  promote(staffId: string, toRoleId: string): void;
  /**
   * Pre-purchase condition read for an auction listing (#163). Returns the
   * UCM's skill-gated `[estimatedReconLow, estimatedReconHigh] + confidence`
   * band, or `null` when (a) no `used-car-manager` is on the roster, or
   * (b) the `realizedReconFor` truth seam wasn't wired. Same vehicle + same
   * UCM + same masterSeed → same read.
   */
  assessCondition(vehicle: ConditionAssessInput): ConditionRead | null;
}

export class StaffOrgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffOrgError';
  }
}

export function createStaffOrg(deps: StaffOrgDeps): StaffOrg {
  const { bus, economy, masterSeed, taxonomy, archetypes } = deps;
  const rivalNames = deps.rivalNames;
  const config = deps.config ?? loadStaffOrgConfig();
  const slots = deps.slots ?? loadStaffSlots();
  const pay = deps.pay ?? loadStaffPay();
  const getTier = deps.getTier;
  const realizedReconFor = deps.realizedReconFor;

  const roster: StaffWithComposites[] = [];
  // candidateId → CandidateListing; cleared on day advance
  const candidatePool = new Map<string, CandidateListing>();
  // roleId → candidateId[] for that role's current pool
  const rolePool = new Map<string, string[]>();

  // The raise negotiation (#356, C1 R2). Two maps, both keyed by staff id: what
  // is being asked, and who may not ask yet. Neither is a state machine — the
  // demand itself is re-derived from `currentGrade > paidGrade` every morning.
  const raiseRequests = new Map<string, RaiseRequest>();
  /** staffId → the first day they may ask again after a refusal. */
  const raiseCooldownUntil = new Map<string, number>();

  let currentDay = 1;
  // Channel-desk M7 (#294): the day's closed-deal tally, accrued onto each
  // roster member's `deals_closed` counter overnight (NOT live), so effective
  // skill stays constant within an open day. Transient — reset every
  // `day_started`, deterministically rebuilt from `deal:closed` on a #122
  // replay; the durable growth lives in the (serialized) counters.
  let dayDealsClosed = 0;

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;
    dayDealsClosed = 0;
    candidatePool.clear();
    rolePool.clear();
    // Morning is the only moment the answer can have changed: the counters that
    // grow a grade accrue on `clock:day_ended`, so within an open day nobody's
    // grade moves and re-checking would be re-asking the same question.
    //
    // Three passes, in this order, and the order is the mechanic:
    // 1. a deadline that has come up takes the person — before anything else,
    //    so nobody is poached, or asks for a raise, on the morning they leave;
    // 2. rivals make their approaches;
    // 3. whoever is left and has outgrown their pay asks for themselves. An
    //    outstanding offer suppresses that ask, which is how "one open ask per
    //    member" falls out of the ordering rather than out of a rule.
    expireRivalOffers(day);
    rivalOffers(day);
    raiseAsks(day);
  });

  bus.subscribe('deal:closed', () => {
    dayDealsClosed += 1;
  });

  // Model B skill growth (#294): accrue the dormant experience counters once
  // per day, at the front of the overnight sequence. Effective skill is *derived*
  // from these counters (StaffFactory.computeEffectiveSkills), so recomputing
  // them here — and only here — means the derived skill is constant within each
  // open day and steps up overnight toward the per-hire cap. Counters serialize
  // on `Staff`, so the growth persists with no migration.
  bus.subscribe('clock:day_ended', () => {
    for (const s of roster) {
      s.counters.days_employed += 1;
      s.counters.deals_closed += dayDealsClosed;
      s.counters.experience += dayDealsClosed;
    }
  });

  bus.subscribe('staff:quit', ({ staffId }) => {
    const idx = roster.findIndex((s) => s.id === staffId);
    if (idx !== -1) roster.splice(idx, 1);
    clearRaiseState(staffId);
  });

  /**
   * The tier's desk count for a role (#352). Throws on a role the slot table
   * does not name, rather than reading as 0 — a silently unhireable role is the
   * A1 regression class (a job the engine allows and the surface never offers)
   * inverted, and it looks like balance instead of a missing data row.
   */
  function slotTotal(roleId: string): number {
    const total = slotTotalFor(slots, roleId, getTier ? getTier() : 1);
    if (total === undefined) {
      throw new StaffOrgError(`No slot row for role "${roleId}" in data/staff-slots.json`);
    }
    return total;
  }

  function slotsFilled(roleId: string): number {
    return roster.reduce((n, s) => (s.role_id === roleId ? n + 1 : n), 0);
  }

  /**
   * The person's grade **right now** (#353) — a banded read of their ability as
   * a fraction of their own ceiling, taken over the *grown* `effectiveSkills`
   * (Model B, #294) rather than the base roll. That is what makes the grade
   * climb with tenure and closed deals, which is the entire raise trigger; the
   * base-skill `effectivenessRatio` getter is left alone because every
   * promotion/capability gate is calibrated against it.
   *
   * Constant within an open day: the counters `effectiveSkills` derives from
   * only move overnight, so a #122 mid-day replay reproduces the same grade.
   */
  function currentGrade(staff: StaffWithComposites): number {
    return gradeFor(compositeRatio(staff.effectiveSkills, taxonomy.skills, 'effectiveness'), pay.gradeBands);
  }

  /**
   * What `roleId` costs per day at `grade`. Throws on a role the pay book does
   * not name, rather than silently charging nothing — a free employee is the
   * flat-stub bug this slice exists to delete, and it would read as balance
   * instead of a missing data row.
   */
  function wageFor(roleId: string, grade: number): number {
    const wage = dailyWageFor(pay, roleId, grade);
    if (wage === undefined) {
      throw new StaffOrgError(`No wage row for role "${roleId}" in data/staff-pay.json`);
    }
    return wage;
  }

  /**
   * The wage a roster member is actually on. Stored on the person (#357),
   * because it is an **agreed** number: a matched rival offer pays a premium
   * over what the grade asks for, so it cannot be re-derived from `paidGrade`.
   * The fallback covers pre-#357 saves and reproduces exactly what #353
   * charged.
   */
  function paidWageFor(staff: StaffWithComposites): number {
    return staff.paidWage ?? wageFor(staff.role_id, staff.paidGrade ?? currentGrade(staff));
  }

  function totalDailyPayroll(): number {
    return roster.reduce((sum, s) => sum + paidWageFor(s), 0);
  }

  /** The wage someone this good asks for — `wage(role, currentGrade)` (#356). */
  function askingWageFor(staff: StaffWithComposites): number {
    return wageFor(staff.role_id, currentGrade(staff));
  }

  /**
   * The raise trigger (#356, internal call 2): anyone whose grown grade has
   * passed the grade their wage is set at comes and asks, this morning.
   *
   * Three things suppress the ask, and each of them is the absence of a
   * decision rather than a rule the player has to learn:
   * - they are already asking (the prompt is on screen, unanswered);
   * - they were refused inside the cooldown (asking again tomorrow is a nag,
   *   not a mechanic);
   * - the grade moved but the money didn't. Wages rise **weakly** with grade by
   *   schema, so a flat stretch of a wage row can leave the asked number equal
   *   to the paid one. A prompt whose two buttons cost the same is a decision
   *   with nothing inside it, which is exactly what the C1 gate rejected.
   */
  function raiseAsks(day: number): void {
    for (const staff of roster) {
      if (raiseRequests.has(staff.id)) continue;
      const cooldownUntil = raiseCooldownUntil.get(staff.id);
      if (cooldownUntil !== undefined && day < cooldownUntil) continue;

      const grade = currentGrade(staff);
      const paidGrade = staff.paidGrade ?? grade;
      if (grade <= paidGrade) continue;

      // What they are actually on, not what their paid grade's row says — a
      // matched rival offer (#357) put them above that row, and someone paid
      // over book has nothing to ask for.
      const currentWage = paidWageFor(staff);
      const askedWage = wageFor(staff.role_id, grade);
      if (askedWage <= currentWage) continue;

      const request: RaiseRequest = {
        staffId: staff.id,
        roleId: staff.role_id,
        day,
        currentWage,
        askedWage,
        paidGrade,
        grade,
      };
      raiseRequests.set(staff.id, request);
      bus.publish('staff:raise_requested', request);
    }
  }

  /**
   * A rival's approach (#357) — the poaching half of R2's one moment.
   *
   * Who gets approached is **one rule**: the chance scales with grade, so
   * rivals come for the people worth having and come for them more often the
   * better those people are. There is no "poachable" flag and no minimum grade
   * — a floor would be a second rule the player could only infer from an
   * absence, and it would make the top of the roster feel arbitrary rather than
   * valuable.
   *
   * Two things suppress an approach, both the absence of a decision rather than
   * a rule to learn: something is already on the prompt for that person, and an
   * offer that does not beat what they are already paid. The second is what
   * stops a member you just matched at a premium from being "poached" back down
   * to the book wage the next morning.
   *
   * The refusal cooldown deliberately does NOT suppress it. That cooldown is
   * about the member not nagging you; a rival calling them is not their doing.
   */
  function rivalOffers(day: number): void {
    const rivals = rivalNames ? rivalNames() : [];
    if (rivals.length === 0) return;
    const terms = pay.rivalOffers;

    for (const staff of roster) {
      if (raiseRequests.has(staff.id)) continue;

      const grade = currentGrade(staff);
      const currentWage = paidWageFor(staff);
      const offeredWage = Math.round(terms.wagePremium * wageFor(staff.role_id, grade));
      if (offeredWage <= currentWage) continue;

      // One stream per (member, day): whether the call comes and who makes it
      // are drawn in a fixed order from one seed, so a replayed save produces
      // the same offer from the same rival on the same morning.
      const rng = createRng(
        deriveSeed(masterSeed, 'staff_org.rival_offer', { staffId: staff.id, day }),
      );
      if (rng() >= terms.dailyChanceAtTopGrade * (grade / MAX_GRADE)) continue;
      const rivalName = rivals[Math.floor(rng() * rivals.length) % rivals.length];

      const request: RaiseRequest = {
        staffId: staff.id,
        roleId: staff.role_id,
        day,
        currentWage,
        askedWage: offeredWage,
        paidGrade: staff.paidGrade ?? grade,
        grade,
        rivalName,
        deadlineDay: day + terms.deadlineDays,
      };
      raiseRequests.set(staff.id, request);
      bus.publish('staff:raise_requested', request);
    }
  }

  /**
   * The deadline arriving is the answer the player didn't give (#357): the
   * rival hires them, and they leave through the **existing** `staff:quit` path
   * with the rival named on it. No second departure mechanic — this module
   * already removes a quitter from the roster, and now does it for both causes.
   *
   * Collected before publishing because `staff:quit` splices the roster we
   * would otherwise be iterating.
   */
  function expireRivalOffers(day: number): void {
    const leaving = [...raiseRequests.values()].filter(
      (r) => r.deadlineDay !== undefined && day >= r.deadlineDay,
    );
    for (const request of leaving) {
      const staff = roster.find((s) => s.id === request.staffId);
      if (!staff) continue;
      leaveForRival(staff, request, day);
    }
  }

  /** Publish the departure; the module's own `staff:quit` subscriber does the rest. */
  function leaveForRival(
    staff: StaffWithComposites,
    request: RaiseRequest,
    day: number,
  ): void {
    bus.publish('staff:quit', {
      staffId: staff.id,
      name: staff.name,
      roleId: staff.role_id,
      day,
      toRival: request.rivalName,
    });
  }

  /**
   * Forget both halves of the negotiation for someone who is no longer on the
   * roster. A request outstanding against a person who quit would render a
   * prompt with no one behind it, and a cooldown keyed to a departed id would
   * silence a *different* future hire only if ids collided — but the stale entry
   * would still ride along in every save from then on.
   */
  function clearRaiseState(staffId: string): void {
    raiseRequests.delete(staffId);
    raiseCooldownUntil.delete(staffId);
  }

  // The daily wage drain (#353, C1 R1). Fires every night — `clock:overnight_payroll`
  // is a per-day phase; only Economy's rent gates itself to the week. A fixed
  // cost against variable revenue is what makes a slow day hurt, and the player
  // reads it in the same beat as the day's gross.
  //
  // `forceDebit`, not `postExpense`: this is a recurring obligation, same as
  // rent and the marketing/subscription drains. Payroll you cannot afford is
  // supposed to push cash negative and wake `BankruptcyMonitor`, not throw and
  // abort the overnight sequence.
  bus.subscribe('clock:overnight_payroll', () => {
    const total = totalDailyPayroll();
    if (total <= 0) return;
    economy.forceDebit(total, 'Payroll');
  });

  /**
   * The one-time signing fee (#355, C1 R5): **a multiple of what this person
   * costs per day**, so a grade-5 costs more to sign *and* more to keep from
   * one number. It replaced `staffOrg.hiringCostByTier`, a flat per-tier price
   * under which a grade-5 closer signed for exactly what a greenpea signed for
   * — the same shape of bug as the flat payroll stub #353 deleted.
   *
   * Derived from the wage rather than carried as its own table for the reason
   * the C1 gate keeps applying: one number the player can reason about beats a
   * second table that can silently disagree with the first. `hireFeeMultiple`
   * lives in `data/staff-pay.json` beside the wages it multiplies.
   *
   * Rounded, because a fractional multiple against a whole-dollar wage would
   * otherwise put cents into the ledger.
   */
  function hireFeeFor(dailyWage: number): number {
    return Math.round(pay.hireFeeMultiple * dailyWage);
  }

  /**
   * True when `staff` clears every threshold in its *current* role's
   * `promotion_gates` (#324). Gate keys are either the two composites
   * (`effectiveness`/`trustworthiness`, 0–1) or a raw skill axis read from the
   * grown `effectiveSkills` (0–100) — the same value every capability gate reads.
   */
  function meetsPromotionGates(staff: StaffWithComposites): boolean {
    const role = taxonomy.roles[staff.role_id];
    if (!role) return false;
    for (const [key, threshold] of Object.entries(role.promotion_gates)) {
      const value =
        key === 'effectiveness'
          ? staff.effectiveness
          : key === 'trustworthiness'
            ? staff.trustworthiness
            : (staff.effectiveSkills[key] ?? 0);
      if (value < threshold) return false;
    }
    return true;
  }

  /** True when `toRoleId`'s `hireTier` (if any) is met by the current tier. */
  function isTargetTierUnlocked(toRoleId: string): boolean {
    const target = taxonomy.roles[toRoleId];
    if (!target) return false;
    if (target.hireTier === undefined) return true;
    const tier = getTier ? getTier() : 1;
    return tier >= target.hireTier;
  }

  function buildCandidatesForRole(roleId: string): void {
    const matchingArchetypeIds = Object.entries(archetypes)
      .filter(([, a]) => a.role_id === roleId)
      .map(([id]) => id);

    if (matchingArchetypeIds.length === 0) {
      throw new StaffOrgError(`No archetypes defined for role "${roleId}"`);
    }

    const ids: string[] = [];

    // Slot walks past collisions rather than stopping at `candidatesPerRole`.
    // A staff id is `staff:<archetype>:<hireDay>:<slot>`, so the pool for a day
    // regenerates the SAME ids it generated before — and the pool is rebuilt
    // from the seed on every reload (it is deliberately not persisted, #190).
    // Without this guard a reloaded save offered you the person already on your
    // roster, and hiring them pushed a second entry under a duplicate id, which
    // would break every id-keyed binding (StaffMorale, StaffDispatch). Bounded
    // so an exhausted archetype set can't spin.
    const hiredIds = new Set(roster.map((s) => s.id));
    const maxAttempts = config.candidatesPerRole * 4;

    for (
      let slot = 0;
      slot < maxAttempts && ids.length < config.candidatesPerRole;
      slot++
    ) {
      const archetypeId =
        matchingArchetypeIds[slot % matchingArchetypeIds.length];

      const staff = createStaff(
        { archetypeId, hireDay: currentDay, slot },
        { masterSeed, taxonomy, archetypes },
      );
      if (hiredIds.has(staff.id)) continue;

      const candidateId = `candidate:${roleId}:${currentDay}:${slot}`;
      const grade = currentGrade(staff);
      // Both prices are this person's, not this role's (#355): what they cost
      // to sign is derived from what they cost to keep, so two applicants for
      // the same desk are quoted different numbers.
      const dailyWage = wageFor(roleId, grade);
      const listing: CandidateListing = {
        candidateId,
        archetypeId,
        staff,
        hiringCost: hireFeeFor(dailyWage),
        grade,
        dailyWage,
      };
      candidatePool.set(candidateId, listing);
      ids.push(candidateId);
    }

    rolePool.set(roleId, ids);
  }

  return {
    get currentRoster(): readonly StaffWithComposites[] {
      return roster;
    },

    get headcountCap(): number {
      let sum = 0;
      for (const roleId of Object.keys(slots)) sum += slotTotal(roleId);
      return sum;
    },

    getSlots(roleId: string): RoleSlots {
      return { roleId, filled: slotsFilled(roleId), total: slotTotal(roleId) };
    },

    getSlotBoard(): readonly RoleSlots[] {
      return Object.keys(slots).map((roleId) => ({
        roleId,
        filled: slotsFilled(roleId),
        total: slotTotal(roleId),
      }));
    },

    get dailyPayroll(): number {
      return totalDailyPayroll();
    },

    getPayBoard(): readonly StaffPay[] {
      return roster.map((s) => ({
        staffId: s.id,
        roleId: s.role_id,
        grade: currentGrade(s),
        paidGrade: s.paidGrade ?? currentGrade(s),
        dailyWage: paidWageFor(s),
        askingWage: askingWageFor(s),
      }));
    },

    getRaiseRequests(): readonly RaiseRequest[] {
      // Roster order, not insertion order, so the prompts read down the People
      // surface in the same sequence as the cards they belong to.
      return roster
        .map((s) => raiseRequests.get(s.id))
        .filter((r): r is RaiseRequest => r !== undefined);
    },

    getRaiseRequest(staffId: string): RaiseRequest | null {
      return raiseRequests.get(staffId) ?? null;
    },

    acceptRaise(staffId: string): void {
      const request = raiseRequests.get(staffId);
      if (!request) {
        throw new StaffOrgError(`No outstanding raise request for "${staffId}"`);
      }
      const staff = roster.find((s) => s.id === staffId);
      if (!staff) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }

      // The wage becomes the number on the prompt, and the grade becomes the
      // one they asked at — not whatever they are today. You agreed to a stated
      // price. Both are set: the wage is what the drain charges (and a matched
      // rival offer is above the grade's book wage, so it cannot be recovered
      // from the grade), the grade is what the next demand is measured against.
      staff.paidGrade = request.grade;
      staff.paidWage = request.askedWage;
      raiseRequests.delete(staffId);
      // The cooldown is a consequence of refusal only. Someone you just paid
      // has no reason to be barred from asking again when they grow again.
      raiseCooldownUntil.delete(staffId);

      bus.publish('staff:raise_answered', {
        staffId,
        roleId: staff.role_id,
        day: currentDay,
        accepted: true,
        currentWage: request.currentWage,
        askedWage: request.askedWage,
        rivalName: request.rivalName,
      });
    },

    refuseRaise(staffId: string): void {
      const request = raiseRequests.get(staffId);
      if (!request) {
        throw new StaffOrgError(`No outstanding raise request for "${staffId}"`);
      }

      raiseRequests.delete(staffId);
      // A cooldown is a term of the *raise* negotiation: it buys quiet from
      // someone who is staying. Nobody who was just poached is staying, so
      // there is nothing to keep quiet — the entry would only ride along in
      // every save from here.
      if (request.rivalName === undefined) {
        raiseCooldownUntil.set(staffId, currentDay + pay.raiseCooldownDays);
      }

      bus.publish('staff:raise_answered', {
        staffId,
        roleId: request.roleId,
        day: currentDay,
        accepted: false,
        currentWage: request.currentWage,
        askedWage: request.askedWage,
        rivalName: request.rivalName,
      });

      // Letting a rival's offer stand IS letting them go (#357). Published
      // after the answer so the two facts arrive in the order they happened,
      // and through the same `staff:quit` the deadline and the morale check
      // use — one departure path, three causes.
      if (request.rivalName !== undefined) {
        const staff = roster.find((s) => s.id === staffId);
        if (staff) leaveForRival(staff, request, currentDay);
      }
    },

    snapshot(): StaffOrgSnapshot {
      return {
        schemaVersion: 1,
        currentDay,
        roster: [...roster],
        raiseRequests: [...raiseRequests.values()],
        raiseCooldowns: [...raiseCooldownUntil.entries()],
      };
    },

    restore(snap: StaffOrgSnapshot): void {
      currentDay = snap.currentDay;
      roster.length = 0;
      raiseRequests.clear();
      raiseCooldownUntil.clear();
      for (const request of snap.raiseRequests ?? []) {
        raiseRequests.set(request.staffId, request);
      }
      for (const [staffId, until] of snap.raiseCooldowns ?? []) {
        raiseCooldownUntil.set(staffId, until);
      }
      for (const s of snap.roster) {
        const member = rehydrateStaff(s, taxonomy, masterSeed);
        // Saves predating the wage book (#353) carry no `paidGrade`. Materialize
        // it from what the person is worth *now*, which is the behavior-neutral
        // default: they arrive paid what they're currently worth, so the raise
        // trigger (`grade > paidGrade`) starts quiet and fires the first time
        // they actually outgrow it, exactly as a fresh hire does.
        if (member.paidGrade === undefined) member.paidGrade = currentGrade(member);
        // Same materialization for the wage (#357): a save written before the
        // agreed wage was stored is restored paying exactly what #353's derived
        // reading charged, so a reload changes nobody's pay.
        if (member.paidWage === undefined) {
          member.paidWage = wageFor(member.role_id, member.paidGrade);
        }
        roster.push(member);
      }
    },

    getCandidates(roleId: string): readonly CandidateListing[] {
      const role = taxonomy.roles[roleId];
      if (!role) throw new StaffOrgError(`Unknown role "${roleId}"`);
      if (role.hireTier !== undefined && getTier !== undefined) {
        const current = getTier();
        if (current < role.hireTier) {
          throw new StaffOrgError(
            `Role "${roleId}" requires dealership tier ${role.hireTier} (current: ${current})`,
          );
        }
      }
      if (!rolePool.has(roleId)) {
        buildCandidatesForRole(roleId);
      }
      return (rolePool.get(roleId) ?? []).map((id) => candidatePool.get(id)!);
    },

    hire(candidateId: string): void {
      const listing = candidatePool.get(candidateId);
      if (!listing) {
        throw new StaffOrgError(`Unknown candidate "${candidateId}"`);
      }

      // Scarcity is per ROLE, not per body (#352, C1 R3): what stops the player
      // buying five A-players is that the store has one desk for them. The UI
      // never offers a candidate for a full role, so this throw is the engine's
      // lock, not a message the player is meant to read.
      const roleId = listing.staff.role_id;
      const total = slotTotal(roleId);
      const filled = slotsFilled(roleId);
      if (filled >= total) {
        const tier = getTier ? getTier() : 1;
        throw new StaffOrgError(
          `No open slot for "${roleId}": tier ${tier} has ${total} (filled: ${filled})`,
        );
      }

      economy.postExpense(listing.hiringCost, `Hiring — ${listing.staff.role_id}`);

      // The grade they signed at is the grade they're paid at (#353), and the
      // wage on the listing is the wage they're on (#357) — the card's number
      // and the ledger's number are the same object. Set here rather than in
      // the factory because a candidate on the board is not on anyone's
      // payroll; these two fields are what "employed here" means.
      listing.staff.paidGrade = listing.grade;
      listing.staff.paidWage = listing.dailyWage;
      roster.push(listing.staff);
      candidatePool.delete(candidateId);

      const roleIds = rolePool.get(listing.staff.role_id);
      if (roleIds) {
        const idx = roleIds.indexOf(candidateId);
        if (idx !== -1) roleIds.splice(idx, 1);
      }

      bus.publish('staff:hired', {
        staffId: listing.staff.id,
        roleId: listing.staff.role_id,
        day: currentDay,
        hiringCost: listing.hiringCost,
      });
    },

    assessCondition(vehicle: ConditionAssessInput): ConditionRead | null {
      if (!realizedReconFor) return null;
      // Pick the UCM with the highest condition_reading skill. Ties broken by
      // id (stable) so two equally-skilled UCMs don't flicker between reads.
      let best: StaffWithComposites | null = null;
      let bestSkill = -Infinity;
      for (const s of roster) {
        if (s.role_id !== 'used-car-manager') continue;
        // Effective (grown) skill, M7 (#294) — appraisal advice sharpens as the
        // UCM's `condition_reading` grows with tenure, same as the gates.
        const skill = s.effectiveSkills[CONDITION_READING_SKILL_ID] ?? 0;
        if (skill > bestSkill || (skill === bestSkill && best !== null && s.id < best.id)) {
          best = s;
          bestSkill = skill;
        }
      }
      if (!best) return null;

      const realized = realizedReconFor(vehicle);
      const seed = deriveConditionReadSeed(masterSeed, vehicle.id, best.id);
      return computeConditionRead(
        { realizedRecon: realized, estimate: vehicle.reconEstimate, skill: bestSkill, seed },
        config.conditionRead,
      );
    },

    fire(staffId: string): void {
      const idx = roster.findIndex((s) => s.id === staffId);
      if (idx === -1) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }
      const [fired] = roster.splice(idx, 1);
      clearRaiseState(fired.id);
      bus.publish('staff:fired', {
        staffId: fired.id,
        roleId: fired.role_id,
        day: currentDay,
      });
    },

    getPromotionOptions(staffId: string): readonly PromotionOption[] {
      const staff = roster.find((s) => s.id === staffId);
      if (!staff) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }
      const role = taxonomy.roles[staff.role_id];
      if (!role || !meetsPromotionGates(staff)) return [];
      return role.promotes_to
        .filter((toRoleId) => isTargetTierUnlocked(toRoleId))
        // A desk you cannot sit at is not an option (#352). Slots gate promotion
        // exactly as they gate hiring, and worker-tier roles — which are ONLY
        // reached this way — are gated here alone.
        .filter((toRoleId) => slotsFilled(toRoleId) < slotTotal(toRoleId))
        .map((toRoleId) => ({ toRoleId }));
    },

    promote(staffId: string, toRoleId: string): void {
      const idx = roster.findIndex((s) => s.id === staffId);
      if (idx === -1) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }
      const staff = roster[idx];
      const role = taxonomy.roles[staff.role_id];
      if (!role) {
        throw new StaffOrgError(`Staff has unknown role "${staff.role_id}"`);
      }
      if (!role.promotes_to.includes(toRoleId)) {
        throw new StaffOrgError(
          `Role "${staff.role_id}" cannot promote to "${toRoleId}" (illegal edge)`,
        );
      }
      if (!isTargetTierUnlocked(toRoleId)) {
        const target = taxonomy.roles[toRoleId];
        throw new StaffOrgError(
          `Promotion to "${toRoleId}" requires dealership tier ${target?.hireTier} (current: ${getTier ? getTier() : 1})`,
        );
      }
      if (!meetsPromotionGates(staff)) {
        throw new StaffOrgError(
          `Staff "${staffId}" does not meet the promotion gates for "${staff.role_id}"`,
        );
      }
      const targetTotal = slotTotal(toRoleId);
      const targetFilled = slotsFilled(toRoleId);
      if (targetFilled >= targetTotal) {
        throw new StaffOrgError(
          `No open slot for "${toRoleId}": tier ${getTier ? getTier() : 1} has ${targetTotal} (filled: ${targetFilled})`,
        );
      }

      const fromRoleId = staff.role_id;
      // In-place replacement keeps the staff id, so StaffMorale / StaffDispatch
      // bindings (keyed by id) survive the promotion.
      const promoted = promoteStaff(staff, toRoleId, taxonomy, masterSeed);
      // You took the desk, you get the desk's pay (#353) — so the new role's
      // wage at the grade they are paid at, which also clears any premium a
      // matched rival offer had put on the old job (#357). A promotion is a new
      // agreement, not a carried-over one.
      promoted.paidWage = wageFor(toRoleId, promoted.paidGrade ?? currentGrade(promoted));
      roster[idx] = promoted;
      // A demand outstanding against the OLD desk is void (#356). The wage moved
      // by role the moment they took the new job, and the two numbers on the
      // prompt were the old role's. If they are still underpaid for the desk
      // they now sit at, they ask again tomorrow — at the new role's numbers.
      // The cooldown survives: it records that they asked recently, which is
      // still true.
      raiseRequests.delete(staffId);

      bus.publish('staff:promoted', {
        staffId,
        fromRoleId,
        toRoleId,
        day: currentDay,
      });
    },
  };
}
