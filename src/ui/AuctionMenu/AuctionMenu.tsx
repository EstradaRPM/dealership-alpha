import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import type { AuctionListing, LotVehicle } from '../../game/Inventory';

interface DetailModalProps {
  listing: AuctionListing;
  cash: number;
  onBuy: () => void;
  onClose: () => void;
}

function DetailModal({ listing, cash, onBuy, onClose }: DetailModalProps) {
  const canAfford = cash >= listing.askingPrice;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>
            {listing.year} {listing.make} {listing.model} {listing.trim}
          </Text>

          <View style={styles.conditionBadge}>
            <Text style={[styles.conditionText, conditionColor(listing.condition)]}>
              {listing.condition.toUpperCase()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mileage</Text>
            <Text style={styles.detailValue}>{listing.mileage.toLocaleString()} mi</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Asking Price</Text>
            <Text style={styles.detailValue}>${listing.askingPrice.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Est. Recon Cost</Text>
            <Text style={[styles.detailValue, styles.reconValue]}>
              ${listing.reconCost.toLocaleString()}
            </Text>
          </View>

          <View style={styles.reportBox}>
            <Text style={styles.reportLabel}>Condition Report</Text>
            <Text style={styles.reportText}>{listing.conditionReport}</Text>
          </View>

          <TouchableOpacity
            style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
            onPress={canAfford ? onBuy : undefined}
            disabled={!canAfford}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAfford }}
          >
            <Text style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDisabled]}>
              {canAfford ? `Buy for $${listing.askingPrice.toLocaleString()}` : 'Insufficient Funds'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function conditionColor(condition: AuctionListing['condition']) {
  switch (condition) {
    case 'clean':   return { color: '#4caf50' };
    case 'average': return { color: '#c8a96e' };
    case 'rough':   return { color: '#ef5350' };
  }
}

interface ListingRowProps {
  listing: AuctionListing;
  onPress: () => void;
}

function ListingRow({ listing, onPress }: ListingRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>
          {listing.year} {listing.make} {listing.model}
        </Text>
        <Text style={styles.rowSub}>
          {listing.trim} · {listing.mileage.toLocaleString()} mi
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowCondition, conditionColor(listing.condition)]}>
          {listing.condition}
        </Text>
        <Text style={styles.rowPrice}>${listing.askingPrice.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

export interface AuctionMenuProps {
  listings: readonly AuctionListing[];
  lotVehicles: readonly LotVehicle[];
  cash: number;
  onBuy: (listingId: string) => void;
  onClose: () => void;
}

export function AuctionMenu({ listings, lotVehicles, cash, onBuy, onClose }: AuctionMenuProps) {
  const [selected, setSelected] = useState<AuctionListing | null>(null);

  const handleBuy = () => {
    if (!selected) return;
    onBuy(selected.id);
    setSelected(null);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Auction Lane</Text>
          <Text style={styles.cashLabel}>Cash: ${cash.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {listings.length === 0 ? (
          <Text style={styles.empty}>No vehicles available today.</Text>
        ) : (
          listings.map((l) => (
            <ListingRow key={l.id} listing={l} onPress={() => setSelected(l)} />
          ))
        )}

        {lotVehicles.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Your Lot</Text>
            {lotVehicles.map((v) => (
              <View key={v.id} style={styles.lotRow}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>
                    {v.year} {v.make} {v.model}
                  </Text>
                  <Text style={styles.rowSub}>
                    {v.trim} · {v.mileage.toLocaleString()} mi
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.diiLabel}>{v.daysInInventory}d on lot</Text>
                  <Text style={styles.reconSmall}>Recon: ${v.reconCost.toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {selected && (
        <DetailModal
          listing={selected}
          cash={cash}
          onBuy={handleBuy}
          onClose={() => setSelected(null)}
        />
      )}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    marginRight: 12,
  },
  backText: {
    color: '#aaa',
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cashLabel: {
    color: '#4caf50',
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listInner: {
    padding: 16,
  },
  empty: {
    color: '#555',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  sectionHeader: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  lotRow: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#333',
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowCondition: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rowPrice: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  diiLabel: {
    color: '#c8a96e',
    fontSize: 12,
    fontWeight: '600',
  },
  reconSmall: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  // Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  modalClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 8,
  },
  modalCloseText: {
    color: '#666',
    fontSize: 18,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  conditionBadge: {
    marginBottom: 16,
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  detailLabel: {
    color: '#888',
    fontSize: 14,
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reconValue: {
    color: '#ef9a9a',
  },
  reportBox: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  reportLabel: {
    color: '#666',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  reportText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 19,
  },
  buyBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: '#1a1a1a',
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buyBtnTextDisabled: {
    color: '#444',
  },
});
