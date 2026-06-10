import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FunnelLeakCause } from '../../game/CapacityManager';
import { useTheme } from '../theme';
import { Surface, SectionHeader, StatCard } from '../kit';

/**
 * Pure read-model for the MANAGERIAL just-ended-day recap (#119). The
 * composition root assembles this off the #110 CapacityManager day-funnel
 * accessor + running gross. The view renders these numbers and dispatches
 * nothing — no FloorSim/#99 access.
 */
export interface DayRecapModel {
  /** The day that just ended. */
  day: number;
  /** Drove-by: every customer offered to the admittance gate. */
  potentialTraffic: number;
  /** Walked-in: admitted within the day's capacity. */
  walkedIn: number;
  /** A salesperson actually engaged the customer. */
  staffEngaged: number;
  /** Engagement resulted in a closed deal (also the units sold). */
  sold: number;
  /** Today's gross (front + back, summed from closed deals). */
  gross: number;
  /** The single biggest-leak transition for the plain-language callout. */
  leakCause: FunnelLeakCause;
  /** Closed deals where the stocked unit strongly matched the buyer's wants (#199). */
  strongMatches: number;
  /** Total closed deals scored for inventory-buyer match (== units sold). */
  matchedSales: number;
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

/**
 * Inventory-buyer match-payoff line (#199): the share of today's closes where
 * the lot had what the buyer wanted. Null when nothing sold (nothing to tally).
 */
function matchTally(m: DayRecapModel): string | null {
  if (m.matchedSales <= 0) return null;
  return `${m.strongMatches} of ${m.matchedSales} ${
    m.matchedSales === 1 ? 'sale was a strong match' : 'sales were strong matches'
  } — you had what they wanted.`;
}

function leakCallout(m: DayRecapModel): string {
  const capacityDrop = Math.max(0, m.potentialTraffic - m.walkedIn);
  const engagementDrop = Math.max(0, m.walkedIn - m.staffEngaged);
  const closingDrop = Math.max(0, m.staffEngaged - m.sold);
  switch (m.leakCause) {
    case 'capacity':
      return `Biggest leak: ${capacityDrop} drove by with no room on the lot. Add staff or upgrade the facility to take more ups.`;
    case 'engagement':
      return `Biggest leak: ${engagementDrop} walked in but nobody worked them. You're leaving deals on the lot — get staff on the ups.`;
    case 'closing':
      return `Biggest leak: ${closingDrop} were engaged but didn't buy. The traffic's there — tighten the close.`;
    case 'none':
    default:
      return m.potentialTraffic <= 0
        ? 'No traffic today — nothing to recap.'
        : 'Clean funnel — no single stage leaked today.';
  }
}

interface FunnelRowProps {
  label: string;
  value: number;
  emphasis?: boolean;
}

function FunnelRow({ label, value, emphasis }: FunnelRowProps) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.funnelRow,
        { paddingVertical: t.spacing.sm, borderBottomColor: t.colors.surfaceRaised },
      ]}
    >
      <Text
        style={[
          t.typography.label,
          { color: emphasis ? t.colors.textPrimary : t.colors.textSecondary },
          emphasis && styles.emphasisWeight,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          t.typography.label,
          styles.tabular,
          { color: emphasis ? t.colors.textPrimary : t.colors.textSecondary },
          emphasis && styles.emphasisWeight,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The just-ended-day recap card: 4-level funnel + units/gross + one
 * plain-language biggest-leak callout. Read-only; smoke tests only. First
 * surface migrated onto the #225 token set + base-component kit.
 */
export function DayRecap({ model }: { model: DayRecapModel }) {
  const t = useTheme();
  const tally = matchTally(model);
  return (
    <Surface style={{ width: '100%', marginBottom: t.spacing.xxxl }}>
      <View style={{ marginBottom: t.spacing.lg }}>
        <SectionHeader title={`Day ${model.day} Recap`} />
      </View>

      <View style={{ marginBottom: t.spacing.lg }}>
        <FunnelRow label="Drove by" value={model.potentialTraffic} />
        <FunnelRow label="Walked in" value={model.walkedIn} />
        <FunnelRow label="Staff engaged" value={model.staffEngaged} />
        <FunnelRow label="Sold" value={model.sold} emphasis />
      </View>

      <View style={[styles.statRow, { marginBottom: t.spacing.lg }]}>
        <View style={styles.statCell}>
          <StatCard label="Units" value={model.sold} align="center" />
        </View>
        <View style={styles.statCell}>
          <StatCard label="Gross" value={money(model.gross)} align="center" />
        </View>
      </View>

      <Text style={[t.typography.body, styles.callout, { color: t.colors.textSecondary }]}>
        {leakCallout(model)}
      </Text>

      {tally != null && (
        <Text
          style={[
            t.typography.body,
            { color: t.colors.reward, fontWeight: '600', marginTop: t.spacing.sm },
          ]}
        >
          {tally}
        </Text>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  funnelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emphasisWeight: { fontWeight: '700' },
  tabular: { fontVariant: ['tabular-nums'] },
  statRow: { flexDirection: 'row' },
  statCell: { flex: 1 },
  callout: { fontStyle: 'italic' },
});
