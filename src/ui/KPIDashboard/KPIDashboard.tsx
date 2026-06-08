import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type { KPISnapshot } from '../../game/KPIDashboard';
import { colors } from '../theme';

function fmt$(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function KPIRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function UnlockedState({ snapshot }: { snapshot: KPISnapshot }) {
  const hasDeals = snapshot.unitsRetailed > 0;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
      <Text style={styles.sectionHeader}>Performance KPIs</Text>

      <View style={styles.card}>
        <KPIRow
          label="Units Retailed"
          value={String(snapshot.unitsRetailed)}
        />
        <KPIRow
          label="PVR (Per Vehicle Retailed)"
          value={hasDeals ? fmt$(snapshot.pvr) : '—'}
        />
        <KPIRow
          label="F&I PPRU"
          value={hasDeals ? fmt$(snapshot.fniPpru) : '—'}
        />
      </View>

      <Text style={styles.sectionHeader}>Gross Averages</Text>

      <View style={styles.card}>
        <KPIRow
          label="Avg Front Gross"
          value={hasDeals ? fmt$(snapshot.avgFrontGross) : '—'}
        />
        <KPIRow
          label="Avg Back Gross"
          value={hasDeals ? fmt$(snapshot.avgBackGross) : '—'}
        />
      </View>

      <Text style={styles.sectionHeader}>Inventory</Text>

      <View style={styles.card}>
        <KPIRow
          label="Avg Days in Inventory"
          value={hasDeals ? `${Math.round(snapshot.avgDii)} days` : '—'}
        />
        <KPIRow
          label="Daily Carrying Cost"
          value={fmt$(snapshot.dailyCarryingCost)}
        />
      </View>
    </ScrollView>
  );
}

export interface KPIDashboardProps {
  snapshot: KPISnapshot;
  onClose?: () => void;
}

export function KPIDashboard({ snapshot, onClose }: KPIDashboardProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>KPI Dashboard</Text>
        {onClose ? (
          <TouchableOpacity
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close KPI dashboard"
            onPress={onClose}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <UnlockedState snapshot={snapshot} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  rowValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
