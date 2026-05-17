import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FunnelLeakCause } from '../../game/CapacityManager';

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
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
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
  return (
    <View style={styles.funnelRow}>
      <Text style={[styles.funnelLabel, emphasis && styles.funnelLabelEmphasis]}>
        {label}
      </Text>
      <Text style={[styles.funnelValue, emphasis && styles.funnelValueEmphasis]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The just-ended-day recap card: 4-level funnel + units/gross + one
 * plain-language biggest-leak callout. Read-only; smoke tests only.
 */
export function DayRecap({ model }: { model: DayRecapModel }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Day {model.day} Recap</Text>

      <View style={styles.funnel}>
        <FunnelRow label="Drove by" value={model.potentialTraffic} />
        <FunnelRow label="Walked in" value={model.walkedIn} />
        <FunnelRow label="Staff engaged" value={model.staffEngaged} />
        <FunnelRow label="Sold" value={model.sold} emphasis />
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{model.sold}</Text>
          <Text style={styles.statLabel}>Units</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{money(model.gross)}</Text>
          <Text style={styles.statLabel}>Gross</Text>
        </View>
      </View>

      <Text style={styles.callout}>{leakCallout(model)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 20,
    marginBottom: 28,
  },
  title: {
    fontSize: 13,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  funnel: { marginBottom: 16 },
  funnelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  funnelLabel: { fontSize: 15, color: '#bbb' },
  funnelLabelEmphasis: { color: '#fff', fontWeight: '700' },
  funnelValue: { fontSize: 15, color: '#bbb', fontVariant: ['tabular-nums'] },
  funnelValueEmphasis: { color: '#fff', fontWeight: '700' },
  statRow: { flexDirection: 'row', marginTop: 4, marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, color: '#fff', fontWeight: '700' },
  statLabel: {
    fontSize: 12,
    color: '#777',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  callout: {
    fontSize: 14,
    color: '#d8c08a',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
