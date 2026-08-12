import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FunnelLeakCause } from '../../game/CapacityManager';
import { useTheme } from '../theme';
/**
 * The recap's gross is **compact** (issue 387) — an ambient close-of-day
 * reading, stated the same way the Reveal scoreline directly above it states
 * the same window.
 */
import { Surface, SectionHeader, StatCard, IconBadge, compactMoney } from '../kit';
import { Reveal, type RevealModel } from '../Reveal';

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
  /** The Reveal scoreline + starred reactions for this day (#319). */
  reveal: RevealModel;
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
 * The just-ended-day recap card: the Reveal scoreline (#319) framing the day
 * as a plain-language verdict, then the funnel/units/gross breakdown as
 * supporting detail plus the biggest-leak callout. Read-only; smoke tests
 * only. First surface migrated onto the #225 token set + base-component kit.
 */
export function DayRecap({ model }: { model: DayRecapModel }) {
  const t = useTheme();
  return (
    <Surface style={{ width: '100%', marginBottom: t.spacing.xxxl }}>
      <View style={[styles.headerRow, { marginBottom: t.spacing.lg, gap: t.spacing.md }]}>
        <IconBadge name="calendar" tone="primary" shape="rounded" />
        <SectionHeader title={`Day ${model.day} Recap`} />
      </View>

      <View style={{ marginBottom: t.spacing.lg }}>
        <Reveal model={model.reveal} />
      </View>

      <View style={{ marginBottom: t.spacing.lg }}>
        <FunnelRow label="Drove by" value={model.potentialTraffic} />
        <FunnelRow label="Walked in" value={model.walkedIn} />
        <FunnelRow label="Staff engaged" value={model.staffEngaged} />
        <FunnelRow label="Sold" value={model.sold} emphasis />
      </View>

      <View style={[styles.statRow, { marginBottom: t.spacing.lg }]}>
        <View style={styles.statCell}>
          <StatCard label="Units" value={model.sold} align="center" icon="car-sport" iconTone="primary" />
        </View>
        <View style={styles.statCell}>
          <StatCard
            label="Gross"
            value={compactMoney(model.gross)}
            align="center"
            icon="cash"
            iconTone="reward"
          />
        </View>
      </View>

      <Text style={[t.typography.body, styles.callout, { color: t.colors.textSecondary }]}>
        {leakCallout(model)}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  funnelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  emphasisWeight: { fontWeight: '700' },
  tabular: { fontVariant: ['tabular-nums'] },
  statRow: { flexDirection: 'row' },
  statCell: { flex: 1 },
  callout: { fontStyle: 'italic' },
});
