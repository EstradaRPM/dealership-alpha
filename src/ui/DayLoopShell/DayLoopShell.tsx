import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
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

export interface ManagerDeskAlertModel {
  id: string;
  title: string;
  body?: string;
  severity?: 'info' | 'warning' | 'critical';
  actionLabel?: string;
  onPress?: () => void;
}

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
  /**
   * Non-blocking manager summaries for issues that need attention but do not
   * interrupt the day boundary. Must-answer beats stay in overlay components.
   */
  managerAlerts?: readonly ManagerDeskAlertModel[];
}

/**
 * Thin DayLoopController-driven shell (#114 cut). The rich FLOOR-OPEN
 * dashboard (#116) and hand-play modal (#118) are later slices — this only
 * proves the composed day boots, runs end-to-end through the injected seams,
 * and returns to MANAGERIAL.
 *
 * Manager Desk region rules live in docs/manager-desk-shell-contract.md.
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
  managerAlerts = [],
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
  const primaryActionLabel = state.hasRecap ? 'Next Day' : 'Open Floor';
  const hasManagerAlerts = managerAlerts.length > 0;

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

      {state.phase === 'MANAGERIAL' ? (
        <View style={styles.managerDesk}>
          <ScrollView
            style={styles.managerScroll}
            contentContainerStyle={styles.managerContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.deskTitleRow}>
              <View>
                <Text style={styles.phase}>Manager Desk</Text>
                <Text style={styles.deskSubhead}>
                  Between-day plan for Day {state.day}
                </Text>
              </View>
              <Text style={styles.phaseBadge}>MANAGERIAL</Text>
            </View>

            <View
              style={styles.region}
              accessibilityLabel="Manager Desk Today region"
              testID="manager-desk-region-today"
            >
              <Text style={styles.regionTitle}>Today</Text>
              {showRecap && recap ? (
                <DayRecap model={recap} />
              ) : (
                <Text style={styles.recap}>Night before Day 1.</Text>
              )}
            </View>

            <View
              style={styles.region}
              accessibilityLabel="Manager Desk Market region"
              testID="manager-desk-region-market"
            >
              <Text style={styles.regionTitle}>Market</Text>
              {demandReadout ? (
                <DemandReadout model={demandReadout} />
              ) : (
                <Text style={styles.placeholder}>
                  Open the lot to build the demand readout.
                </Text>
              )}
            </View>

            <View
              style={styles.region}
              accessibilityLabel="Manager Desk Prep region"
              testID="manager-desk-region-prep"
            >
              <Text style={styles.regionTitle}>Prep</Text>
              {leverProps ? (
                <OwnershipLevers {...leverProps} />
              ) : onOpenAuction ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={onOpenAuction}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryBtnText}>Visit Auction →</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.placeholder}>
                  Prep levers will mount here as they unlock.
                </Text>
              )}
            </View>

            <View
              style={[styles.region, !hasManagerAlerts && styles.compactRegion]}
              accessibilityLabel="Manager Desk Alerts region"
              testID="manager-desk-region-alerts"
            >
              <View style={styles.regionHeaderRow}>
                <Text style={styles.regionTitle}>Alerts</Text>
                {!hasManagerAlerts && (
                  <Text style={styles.clearBadge}>Clear</Text>
                )}
              </View>
              {hasManagerAlerts ? (
                <View style={styles.alertList}>
                  {managerAlerts.map((alert) => {
                    const content = (
                      <>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                        {alert.body ? (
                          <Text style={styles.alertBody}>{alert.body}</Text>
                        ) : null}
                        {alert.actionLabel ? (
                          <Text style={styles.alertAction}>
                            {alert.actionLabel} →
                          </Text>
                        ) : null}
                      </>
                    );
                    return alert.onPress ? (
                      <TouchableOpacity
                        key={alert.id}
                        style={[
                          styles.alertRow,
                          alert.severity === 'critical' && styles.alertCritical,
                          alert.severity === 'warning' && styles.alertWarning,
                        ]}
                        onPress={alert.onPress}
                        accessibilityRole="button"
                      >
                        {content}
                      </TouchableOpacity>
                    ) : (
                      <View
                        key={alert.id}
                        style={[
                          styles.alertRow,
                          alert.severity === 'critical' && styles.alertCritical,
                          alert.severity === 'warning' && styles.alertWarning,
                        ]}
                      >
                        {content}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.compactPlaceholder}>No manager alerts.</Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.actionFooter}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: displayAccent }]}
              onPress={onNextDay}
              accessibilityRole="button"
              accessibilityLabel={primaryActionLabel}
            >
              <Text style={styles.primaryBtnText}>{primaryActionLabel} →</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.floorOpen}>Floor open — running the day…</Text>
        </View>
      )}
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
  managerDesk: { flex: 1 },
  managerScroll: { flex: 1 },
  managerContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  deskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    paddingBottom: 12,
  },
  phase: {
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  deskSubhead: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 4,
  },
  phaseBadge: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.primaryDim,
  },
  region: {
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  regionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  compactRegion: { paddingVertical: 10 },
  regionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  clearBadge: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  recap: { fontSize: 15, color: colors.textSecondary },
  placeholder: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  compactPlaceholder: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: -4,
  },
  alertList: { gap: 8 },
  alertRow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  alertWarning: { borderLeftColor: colors.reward },
  alertCritical: { borderLeftColor: colors.danger },
  alertTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  alertBody: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  alertAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  floorOpen: { fontSize: 15, color: colors.textMuted, fontStyle: 'italic' },
  actionFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
    backgroundColor: colors.base,
  },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: colors.primaryDim,
  },
  secondaryBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
