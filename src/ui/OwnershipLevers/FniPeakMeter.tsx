import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { ProgressBar, money } from '../kit';
import { emptyState } from '../copy';

/** One posture as the meter draws it — all money already resolved by the caller. */
export interface FniPeakBar {
  readonly id: string;
  readonly label: string;
  /** Finance profit on a contract that gets bought, in dollars. */
  readonly reservePerDeal: number;
  /** Share of contracts the bank buys at this markup, 0–1. */
  readonly stickRate: number;
  /** Expected gross per financed customer at this posture, in dollars. */
  readonly expectedGrossPerDeal: number;
  /** Satisfaction given up per gouged contract, ≤ 0. */
  readonly satisfactionCostPerDeal: number;
}

export interface FniPeakMeterProps {
  /** One entry per posture, in the same order the dial shows them. */
  postures: readonly FniPeakBar[];
  /** The posture currently selected on the dial. */
  selectedId: string;
  /** Where the store's total crests today, or `null` with nothing to read. */
  peakId: string | null;
  /** How many financed contracts the reading was computed over. */
  dealsRead: number;
}

// Per-deal figures are **exact** (issue 387): they are the reason the player
// moves the posture dial, and they live in the low hundreds where a compact
// string would round the whole signal away.
const percent = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The posture peak meter (#370) — twin opposed bars and the crest.
 *
 * The dial above it is one standing choice with two teeth on it, and until this
 * surface existed both were invisible until they had already bitten. Marking
 * the rate up harder earns more on each contract (bar one fills) and gets more
 * contracts turned down (bar two drains), and the two together **crest**: the
 * best answer is somewhere in the middle, and it moves with the finance
 * manager's skill and the credit of the people walking in. That is why the dial
 * has three stops and no arrow — an arrow would have to point at a maximum, and
 * the maximum is the wrong answer.
 *
 * Purely a read. It renders numbers the caller computed and changes nothing.
 */
export function FniPeakMeter({
  postures,
  selectedId,
  peakId,
  dealsRead,
}: FniPeakMeterProps) {
  const t = useTheme();

  const caption: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.sm,
  };
  const barLabel: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    marginBottom: t.spacing.xxs,
  };
  const barRow: ViewStyle = { marginTop: t.spacing.sm };
  const peakLine: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
    marginTop: t.spacing.sm,
  };
  const root: ViewStyle = { marginTop: t.spacing.md };

  if (dealsRead === 0 || postures.length === 0) {
    return (
      <View style={root} testID="fni-peak-meter">
        <Text style={caption} testID="fni-peak-empty">
          {emptyState('fni_peak_meter')}
        </Text>
      </View>
    );
  }

  const selected =
    postures.find((p) => p.id === selectedId) ?? postures[0];
  const peak = peakId ? postures.find((p) => p.id === peakId) : undefined;

  // Each bar is drawn against the best any posture manages, so the bars say
  // "where your choice sits among the three" rather than plotting dollars
  // against an axis the player has no reason to know.
  const bestReserve = Math.max(...postures.map((p) => p.reservePerDeal), 0);
  const bestGross = Math.max(...postures.map((p) => p.expectedGrossPerDeal), 0);
  const share = (value: number, best: number) => (best > 0 ? value / best : 0);

  return (
    <View style={root} testID="fni-peak-meter">
      <Text style={caption}>
        What {selected.label} is worth on the{' '}
        {dealsRead === 1 ? 'one loan contract' : `${dealsRead} loan contracts`}{' '}
        this store has written.
      </Text>

      <View style={barRow}>
        <Text style={barLabel} testID="fni-peak-reserve-label">
          Finance profit per contract — {money(selected.reservePerDeal)}
        </Text>
        <ProgressBar
          value={share(selected.reservePerDeal, bestReserve)}
          tone="reward"
          fillTestID="fni-peak-reserve-fill"
        />
      </View>

      <View style={barRow}>
        <Text style={barLabel} testID="fni-peak-stick-label">
          Contracts the bank buys — {percent(selected.stickRate)}
        </Text>
        <ProgressBar
          value={selected.stickRate}
          tone="positive"
          fillTestID="fni-peak-stick-fill"
        />
      </View>

      <View style={barRow}>
        <Text style={barLabel} testID="fni-peak-total-label">
          Total gross per financed customer —{' '}
          {money(selected.expectedGrossPerDeal)}
        </Text>
        <ProgressBar
          value={share(selected.expectedGrossPerDeal, bestGross)}
          tone="primary"
          fillTestID="fni-peak-total-fill"
        />
      </View>

      {peak && (
        <Text style={peakLine} testID="fni-peak-callout">
          {peak.id === selected.id
            ? `${peak.label} earns the most right now. Mark the rate up harder and the bank turns down enough contracts to cost you more than the extra profit is worth.`
            : `${peak.label} earns the most right now — ${money(
                peak.expectedGrossPerDeal,
              )} per financed customer against your ${money(
                selected.expectedGrossPerDeal,
              )}.`}
        </Text>
      )}

      {selected.satisfactionCostPerDeal < 0 && (
        <Text style={caption} testID="fni-peak-satisfaction">
          Buyers marked up this far also rate the store lower, which thins next
          week&apos;s foot traffic — a cost this total does not count.
        </Text>
      )}
    </View>
  );
}
