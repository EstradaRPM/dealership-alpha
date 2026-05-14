import React from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity, ScrollView } from 'react-native';
import type { CharacterProfile } from '../../game/CareerProgression';
import { loadTierConfig } from '../../game/CareerProgression';
import type { DeptKey } from '../../game/DepartmentQueue';
import type { LotVehicle } from '../../game/Inventory';

const DEPARTMENTS: { key: DeptKey; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'service', label: 'Service' },
  { key: 'bdc', label: 'BDC' },
  { key: 'office', label: 'Office' },
  { key: 'lot', label: 'Lot' },
];

type DeptBadges = Record<DeptKey, number>;

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
}

const DEFAULT_BADGES: DeptBadges = { sales: 0, service: 0, bdc: 0, office: 0, lot: 0 };
const TIER_CONFIG = loadTierConfig();

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
      onPress={() => count > 0 && onPress?.(deptKey)}
      disabled={count === 0 || !onPress}
      {...panResponder.panHandlers}
    >
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
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
}: Props) {
  const tierEntry = TIER_CONFIG.tiers[tier - 1] ?? TIER_CONFIG.tiers[0];
  const displayName = businessName || `${profile.name}'s Lot`;
  const displayAccent = accentColor ?? '#c8a96e';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.dealershipName, { color: displayAccent }]}>{displayName}</Text>
        <Text style={styles.tierLabel}>Tier {tier} — {tierEntry.label}</Text>
      </View>

      {lotVehicles.length === 0 ? (
        <View style={styles.illustration} accessibilityLabel={`Tier ${tier} ${tierEntry.label} lot`}>
          <Text style={styles.illustrationPlaceholder}>{tierEntry.illustration}</Text>
          <Text style={styles.illustrationCaption}>{tierEntry.caption}</Text>
          {onOpenAuction && (
            <TouchableOpacity onPress={onOpenAuction} style={styles.auctionBtnCenter}>
              <Text style={styles.auctionBtnCenterText}>Visit Auction →</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.lotPanelWrapper}>
          <LotPanel vehicles={lotVehicles} onOpenAuction={onOpenAuction} />
        </View>
      )}

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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
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
  badge: {
    backgroundColor: '#c8a96e',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
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
