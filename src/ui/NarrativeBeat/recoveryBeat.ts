/**
 * Recovery-state read-model (#326, workstream A4 silent-system surfacing).
 *
 * Four game-logic events fire when the player takes a survivable hit — a tier
 * contraction or a consent decree — as opposed to the terminal endings that
 * route to the EndCard. Until now they rendered nothing: a Tier 2 contraction
 * or a Tier 3 consent decree happened silently. This module distills those
 * events into two pure presentation shapes:
 *
 *  1. `RecoveryBeat` — the one-shot narrative beat shown the moment the hit
 *     lands. Every one of the four events produces a beat. It names the CAUSE,
 *     the COST, and the PATH forward, framed as "you took a hit and are climbing
 *     back" — deliberately distinct from the terminal end-card.
 *
 *  2. `RecoveryBanner` — the persistent "you're climbing back" strip shown while
 *     a recovery state is still ACTIVE. It derives entirely from persisted
 *     monitor state (debt overhang amortizing weekly; a license-suspension
 *     window ticking down), so it survives save/load and clears itself when the
 *     state resolves. Only the two contractions that leave a lingering, measured
 *     window drive a banner — the indictment contraction and the consent decree
 *     are instantaneous in the engine (a one-shot stake/cash penalty with no
 *     window), so those surface as a beat only. We surface what the engine
 *     persists rather than inventing a countdown it doesn't model.
 *
 * Presentation-only: no game-logic imports. The copy lives here (same split as
 * `MarketStatePanel` / `ManagerStatusCard` — the view owns wording); the
 * composition root supplies the numbers.
 */

/** The four survivable recovery events, keyed by their EventBus name tail. */
import { money as kitMoney } from '../kit';

export type RecoveryEventKind =
  | 'bankruptcy_contraction'
  | 'indictment_contraction'
  | 'ag_complaint_contraction'
  | 'ag_complaint_consent_decree';

/** Payload the composition root forwards for each event (a narrow subset of the
 *  EventBus payloads — only what the copy consumes). */
export interface RecoveryEventInput {
  kind: RecoveryEventKind;
  /** Tier the player fell FROM (contractions). Absent for the consent decree,
   *  which preserves the tier. */
  fromTier?: number;
  /** Tier preserved (consent decree only). */
  tier?: number;
  /** Debt overhang taken on (bankruptcy contraction). */
  debtPrincipal?: number;
  /** Personal capital forfeited (indictment contraction). */
  stakePenalty?: number;
  /** License-suspension window length in days (AG contraction). */
  suspensionDays?: number;
  /** Cash paid + reputation points lost (consent decree). */
  cashCost?: number;
  reputationHit?: number;
}

/** A single narrative beat — cause / cost / path, plus a headline. */
export interface RecoveryBeat {
  kind: RecoveryEventKind;
  /** Short reassuring headline — names the survival, not the disaster. */
  title: string;
  /** What happened. */
  cause: string;
  /** What it cost you. */
  cost: string;
  /** How you climb back. */
  path: string;
}

/** Persisted recovery-state kinds that drive the lingering banner. */
export type RecoveryBannerKind = 'debt-overhang' | 'license-suspension';

/** One active recovery banner row. */
export interface RecoveryBannerModel {
  kind: RecoveryBannerKind;
  headline: string;
  detail: string;
}

/** The persisted monitor facts the banner derives from. Assembled by the
 *  composition root from BankruptcyMonitor + RegulatoryMeter (both persist
 *  across save/load), passed here as plain data. */
export interface RecoveryMonitorSnapshot {
  /** Debt still owed from a bankruptcy contraction (amortizes weekly to 0). */
  outstandingDebt: number;
  /** Whether a license-suspension window is currently in effect. */
  isSuspended: boolean;
  /** Days left on the suspension window (0 when not suspended). */
  suspensionDaysRemaining: number;
}

/**
 * The beat's figures are **exact** (issue 387): an outstanding debt and a
 * suspension are things the player owes and pays, not ambient readings. The kit
 * formatter carries the same Intl-free grouping this file used to roll itself,
 * so the copy is unchanged; the clamp at zero stays here because a recovery beat
 * never states a negative debt.
 */
function money(n: number): string {
  return kitMoney(Math.max(0, n));
}

/** Number of days worded for copy ("1 day" / "12 days"). */
function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/**
 * Build the narrative beat for a recovery event. Pure: same input → same copy.
 * Missing numbers degrade to neutral phrasing rather than printing `$NaN`.
 */
export function buildRecoveryBeat(input: RecoveryEventInput): RecoveryBeat {
  const droppedTo = input.fromTier != null ? Math.max(1, input.fromTier - 1) : null;
  const dropClause =
    droppedTo != null ? ` and dropped back to Tier ${droppedTo}` : '';

  switch (input.kind) {
    case 'bankruptcy_contraction':
      return {
        kind: input.kind,
        title: 'You went under — but you’re not out.',
        cause:
          'Your operation ran out of cash and the bank called in your notes.',
        cost:
          `You lost the store${dropClause}, ` +
          `carrying ${money(input.debtPrincipal ?? 0)} of debt overhang.`,
        path: 'Weekly payments chip the debt down on their own. Rebuild your cash and climb back up.',
      };
    case 'indictment_contraction':
      return {
        kind: input.kind,
        title: 'You settled the case — the business survived.',
        cause:
          'A criminal complaint forced you to put up your personal stake to keep the doors open.',
        cost:
          `You forfeited ${money(input.stakePenalty ?? 0)} of personal capital${dropClause}.`,
        path: 'The slate is clear. Run clean and rebuild the operation.',
      };
    case 'ag_complaint_contraction':
      return {
        kind: input.kind,
        title: 'The Attorney General came down hard — you’re still standing.',
        cause:
          'The state acted on customer complaints and moved against your license.',
        cost:
          `Your dealer license is suspended for ${days(input.suspensionDays ?? 0)}${dropClause}.`,
        path: 'Sales resume the moment the suspension lifts. Keep your record clean until then.',
      };
    case 'ag_complaint_consent_decree':
      return {
        kind: input.kind,
        title: 'You signed a consent decree — no tier lost.',
        cause:
          'Rather than fight the state, you agreed to a settlement to keep the store open.',
        cost:
          `You paid ${money(input.cashCost ?? 0)} and your reputation took a ` +
          `${Math.round(input.reputationHit ?? 0)}-point hit.` +
          (input.tier != null ? ` Your Tier ${input.tier} store stays intact.` : ''),
        path: 'Your tier is intact. Clean operations rebuild the trust you lost.',
      };
  }
}

/**
 * Derive the active persistent banners from the current monitor snapshot. A
 * banner is present exactly while its underlying state is active, so it clears
 * itself when the debt is paid off / the suspension window elapses. Multiple can
 * be active at once (you can carry debt AND be suspended); order is stable
 * (debt first, then suspension).
 */
export function buildRecoveryBanners(
  snapshot: RecoveryMonitorSnapshot,
): readonly RecoveryBannerModel[] {
  const banners: RecoveryBannerModel[] = [];
  if (snapshot.outstandingDebt > 0) {
    banners.push({
      kind: 'debt-overhang',
      headline: 'Recovering from insolvency',
      detail: `${money(snapshot.outstandingDebt)} debt overhang — paying down weekly.`,
    });
  }
  if (snapshot.isSuspended) {
    banners.push({
      kind: 'license-suspension',
      headline: 'License suspended',
      detail:
        snapshot.suspensionDaysRemaining > 0
          ? `${days(snapshot.suspensionDaysRemaining)} remaining — sales resume when it lifts.`
          : 'Sales resume when it lifts.',
    });
  }
  return banners;
}
