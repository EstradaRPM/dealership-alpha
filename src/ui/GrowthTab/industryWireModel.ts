/**
 * Industry Wire read model (#176, parent #150).
 *
 * The wire's whole job on screen is to make RELIABILITY legible: the player has
 * to be able to tell at a glance whether a line already happened, is somebody's
 * forward call, or is just catching up to something their own numbers already
 * showed. So every headline carries a plain-language trust badge, and the panel
 * can explain the three badges in the player's own words — no jargon, and no
 * temperature words standing in for the axis.
 *
 * Pure: labels and explanatory notes arrive from the news catalog (copy lives in
 * `data/news-templates.json`), the day is a number, and nothing here reaches
 * into the engine.
 */
export type WireReliability = 'direct' | 'leading' | 'lagging';

export interface WireHeadlineView {
  readonly id: string;
  readonly text: string;
  /** Who is talking — "Auction block report", "Analyst desk", "Around town". */
  readonly sourceLabel: string;
  readonly reliability: WireReliability;
  /** The trust badge — "Confirmed" / "Rumor" / "Recap". */
  readonly reliabilityLabel: string;
  /** "Today" / "Yesterday" / "Day 12". */
  readonly dayLabel: string;
  /**
   * Access gating (#178). A locked row keeps its place in the chronology and
   * still says who filed it and when — *that* somebody reported something is
   * the tease; `text` carries the aspirational line instead of the report.
   */
  readonly locked: boolean;
  /** The unlock id blocking this row, for grouping the footer. Null when open. */
  readonly lockId: string | null;
}

/**
 * One closed door, as the wire footer shows it: what it is, what opens it, and
 * — for a subscription the player's tier already sells them — what it costs and
 * whether they're currently paying for it.
 */
export interface WireUnlockView {
  readonly id: string;
  readonly label: string;
  /** Plain-language sentence naming what to do about it. */
  readonly hint: string;
  readonly blurb: string;
  /** "3 reports" / "1 report" currently behind this door, or null for none. */
  readonly withheldLabel: string | null;
  /** True when this is a subscription the player's tier can actually buy. */
  readonly purchasable: boolean;
  readonly active: boolean;
  /** "Active — $45 a day", shown while subscribed. Null when not purchasable. */
  readonly costNote: string | null;
  /** Button copy — "Subscribe" / "Cancel". Null when there's no button. */
  readonly actionLabel: string | null;
}

export interface WireLegendEntry {
  readonly reliability: WireReliability;
  readonly label: string;
  readonly note: string;
}

export interface IndustryWireModel {
  /** Newest first. Empty until the first headline publishes. */
  readonly headlines: readonly WireHeadlineView[];
  /** One entry per trust badge, in trust order. */
  readonly legend: readonly WireLegendEntry[];
  /** The doors, in catalog order. Empty only if the config declares none. */
  readonly unlocks: readonly WireUnlockView[];
  /** Footer heading — "What you're not reading". */
  readonly unlocksHeading: string;
}

/** Structural input — one published headline, engine-side shape. */
export interface WireHeadlineInput {
  readonly id: string;
  readonly day: number;
  readonly text: string;
  readonly sourceLabel: string;
  readonly reliability: WireReliability;
  /**
   * The lock standing between the player and this headline (#178), or null when
   * they can read it. Resolved engine-side by MarketIntel — the view never
   * decides access, it only renders the verdict.
   */
  readonly lock: WireLockInput | null;
}

/** Structural input — one unlock as MarketIntel resolved it. */
export interface WireLockInput {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly blurb: string;
  readonly kind: 'subscription' | 'staff';
  readonly dailyCost: number | null;
  /** Whether the player's tier lets them act on the hint yet. */
  readonly available: boolean;
  readonly active: boolean;
}

export interface WireGatingCopyInput {
  /** `{source}` — what a locked row says in place of the report. */
  readonly lockedRowText: string;
  readonly unlocksHeading: string;
  readonly subscribeLabel: string;
  readonly cancelLabel: string;
  /** `{cost}` — the standing note on an active subscription. */
  readonly activeNote: string;
}

export interface IndustryWireInputs {
  /** Newest first, as MarketNews hands them over. */
  readonly headlines: readonly WireHeadlineInput[];
  readonly currentDay: number;
  readonly reliabilityLabels: Readonly<Partial<Record<WireReliability, string>>>;
  readonly reliabilityNotes: Readonly<Partial<Record<WireReliability, string>>>;
  /** Every door, open or closed, in catalog order (#178). */
  readonly locks: readonly WireLockInput[];
  readonly gatingCopy: WireGatingCopyInput;
}

/** Trust order, most verifiable first — also the legend's display order. */
const RELIABILITY_ORDER: readonly WireReliability[] = ['direct', 'leading', 'lagging'];

export function wireDayLabel(day: number, currentDay: number): string {
  if (day >= currentDay) return 'Today';
  if (day === currentDay - 1) return 'Yesterday';
  return `Day ${day}`;
}

/** `{slot}` fill, shared by the locked-row line and the standing-cost note. */
function fill(text: string, slots: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(slots, key) ? String(slots[key]) : whole,
  );
}

function reportCount(n: number): string {
  return `${n} ${n === 1 ? 'report' : 'reports'}`;
}

export function buildIndustryWire(inputs: IndustryWireInputs): IndustryWireModel {
  const withheld = new Map<string, number>();
  for (const h of inputs.headlines) {
    if (h.lock) withheld.set(h.lock.id, (withheld.get(h.lock.id) ?? 0) + 1);
  }

  return {
    headlines: inputs.headlines.map((h) => ({
      id: h.id,
      // A locked row never leaks the report. It says who filed it — the shape
      // of what you're missing is the whole aspirational hook (#178).
      text: h.lock
        ? fill(inputs.gatingCopy.lockedRowText, { source: h.sourceLabel })
        : h.text,
      sourceLabel: h.sourceLabel,
      reliability: h.reliability,
      reliabilityLabel: inputs.reliabilityLabels[h.reliability] ?? h.reliability,
      dayLabel: wireDayLabel(h.day, inputs.currentDay),
      locked: h.lock != null,
      lockId: h.lock?.id ?? null,
    })),
    legend: RELIABILITY_ORDER.filter(
      (r) => inputs.reliabilityLabels[r] != null && inputs.reliabilityNotes[r] != null,
    ).map((r) => ({
      reliability: r,
      label: inputs.reliabilityLabels[r] as string,
      note: inputs.reliabilityNotes[r] as string,
    })),
    unlocks: inputs.locks.map((lock) => {
      // Only a subscription the player's tier already sells them gets a button.
      // A staff door is opened by hiring, which lives on People — the wire says
      // so plainly rather than growing a second hiring surface.
      const purchasable = lock.kind === 'subscription' && lock.available;
      const count = withheld.get(lock.id) ?? 0;
      return {
        id: lock.id,
        label: lock.label,
        hint: lock.hint,
        blurb: lock.blurb,
        withheldLabel: count > 0 ? reportCount(count) : null,
        purchasable,
        active: lock.active,
        costNote:
          purchasable && lock.active
            ? fill(inputs.gatingCopy.activeNote, { cost: lock.dailyCost ?? 0 })
            : null,
        actionLabel: purchasable
          ? lock.active
            ? inputs.gatingCopy.cancelLabel
            : inputs.gatingCopy.subscribeLabel
          : null,
      };
    }),
    unlocksHeading: inputs.gatingCopy.unlocksHeading,
  };
}
