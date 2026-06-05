import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { CharacterProfile } from '../../game/CareerProgression';
import { loadTierConfig } from '../../game/CareerProgression';
import type { DayLoopState } from '../../game/DayLoopController';
import {
  FloorDashboard,
  type FloorDashboardModel,
  type FloorControls,
} from '../FloorDashboard';
import { DayRecap, type DayRecapModel } from '../DayRecap';
import { OwnershipLevers, type OwnershipLeversProps } from '../OwnershipLevers';
import { DemandReadout, type DemandReadoutModel } from '../DemandReadout';
import { colors } from '../theme';

const TIER_CONFIG = loadTierConfig();

interface Props {
  profile: CharacterProfile;
  state: DayLoopState;
  onNextDay: () => void;
  onOpenAuction?: () => void;
  businessName?: string;
  accentColor?: string;
  tier?: number;
  /** Day-to-day consequence readout on Home (#77). Absent ⇒ strip hidden. */
  cash?: number;
  /** Player-facing reputation (review score, 0–100) for the Home strip (#77). */
  reputation?: number;
  /** FLOOR-OPEN read-model (#116), assembled by the composition root. */
  floorModel?: FloorDashboardModel;
  /** Live-clock speed/pause controls (#121), wired by the composition root. */
  floorControls?: FloorControls;
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
  /**
   * Observed persona-mix readout (#198), assembled by the composition root from
   * `DemandShaper.getObservedMix()`. Shown on MANAGERIAL. Omitted ⇒ hidden.
   */
  demandReadout?: DemandReadoutModel;
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
  cash,
  reputation,
  floorModel,
  floorControls,
  onExceptionPress,
  onCherryPick,
  recap,
  leverProps,
  demandReadout,
}: Props) {
  if (state.phase === 'FLOOR_OPEN' && floorModel) {
    return (
      <FloorDashboard
        model={floorModel}
        controls={floorControls}
        onExceptionPress={onExceptionPress}
        onCherryPick={onCherryPick}
      />
    );
  }

  const tierEntry = TIER_CONFIG.tiers[tier - 1] ?? TIER_CONFIG.tiers[0];
  const displayName = businessName || `${profile.name}'s Lot`;
  const displayAccent = accentColor ?? colors.primary;

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
        {(cash != null || reputation != null) && (
          <View style={styles.statStrip}>
            {cash != null && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>CASH</Text>
                <Text style={styles.statValue}>
                  ${Math.round(cash).toLocaleString()}
                </Text>
              </View>
            )}
            {reputation != null && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>REPUTATION</Text>
                <Text style={styles.statValue}>{Math.round(reputation)}</Text>
              </View>
            )}
            <View style={styles.stat}>
              <Text style={styles.statLabel}>TIER</Text>
              <Text style={styles.statValue}>{tier}</Text>
            </View>
          </View>
        )}
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

        {state.phase === 'MANAGERIAL' && demandReadout && (
          <DemandReadout model={demandReadout} />
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
  root: { flex: 1, backgroundColor: colors.base },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  dealershipName: { fontSize: 22, fontWeight: '700' },
  tierLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statStrip: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 28,
  },
  stat: {},
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  phase: {
    fontSize: 13,
    color: colors.borderMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  recap: { fontSize: 17, color: colors.textSecondary, marginBottom: 28, textAlign: 'center' },
  floorOpen: { fontSize: 15, color: colors.textMuted, fontStyle: 'italic' },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: colors.base,
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
    backgroundColor: colors.primaryDim,
  },
  secondaryBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
