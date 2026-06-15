import { z } from 'zod';
import { parseData } from '../../game/data';
import { colors } from '../theme';

// Acceptance-negotiability bands (#287). Thresholds + semantic color keys live
// in data/tunables.json so the discount modal carries no magic numbers — it
// classifies an acceptance probability into a coarse FLEXIBLE→RIGID band for
// both the headline number and the live, number-free color on the price input.
const HeatBandSchema = z.object({
  id: z.string().min(1),
  /** Lower bound (inclusive) of this band; bands are ordered high→low. */
  minProb: z.number().min(0).max(1),
  /** Theme color token the band paints with. */
  colorKey: z.enum(['positive', 'reward', 'danger', 'primary', 'textMuted']),
  /** Short, coarse adjective shown next to the readout. */
  label: z.string().min(1),
});

const SectionSchema = z.object({
  bands: z.array(HeatBandSchema).min(1),
});

export type AcceptanceHeatBand = z.infer<typeof HeatBandSchema>;

let cached: readonly AcceptanceHeatBand[] | null = null;

export function acceptanceHeatBands(): readonly AcceptanceHeatBand[] {
  if (cached == null) {
    const raw = (
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../../data/tunables.json') as { discountAcceptanceHeat: unknown }
    ).discountAcceptanceHeat;
    cached = parseData(
      raw,
      SectionSchema,
      'data/tunables.json#discountAcceptanceHeat',
    ).bands;
  }
  return cached;
}

/** The band a probability (0..1) falls into — first whose `minProb` it clears. */
export function bandForProb(
  prob: number,
  bands: readonly AcceptanceHeatBand[],
): AcceptanceHeatBand {
  for (const band of bands) {
    if (prob >= band.minProb) return band;
  }
  return bands[bands.length - 1];
}

/** Resolve a band's semantic color key to its theme color value. */
export function bandColor(band: AcceptanceHeatBand): string {
  return colors[band.colorKey];
}
