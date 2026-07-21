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
}

/** Structural input — one published headline, engine-side shape. */
export interface WireHeadlineInput {
  readonly id: string;
  readonly day: number;
  readonly text: string;
  readonly sourceLabel: string;
  readonly reliability: WireReliability;
}

export interface IndustryWireInputs {
  /** Newest first, as MarketNews hands them over. */
  readonly headlines: readonly WireHeadlineInput[];
  readonly currentDay: number;
  readonly reliabilityLabels: Readonly<Partial<Record<WireReliability, string>>>;
  readonly reliabilityNotes: Readonly<Partial<Record<WireReliability, string>>>;
}

/** Trust order, most verifiable first — also the legend's display order. */
const RELIABILITY_ORDER: readonly WireReliability[] = ['direct', 'leading', 'lagging'];

export function wireDayLabel(day: number, currentDay: number): string {
  if (day >= currentDay) return 'Today';
  if (day === currentDay - 1) return 'Yesterday';
  return `Day ${day}`;
}

export function buildIndustryWire(inputs: IndustryWireInputs): IndustryWireModel {
  return {
    headlines: inputs.headlines.map((h) => ({
      id: h.id,
      text: h.text,
      sourceLabel: h.sourceLabel,
      reliability: h.reliability,
      reliabilityLabel: inputs.reliabilityLabels[h.reliability] ?? h.reliability,
      dayLabel: wireDayLabel(h.day, inputs.currentDay),
    })),
    legend: RELIABILITY_ORDER.filter(
      (r) => inputs.reliabilityLabels[r] != null && inputs.reliabilityNotes[r] != null,
    ).map((r) => ({
      reliability: r,
      label: inputs.reliabilityLabels[r] as string,
      note: inputs.reliabilityNotes[r] as string,
    })),
  };
}
