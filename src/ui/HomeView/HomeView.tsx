import React from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity, ScrollView, Modal, Animated } from 'react-native';
import type { CharacterProfile } from '../../game/CareerProgression';
import { loadTierConfig } from '../../game/CareerProgression';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { LotVehicle } from '../../game/Inventory';
import type { EventBus } from '../../game/EventBus';
import { loadHomeTints, getTint } from './tintConfig';
import type { TimeOfDay, Weather } from './tintConfig';
import { TintOverlay } from './TintOverlay';
import { ActivityMarquee } from './ActivityMarquee';

const DEPARTMENTS: { key: DeptKey; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'service', label: 'Service' },
  { key: 'bdc', label: 'BDC' },
  { key: 'office', label: 'Office' },
  { key: 'lot', label: 'Lot' },
];

type DeptBadges = Record<DeptKey, number>;

interface CloseEarlyCost {
  walkCount: number;
  reputationHit: number;
}

interface Props {
  profile: CharacterProfile;
  badges?: DeptBadges;
  onSwipeResolve?: (dept: DeptKey) => void;
  onDeptPress?: (dept: DeptKey) => void;
  lotVehicles?: readonly LotVehicle[];
  onOpenAuction?: () => void;
  tier?: number;
  businessName?: string;
  accentColor?: string;
  timeOfDay?: TimeOfDay;
  weather?: Weather;
  eventBus?: EventBus;
  closeEarlyCost?: CloseEarlyCost;
  onCloseEarly?: () => void;
  onEndDay?: () => void;
}

const DEFAULT_BADGES: DeptBadges = { sales: 0, service: 0, bdc: 0, office: 0, lot: 0 };
const TIER_CONFIG = loadTierConfig();
const TINTS_CONFIG = loadHomeTints();

function BadgePulseHalo() {
  const anim = React.useRef(new Animated.Value(0.2)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulseHalo, { opacity: anim }]}
    />
  );
}

function DeptItem({
  deptKey,
  label,
  count,
  onSwipe,
  onPress,
}: {
  deptKey: DeptKey;
  label: string;
  count: number;
  onSwipe?: (dept: DeptKey) => void;
  onPress?: (dept: DeptKey) => void;
}) {
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 10 && Math.abs(dy) < 20,
      onPanResponderRelease: (_, { dx }) => {
        if (Math.abs(dx) > 50 && count > 0 && onSwipe) {
          onSwipe(deptKey);
        }
      },
    })
  ).current;

  return (
    <TouchableOpacity
      style={styles.deptItem}
      onPress={() => onPress?.(deptKey)}
      disabled={!onPress}
      {...panResponder.panHandlers}
    >
      {count > 0 && (
        <View style={styles.badgeWrapper}>
          <BadgePulseHalo />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        </View>
      )}
      <Text style={styles.deptLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LotPanel({
  vehicles,
  onOpenAuction,
}: {
  vehicles: readonly LotVehicle[];
  onOpenAuction?: () => void;
}) {
  return (
    <View style={styles.lotPanel}>
      <View style={styles.lotPanelHeader}>
        <Text style={styles.lotPanelTitle}>On the Lot ({vehicles.length})</Text>
        <TouchableOpacity onPress={onOpenAuction} style={styles.auctionBtn}>
          <Text style={styles.auctionBtnText}>Auction →</Text>
        </TouchableOpacity>
      </View>
      {vehicles.length === 0 ? (
        <Text style={styles.lotEmptyText}>No vehicles. Head to the auction.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {vehicles.map((v) => (
            <View key={v.id} style={styles.vehicleCard}>
              <Text style={styles.vehicleCardTitle}>{v.year} {v.make}</Text>
              <Text style={styles.vehicleCardModel}>{v.model}</Text>
              <View style={styles.diiPill}>
                <Text style={styles.diiPillText}>{v.daysInInventory}d</Text>
              </View>
              <Text style={styles.reconLine}>Recon ${v.reconCost.toLocaleString()}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function HomeView({
  profile,
  badges = DEFAULT_BADGES,
  onSwipeResolve,
  onDeptPress,
  lotVehicles = [],
  onOpenAuction,
  tier = 1,
  businessName,
  accentColor,
  timeOfDay = 'midday',
  weather = 'clear',
  eventBus,
  closeEarlyCost,
  onCloseEarly,
  onEndDay,
}: Props) {
  const tierEntry = TIER_CONFIG.tiers[tier - 1] ?? TIER_CONFIG.tiers[0];
  const displayName = businessName || `${profile.name}'s Lot`;
  const displayAccent = accentColor ?? '#c8a96e';
  const tint = getTint(TINTS_CONFIG, timeOfDay, weather);
  const [showCloseEarlyModal, setShowCloseEarlyModal] = React.useState(false);

  function handleCloseEarlyConfirm() {
    setShowCloseEarlyModal(false);
    onCloseEarly?.();
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.dealershipName, { color: displayAccent }]}>{displayName}</Text>
          <Text style={styles.tierLabel}>Tier {tier} — {tierEntry.label}</Text>
        </View>
        <View style={styles.dayControls}>
          {onCloseEarly && (
            <TouchableOpacity
              style={styles.closeEarlyBtn}
              onPress={() => setShowCloseEarlyModal(true)}
              accessibilityLabel="Close early"
            >
              <Text style={styles.closeEarlyBtnText}>Close Early</Text>
            </TouchableOpacity>
          )}
          {onEndDay && (
            <TouchableOpacity
              style={styles.endDayBtn}
              onPress={onEndDay}
              accessibilityLabel="End day"
            >
              <Text style={styles.endDayBtnText}>End Day</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={showCloseEarlyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCloseEarlyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Close Early?</Text>
            {closeEarlyCost && closeEarlyCost.walkCount > 0 ? (
              <Text style={styles.modalBody}>
                {closeEarlyCost.walkCount} customer{closeEarlyCost.walkCount !== 1 ? 's' : ''} will walk.{'\n'}
                Reputation hit: −{closeEarlyCost.reputationHit} pts
              </Text>
            ) : (
              <Text style={styles.modalBody}>No customers currently waiting. Day will advance to overnight.</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCloseEarlyModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleCloseEarlyConfirm}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {lotVehicles.length === 0 ? (
        <View style={styles.illustration} accessibilityLabel={`Tier ${tier} ${tierEntry.label} lot`}>
          <Text style={styles.illustrationPlaceholder}>{tierEntry.illustration}</Text>
          <Text style={styles.illustrationCaption}>{tierEntry.caption}</Text>
          {onOpenAuction && (
            <TouchableOpacity onPress={onOpenAuction} style={styles.auctionBtnCenter}>
              <Text style={styles.auctionBtnCenterText}>Visit Auction →</Text>
            </TouchableOpacity>
          )}
          <TintOverlay color={tint.color} opacity={tint.opacity} />
        </View>
      ) : (
        <View style={styles.lotPanelWrapper}>
          <LotPanel vehicles={lotVehicles} onOpenAuction={onOpenAuction} />
          <TintOverlay color={tint.color} opacity={tint.opacity} />
        </View>
      )}

      <ActivityMarquee eventBus={eventBus} />

      <View style={styles.statusBar}>
        {DEPARTMENTS.map(({ key, label }) => (
          <DeptItem
            key={key}
            deptKey={key}
            label={label}
            count={badges[key]}
            onSwipe={onSwipeResolve}
            onPress={onDeptPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  dealershipName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  tierLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  closeEarlyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  closeEarlyBtnText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  endDayBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#c8a96e',
  },
  endDayBtnText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    padding: 24,
    width: 300,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirm: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#8b2222',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationPlaceholder: {
    fontSize: 80,
    marginBottom: 12,
  },
  illustrationCaption: {
    fontSize: 15,
    color: '#555',
    fontStyle: 'italic',
  },
  statusBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#161616',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  deptItem: {
    flex: 1,
    alignItems: 'center',
  },
  deptLabel: {
    fontSize: 11,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    minWidth: 22,
    height: 22,
  },
  pulseHalo: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#c8a96e',
  },
  badge: {
    backgroundColor: '#c8a96e',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111',
  },
  lotPanelWrapper: {
    flex: 1,
  },
  lotPanel: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  lotPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lotPanelTitle: {
    color: '#aaa',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  auctionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#1e3a5f',
  },
  auctionBtnText: {
    color: '#4a9eff',
    fontSize: 13,
    fontWeight: '600',
  },
  vehicleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginRight: 10,
    width: 130,
  },
  vehicleCardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  vehicleCardModel: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  diiPill: {
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  diiPillText: {
    color: '#c8a96e',
    fontSize: 11,
    fontWeight: '700',
  },
  reconLine: {
    color: '#666',
    fontSize: 11,
  },
  auctionBtnCenter: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#1e3a5f',
  },
  auctionBtnCenterText: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '600',
  },
  lotEmptyText: {
    color: '#555',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
