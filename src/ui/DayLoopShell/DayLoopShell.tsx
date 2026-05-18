import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { CharacterProfile } from '../../game/CareerProgression';
import { loadTierConfig } from '../../game/CareerProgression';
import type { DayLoopState } from '../../game/DayLoopController';
import { FloorDashboard, type FloorDashboardModel } from '../FloorDashboard';
import { DayRecap, type DayRecapModel } from '../DayRecap';
import { OwnershipLevers, type OwnershipLeversProps } from '../OwnershipLevers';

const TIER_CONFIG = loadTierConfig();

interface Props {
  profile: CharacterProfile;
  state: DayLoopState;
  onNextDay: () => void;
  onOpenAuction?: () => void;
  businessName?: string;
  accentColor?: string;
  tier?: number;
  /** FLOOR-OPEN read-model (#116), assembled by the composition root. */
  floorModel?: FloorDashboardModel;
  /** Tapped a forced-exception alert row → open the hand-play modal (#118). */
  onExceptionPress?: (customerId: string) => void;
  /** Voluntary cherry-pick → open the hand-play modal (#118). */
  onCherryPick?: () => void;
  /**
   * Just-ended-day recap read-model (#119), assembled by the composition
   * root from the #110 funnel accessor. Absent on the night before Day 1.
   */
  recap?: DayRecapModel;
  /**
   * MANAGERIAL pre-open ownership levers (#120), assembled by the
   * composition root. Omitted ⇒ no lever panel (the pre-#120 shell).
   */
  leverProps?: OwnershipLeversProps;
}

/**
 * Thin DayLoopController-driven shell (#114 cut). The rich FLOOR-OPEN
 * dashboard (#116) and hand-play modal (#118) are later slices — this only
 * proves the composed day boots, runs end-to-end through the injected seams,
 * and returns to MANAGERIAL.
 */
export function DayLoopShell({
  profile,
  state,
  onNextDay,
  onOpenAuction,
  businessName,
  accentColor,
  tier = 1,
  floorModel,
  onExceptionPress,
  onCherryPick,
  recap,
  leverProps,
}: Props) {
  if (state.phase === 'FLOOR_OPEN' && floorModel) {
    return (
      <FloorDashboard
        model={floorModel}
        onExceptionPress={onExceptionPress}
        onCherryPick={onCherryPick}
      />
    );
  }

  const tierEntry = TIER_CONFIG.tiers[tier - 1] ?? TIER_CONFIG.tiers[0];
  const displayName = businessName || `${profile.name}'s Lot`;
  const displayAccent = accentColor ?? '#c8a96e';

  const showRecap = state.phase === 'MANAGERIAL' && state.hasRecap && !!recap;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.dealershipName, { color: displayAccent }]}>
          {displayName}
        </Text>
        <Text style={styles.tierLabel}>
          Tier {tier} — {tierEntry.label}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.phase}>{state.phase}</Text>

        {showRecap && recap ? (
          <DayRecap model={recap} />
        ) : (
          state.phase === 'MANAGERIAL' && (
            <Text style={styles.recap}>Night before Day 1.</Text>
          )
        )}

        {state.phase === 'MANAGERIAL' ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: displayAccent }]}
            onPress={onNextDay}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <Text style={styles.primaryBtnText}>Next Day →</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.floorOpen}>Floor open — running the day…</Text>
        )}

        {state.phase === 'MANAGERIAL' &&
          (leverProps ? (
            <OwnershipLevers {...leverProps} />
          ) : (
            onOpenAuction && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onOpenAuction}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>Visit Auction →</Text>
              </TouchableOpacity>
            )
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  dealershipName: { fontSize: 22, fontWeight: '700' },
  tierLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  phase: {
    fontSize: 13,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  recap: { fontSize: 17, color: '#ccc', marginBottom: 28, textAlign: 'center' },
  floorOpen: { fontSize: 15, color: '#888', fontStyle: 'italic' },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#1e3a5f',
  },
  secondaryBtnText: { color: '#4a9eff', fontSize: 15, fontWeight: '600' },
});
