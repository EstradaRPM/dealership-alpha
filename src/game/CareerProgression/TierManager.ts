import type { EventBus } from '../EventBus';
import { loadTierConfig, type TierConfig } from './tierData';

export interface TierManagerState {
  currentTier: number;
  businessName: string;
  accentColor: string;
  fontId: string;
  customersServed: number;
  /**
   * #250 — consecutive *meet-or-better* monthly gate verdicts posted at the
   * CURRENT tier. Strict-consecutive: any below-meet month resets it to 0.
   * Optional on input so pre-#250 saves (and the legacy raw-state callers)
   * rehydrate to a fresh streak instead of erroring.
   */
  monthStreak?: number;
  /**
   * #250 — T3 streak completed → the franchise dossier is ready. Persisted,
   * surfaced on the Home gate strip, and (deliberately) does NOT auto-advance:
   * Act 2 entry is player-initiated courtship (#223).
   */
  dossierReady?: boolean;
}

/**
 * Persistence surface for the CareerProgression module (#192, parent #186).
 * Module-owned `schemaVersion`, same convention as Economy/Inventory. Wraps the
 * full TierManager state: tier + business identity (tier/businessName/branding)
 * AND career progress (`customersServed` accumulator + the #250 advancement
 * streak / dossier-ready flag). This single blob is the world seam's
 * `tierManager` key. Bumped to v2 in #250 (streak + dossier fields); older v1
 * blobs rehydrate via the `?? default` reads in `restore`, so no envelope
 * migration is needed (a field added *inside* a module blob is that module's
 * schemaVersion concern — docs/save-migration-recipe.md).
 */
export interface TierManagerSnapshot extends TierManagerState {
  readonly schemaVersion: 2;
}

export interface TierManagerDeps {
  bus: EventBus;
  config?: TierConfig;
  /**
   * #250 — required consecutive meet-or-better months to LEAVE each tier, keyed
   * by tier number (the tier being left). Sourced from `data/tier-gate.json`'s
   * per-tier `streak` field by the composition root. Omitted ⇒ the locked rule
   * "to leave tier N, post N months" (identity fallback), so isolation tests
   * need not wire the gate config.
   */
  streaksByTier?: Readonly<Record<number, number>>;
}

export interface TierManager {
  readonly currentTier: number;
  readonly businessName: string;
  readonly accentColor: string;
  readonly fontId: string;
  readonly customersServed: number;
  /** Consecutive meet-or-better gate months banked at the current tier (#250). */
  readonly monthStreak: number;
  /** Months still needed to leave the current tier (the "of N" in "month X of N"). */
  readonly requiredStreak: number;
  /** T3 streak completed — franchise dossier ready, no auto-advance (#250/#223). */
  readonly dossierReady: boolean;
  applyTierUp(opts: { businessName: string; accentColor: string; fontId: string }): void;
  // Forced downgrade used by failure paths (e.g., Tier 2 bankruptcy contraction
  // back to Tier 1). Does not publish career:tier_up.
  applyContraction(toTier: number): void;
  getSerializableState(): TierManagerState;
  restoreState(state: TierManagerState): void;
  /** #192 SaveStore seam: versioned capture/rehydrate (tier + career progress). */
  snapshot(): TierManagerSnapshot;
  restore(snap: TierManagerSnapshot): void;
}

export function createTierManager(deps: TierManagerDeps): TierManager {
  const { bus } = deps;
  const config = deps.config ?? loadTierConfig();
  const streaksByTier = deps.streaksByTier;

  // The top tier in v1 (gravel → paved → showroom). Leaving it doesn't advance
  // (no T4 in v1) — it arms the franchise dossier instead.
  const maxTier = config.tiers.length;

  let currentTier = 1;
  let businessName = '';
  let accentColor = config.accentOptions[0].color;
  let fontId = config.fontOptions[0].id;
  let customersServed = 0;
  let monthStreak = 0;
  let dossierReady = false;

  // Required consecutive meet-or-better months to leave tier N. Data-driven
  // from tier-gate.json; falls back to the locked identity rule (N for tier N).
  const requiredStreakFor = (tier: number): number =>
    streaksByTier?.[tier] ?? tier;

  bus.subscribe('customer:resolved', () => {
    customersServed += 1;
  });

  // #250 — advancement consumes the monthly tier-gate verdict (fired once on
  // clock:month_ended). A meet-or-better month extends the streak; any below-meet
  // month resets it strictly to 0. On reaching the tier's required streak, advance
  // (T1→T2→T3) — or, at the top tier, arm the franchise dossier without advancing
  // (Act 2 courtship is player-initiated, #223). The old instantaneous
  // triggerThreshold path (cash/customers/reputation snapshot) is retired.
  bus.subscribe('tierGate:month_verdict', ({ overall, day }) => {
    const meetOrBetter = overall === 'meet' || overall === 'exceed';
    if (!meetOrBetter) {
      monthStreak = 0;
      return;
    }
    // Already at the dossier-ready terminal state: nothing further to track.
    if (dossierReady) return;

    monthStreak += 1;
    if (monthStreak < requiredStreakFor(currentTier)) return;

    if (currentTier >= maxTier) {
      // Top-tier streak complete: arm the dossier, do NOT advance past T3.
      dossierReady = true;
      return;
    }
    const fromTier = currentTier;
    currentTier += 1;
    monthStreak = 0; // the new tier's streak starts fresh.
    bus.publish('career:tier_up', { fromTier, toTier: currentTier, day });
  });

  return {
    get currentTier() { return currentTier; },
    get businessName() { return businessName; },
    get accentColor() { return accentColor; },
    get fontId() { return fontId; },
    get customersServed() { return customersServed; },
    get monthStreak() { return monthStreak; },
    get requiredStreak() { return requiredStreakFor(currentTier); },
    get dossierReady() { return dossierReady; },

    applyTierUp({ businessName: name, accentColor: color, fontId: font }) {
      businessName = name;
      accentColor = color;
      fontId = font;
    },

    applyContraction(toTier) {
      if (toTier < 1 || toTier >= currentTier) {
        throw new Error(
          `applyContraction(${toTier}) invalid from tier ${currentTier}`,
        );
      }
      currentTier = toTier;
      // A forced contraction unwinds any in-progress advancement streak.
      monthStreak = 0;
    },

    getSerializableState() {
      return {
        currentTier,
        businessName,
        accentColor,
        fontId,
        customersServed,
        monthStreak,
        dossierReady,
      };
    },

    restoreState(state) {
      currentTier = state.currentTier;
      businessName = state.businessName;
      accentColor = state.accentColor;
      fontId = state.fontId;
      customersServed = state.customersServed;
      monthStreak = state.monthStreak ?? 0;
      dossierReady = state.dossierReady ?? false;
    },

    snapshot() {
      return {
        schemaVersion: 2,
        currentTier,
        businessName,
        accentColor,
        fontId,
        customersServed,
        monthStreak,
        dossierReady,
      };
    },

    restore(snap) {
      currentTier = snap.currentTier;
      businessName = snap.businessName;
      accentColor = snap.accentColor;
      fontId = snap.fontId;
      customersServed = snap.customersServed;
      // Pre-#250 (schemaVersion 1) blobs lack these — default cleanly.
      monthStreak = snap.monthStreak ?? 0;
      dossierReady = snap.dossierReady ?? false;
    },
  };
}
