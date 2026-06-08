import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { loadTierConfig } from '../../game/CareerProgression';
import { KPIDashboard } from '../KPIDashboard';
import type { KPISnapshot } from '../../game/KPIDashboard';
import { colors } from '../theme';

const TIER_CONFIG = loadTierConfig();

/**
 * Pure read-model for the month-close interstitial (#123). The composition
 * root assembles this from `clock:month_ended` + the existing KPIDashboard
 * snapshot + CareerProgression tier data. Rich P&L / scorecard / awards /
 * narrative content is a deferred downstream slice — this slice only proves
 * the interrupt point + the assembly seam.
 */
export interface MonthCloseModel {
  /** 1-based month index that just closed (endingDay / daysPerMonth). */
  month: number;
  /** Player career tier — drives the chapter strip off CareerProgression. */
  tier: number;
  /** KPIDashboard snapshot — passed straight through, no reshaping here. */
  snapshot: KPISnapshot;
}

/**
 * MANAGERIAL interstitial shown on `clock:month_ended`, after the day-recap
 * and before next-day prep. A thin composition of existing modules
 * (CareerProgression chapter strip + KPIDashboard); it renders state and
 * dispatches only the dismiss action. Smoke tests only.
 */
export function MonthCloseInterstitial({
  model,
  onDismiss,
}: {
  model: MonthCloseModel;
  onDismiss: () => void;
}) {
  const tierEntry =
    TIER_CONFIG.tiers[model.tier - 1] ?? TIER_CONFIG.tiers[0];

  return (
    <Modal visible animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.chapter}>
            <Text style={styles.chapterLabel}>Month Closed</Text>
            <Text style={styles.chapterIllustration}>
              {tierEntry.illustration}
            </Text>
            <Text style={styles.chapterTitle}>Month {model.month}</Text>
            <Text style={styles.chapterCaption}>
              Tier {model.tier} — {tierEntry.label}
            </Text>
          </View>

          <ScrollView style={styles.kpi} contentContainerStyle={styles.kpiInner}>
            <KPIDashboard snapshot={model.snapshot} />
          </ScrollView>

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Continue to next day"
          >
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  chapter: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  chapterLabel: {
    fontSize: 11,
    color: colors.borderMuted,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chapterIllustration: { fontSize: 56, marginBottom: 8 },
  chapterTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  chapterCaption: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  kpi: { flex: 1 },
  kpiInner: { flexGrow: 1 },
  continueBtn: {
    margin: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.base,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
