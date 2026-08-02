/**
 * Weekly market report read model (#177, parent #150).
 *
 * The wire is a ticker; this is the column. Its job on screen is to let the
 * player read the week in one stop: what moved, how loud the wire was about it,
 * and what the desk is betting on next — with the same trust badges the wire
 * already taught them, so the recap and the forward calls are never mistaken
 * for each other.
 *
 * Pure. The article's prose (summary + call lines) was frozen when the column
 * published; the chrome around it (title, headings, the tally sentence) is
 * filled here from the live catalog copy, so a wording retune reaches the
 * standing card instead of being frozen into the save.
 */
import type { WireReliability } from './industryWireModel';

export interface WeeklyMoveRow {
  readonly segment: string;
  readonly label: string;
  /** Signed whole percent — "+4%", "-3%", "0%". */
  readonly deltaLabel: string;
  readonly direction: 'up' | 'down' | 'flat';
  /** "3 reports" / "1 report", or null when the wire never named it. */
  readonly mentionsLabel: string | null;
}

export interface WeeklyCallRow {
  readonly id: string;
  readonly text: string;
}

export interface WeeklyBadge {
  readonly label: string;
  readonly reliability: WireReliability;
}

export interface WeeklyReportCardModel {
  readonly title: string;
  /** "Days 1–7". */
  readonly subtitle: string;
  readonly sourceLabel: string;
  readonly summary: string;
  readonly movesHeading: string;
  readonly moves: readonly WeeklyMoveRow[];
  /** Badges the recap half and the forward-call half of the card. */
  readonly recapBadge: WeeklyBadge | null;
  readonly callsHeading: string;
  readonly calls: readonly WeeklyCallRow[];
  readonly callsBadge: WeeklyBadge | null;
  /**
   * Access gating (#178): the calls half of the column is the same forward-call
   * lane the wire gates, so it is held back by the same door. Non-null means
   * `calls` is empty because the player can't read them — not because the desk
   * had nothing to say — and this is the sentence saying what would open it.
   */
  readonly callsLockedHint: string | null;
  /** Shown in place of the calls when the desk declined to bet. */
  readonly noCallsText: string;
  readonly tallyText: string;
}

/** Structural input — the persisted column, engine-side shape. */
export interface WeeklyReportInput {
  readonly day: number;
  readonly weekIndex: number;
  readonly fromDay: number;
  readonly toDay: number;
  readonly sourceLabel: string;
  readonly summary: string;
  readonly moves: readonly {
    readonly segment: string;
    readonly label: string;
    readonly delta: number;
    readonly mentions: number;
  }[];
  readonly forwardCalls: readonly { readonly kind: string; readonly text: string }[];
  readonly wireTally: {
    readonly total: number;
    readonly direct: number;
    readonly leading: number;
    readonly lagging: number;
  };
}

export interface WeeklyReportCopyInput {
  readonly title: string;
  readonly subtitle: string;
  readonly movesHeading: string;
  readonly callsHeading: string;
  readonly noCallsText: string;
  readonly wireTallyText: string;
}

export interface WeeklyReportInputs {
  /** Null until the first column publishes. */
  readonly report: WeeklyReportInput | null;
  /**
   * The forward-call lock (#178), or null when the player can read the calls.
   * Resolved engine-side by MarketIntel against the very same lane the wire's
   * `leading` headlines go through, so the column and the ticker can never
   * disagree about whether forward calls are yours.
   */
  readonly callsLockedHint?: string | null;
  readonly copy: WeeklyReportCopyInput;
  readonly reliabilityLabels: Readonly<Partial<Record<WireReliability, string>>>;
}

function fill(text: string, slots: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(slots, key) ? slots[key] : whole,
  );
}

/** Signed whole percent. Unlike the wire's `{pct}` slot this does NOT floor at
 *  1 — a column row that rounds to nothing should read "0%", not a fake 1%. */
export function signedPercent(fraction: number): string {
  const whole = Math.round(fraction * 100);
  return `${whole > 0 ? '+' : ''}${whole}%`;
}

function badge(
  reliability: WireReliability,
  labels: Readonly<Partial<Record<WireReliability, string>>>,
): WeeklyBadge | null {
  const label = labels[reliability];
  return label != null ? { label, reliability } : null;
}

export function buildWeeklyReportCard(
  inputs: WeeklyReportInputs,
): WeeklyReportCardModel | null {
  const { report, copy } = inputs;
  if (!report) return null;
  const callsLocked = inputs.callsLockedHint != null;

  return {
    title: copy.title,
    subtitle: fill(copy.subtitle, {
      fromDay: String(report.fromDay),
      toDay: String(report.toDay),
    }),
    sourceLabel: report.sourceLabel,
    summary: report.summary,
    movesHeading: copy.movesHeading,
    moves: report.moves.map((m) => {
      const whole = Math.round(m.delta * 100);
      return {
        segment: m.segment,
        label: m.label,
        deltaLabel: signedPercent(m.delta),
        direction: whole > 0 ? 'up' : whole < 0 ? 'down' : 'flat',
        mentionsLabel:
          m.mentions > 0
            ? `${m.mentions} ${m.mentions === 1 ? 'report' : 'reports'}`
            : null,
      };
    }),
    // The recap half already happened; the calls half is somebody's bet. Same
    // two badges the wire uses, so the player reads them the same way.
    recapBadge: badge('lagging', inputs.reliabilityLabels),
    callsHeading: copy.callsHeading,
    calls: callsLocked
      ? []
      : report.forwardCalls.map((c, i) => ({ id: `${c.kind}-${i}`, text: c.text })),
    callsLockedHint: callsLocked ? (inputs.callsLockedHint as string) : null,
    callsBadge: badge('leading', inputs.reliabilityLabels),
    noCallsText: copy.noCallsText,
    tallyText: fill(copy.wireTallyText, {
      total: String(report.wireTally.total),
      direct: String(report.wireTally.direct),
      leading: String(report.wireTally.leading),
      lagging: String(report.wireTally.lagging),
    }),
  };
}
