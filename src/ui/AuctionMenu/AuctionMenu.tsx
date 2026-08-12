import React, { useEffect, useReducer, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import type {
  AuctionListing,
  LotOccupancy,
  LotVehicle,
} from '../../game/Inventory';
import type { EventBus } from '../../game/EventBus';
import type { ConditionRead } from '../../game/StaffOrg';
import { colors } from '../theme';
// Every dollar figure on this screen is **exact** (issue 387): a bid, an asking
// price, an inspection fee and the recon estimate under them are the numbers the
// player commits cash against.
import { money, grouped } from '../kit';

export interface ListingValuation {
  readonly bookValue: number;
  readonly marketPrice: number;
}

/**
 * Player-visible retail range estimate per #161 — `bookValueFn` is the low
 * end of the band, `marketPriceFn` the high end. The asking price stays
 * precise (it's the listed number); the range is *judgment*, not arithmetic.
 */
export type ValuationFor = (vehicle: AuctionListing) => ListingValuation;
export type SourceLabelFor = (sourceId: string) => string;
/**
 * UCM condition read (#163). Returns `null` when no `used-car-manager` is on
 * staff — the auction board then hides the read row entirely (green-operator
 * difficulty, per #182's "no UCM = raw condition tag only").
 */
export type ConditionReadFor = (vehicle: AuctionListing) => ConditionRead | null;

function formatConfidence(c: number): string {
  if (c >= 0.75) return 'High';
  if (c >= 0.5) return 'Medium';
  if (c >= 0.25) return 'Low';
  return 'Very Low';
}

function formatRange(low: number, high: number): string {
  return `${money(low)}–${money(high)}`;
}

interface DetailModalProps {
  listing: AuctionListing;
  cash: number;
  /** #361: bidding is closed while the lot has no space for another unit. */
  atCapacity: boolean;
  valuation: ListingValuation;
  sourceLabel: string;
  conditionRead: ConditionRead | null;
  inspectionCost: number;
  onBuy: () => void;
  onRequestInspection: () => void;
  onClose: () => void;
}

function DetailModal({
  listing,
  cash,
  atCapacity,
  valuation,
  sourceLabel,
  conditionRead,
  inspectionCost,
  onBuy,
  onRequestInspection,
  onClose,
}: DetailModalProps) {
  const pending = listing.inspectionStatus === 'pending';
  const canAfford = cash >= listing.askingPrice && !pending && !atCapacity;
  const canInspect =
    listing.inspectionStatus === 'none' && cash >= inspectionCost;
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
            <Text style={styles.detailValue}>{grouped(listing.mileage)} mi</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Asking Price</Text>
            <Text style={styles.detailValue}>{money(listing.askingPrice)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Retail Range Est.</Text>
            <Text style={styles.detailValue}>
              {formatRange(valuation.bookValue, valuation.marketPrice)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Source</Text>
            <Text style={styles.detailValue}>{sourceLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Est. Recon Cost</Text>
            <Text style={[styles.detailValue, styles.reconValue]}>
              {money(listing.reconCost)}
            </Text>
          </View>
          {conditionRead && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>UCM Recon Read</Text>
              <Text style={styles.detailValue}>
                {formatRange(conditionRead.estimatedReconLow, conditionRead.estimatedReconHigh)}
                {'  '}
                <Text style={styles.confidenceText}>
                  ({formatConfidence(conditionRead.confidence)})
                </Text>
              </Text>
            </View>
          )}
          {listing.inspectionStatus === 'completed' && listing.inspectionResult && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Inspection Read</Text>
              <Text style={styles.detailValue}>
                {formatRange(
                  listing.inspectionResult.reconLow,
                  listing.inspectionResult.reconHigh,
                )}
              </Text>
            </View>
          )}
          {pending && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Inspection</Text>
              <Text style={styles.detailValue}>
                Pending — ready day {listing.inspectionAvailableDay}
              </Text>
            </View>
          )}

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
              {pending
                ? 'Inspection Pending'
                : atCapacity
                  ? 'No Spaces Open'
                  : canAfford
                    ? `Buy for ${money(listing.askingPrice)}`
                    : 'Insufficient Funds'}
            </Text>
          </TouchableOpacity>
          {listing.inspectionStatus === 'none' && (
            <TouchableOpacity
              style={[styles.inspectBtn, !canInspect && styles.inspectBtnDisabled]}
              onPress={canInspect ? onRequestInspection : undefined}
              disabled={!canInspect}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canInspect }}
            >
              <Text
                style={[
                  styles.inspectBtnText,
                  !canInspect && styles.inspectBtnTextDisabled,
                ]}
              >
                Request Inspection ({money(inspectionCost)})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

function conditionColor(condition: AuctionListing['condition']) {
  switch (condition) {
    case 'clean':   return { color: colors.positive };
    case 'average': return { color: colors.primary };
    case 'rough':   return { color: colors.danger };
  }
}

interface ListingRowProps {
  listing: AuctionListing;
  valuation: ListingValuation;
  sourceLabel: string;
  onPress: () => void;
}

function ListingRow({ listing, valuation, sourceLabel, onPress }: ListingRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>
          {listing.year} {listing.make} {listing.model}
        </Text>
        <Text style={styles.rowSub}>
          {listing.trim} · {grouped(listing.mileage)} mi
        </Text>
        <Text style={styles.rowSource}>{sourceLabel}</Text>
        {listing.inspectionStatus === 'pending' && (
          <Text style={styles.rowInspection}>Inspection pending</Text>
        )}
        {listing.inspectionStatus === 'completed' && (
          <Text style={styles.rowInspection}>Inspected</Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowCondition, conditionColor(listing.condition)]}>
          {listing.condition}
        </Text>
        <Text style={styles.rowPrice}>{money(listing.askingPrice)}</Text>
        <Text style={styles.rowRange}>
          {formatRange(valuation.bookValue, valuation.marketPrice)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export interface AuctionMenuProps {
  listings: readonly AuctionListing[];
  lotVehicles: readonly LotVehicle[];
  cash: number;
  /**
   * How full the lot is (#361, A2 R2). Straight off
   * `Inventory.getLotOccupancy()`. Spaces are the second thing the lane is
   * spending — at the cap the board still reads (you can study what you cannot
   * buy) but bidding is closed, because the engine would refuse the buy anyway
   * and a button that throws is not an offer.
   */
  lotOccupancy: LotOccupancy;
  /**
   * Live retail-range provider (slice #161). `bookValueFn` = low end of the
   * band, `marketPriceFn` = high end. Defaults to the listing's asking price
   * for both bounds so the smoke test renders without wiring the live engine.
   */
  valuationFor?: ValuationFor;
  /**
   * Resolves the source id stamped on each listing to its human label (e.g.
   * `manheim_digital` → "Manheim Digital"). Defaults to identity for tests.
   */
  sourceLabelFor?: SourceLabelFor;
  /**
   * Pre-purchase UCM condition read (#163). Returns null when no UCM is
   * hired — the modal then omits the read row entirely. Defaults to always
   * null so tests + no-UCM saves render unchanged.
   */
  conditionReadFor?: ConditionReadFor;
  /**
   * Bus for live re-render on `market:shock_started` / `market:shock_resolved`
   * (slice #161 AC). Optional — without it, the range stays computed from
   * the providers as of mount.
   */
  bus?: EventBus;
  /**
   * Inspection cost displayed on the "Request Inspection" button (#164).
   * Defaults to 0 → the button is rendered disabled if not wired (tests).
   */
  inspectionCost?: number;
  onBuy: (listingId: string) => void;
  /**
   * Pay for a pre-purchase inspection on this listing (#164). Optional —
   * tests without an Inventory wired can omit it; the button no-ops.
   */
  onRequestInspection?: (listingId: string) => void;
  onClose: () => void;
}

export function AuctionMenu({
  listings,
  lotVehicles,
  cash,
  lotOccupancy,
  valuationFor,
  sourceLabelFor,
  conditionReadFor,
  bus,
  inspectionCost = 0,
  onBuy,
  onRequestInspection,
  onClose,
}: AuctionMenuProps) {
  const [selected, setSelected] = useState<AuctionListing | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  // Re-render when active shocks change so the range visibly shifts with
  // segment heat (per #161 AC: "Range updates live as shocks change").
  useEffect(() => {
    if (!bus) return;
    bus.subscribe('market:shock_started', bump);
    bus.subscribe('market:shock_resolved', bump);
    return () => {
      bus.unsubscribe('market:shock_started', bump);
      bus.unsubscribe('market:shock_resolved', bump);
    };
  }, [bus]);

  const valuate: ValuationFor =
    valuationFor ?? ((l) => ({ bookValue: l.askingPrice, marketPrice: l.askingPrice }));
  const sourceName: SourceLabelFor = sourceLabelFor ?? ((id) => id);
  const readFor: ConditionReadFor = conditionReadFor ?? (() => null);

  const handleBuy = () => {
    if (!selected) return;
    onBuy(selected.id);
    setSelected(null);
  };
  const handleRequestInspection = () => {
    if (!selected || !onRequestInspection) return;
    onRequestInspection(selected.id);
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
          <Text style={styles.cashLabel}>Cash: {money(cash)}</Text>
          <Text
            style={
              lotOccupancy.atCapacity
                ? [styles.spacesLabel, styles.spacesLabelFull]
                : styles.spacesLabel
            }
            testID="auction-lot-occupancy"
          >
            Lot: {lotOccupancy.occupied} of {lotOccupancy.built} spaces
          </Text>
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {lotOccupancy.atCapacity && (
          <Text style={styles.closedBanner} testID="auction-bidding-closed">
            No spaces open — sell a unit before you buy another. Bidding is
            closed until you are back under {lotOccupancy.built} spaces.
          </Text>
        )}
        {listings.length === 0 ? (
          <Text style={styles.empty}>No vehicles available today.</Text>
        ) : (
          listings.map((l) => (
            <ListingRow
              key={l.id}
              listing={l}
              valuation={valuate(l)}
              sourceLabel={sourceName(l.sourceId)}
              onPress={() => setSelected(l)}
            />
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
                    {v.trim} · {grouped(v.mileage)} mi
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.diiLabel}>{v.daysInInventory}d on lot</Text>
                  <Text style={styles.reconSmall}>Recon: {money(v.reconCost)}</Text>
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
          atCapacity={lotOccupancy.atCapacity}
          valuation={valuate(selected)}
          sourceLabel={sourceName(selected.sourceId)}
          conditionRead={readFor(selected)}
          inspectionCost={inspectionCost}
          onBuy={handleBuy}
          onRequestInspection={handleRequestInspection}
          onClose={() => setSelected(null)}
        />
      )}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: 12,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  cashLabel: {
    color: colors.positive,
    fontSize: 13,
    marginTop: 2,
  },
  spacesLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  spacesLabelFull: {
    color: colors.danger,
  },
  closedBanner: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  list: {
    flex: 1,
  },
  listInner: {
    padding: 16,
  },
  empty: {
    color: colors.borderMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  lotRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.borderMuted,
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
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSource: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  rowRange: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  diiLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  reconSmall: {
    color: colors.borderMuted,
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
    backgroundColor: colors.surface,
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
    color: colors.borderMuted,
    fontSize: 18,
  },
  modalTitle: {
    color: colors.textPrimary,
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
    borderBottomColor: colors.surfaceRaised,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  reconValue: {
    color: colors.danger,
  },
  confidenceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  reportBox: {
    backgroundColor: colors.base,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  reportLabel: {
    color: colors.borderMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  reportText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  buyBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: colors.surface,
  },
  buyBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  buyBtnTextDisabled: {
    color: colors.border,
  },
  inspectBtn: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  inspectBtnDisabled: {
    backgroundColor: colors.surface,
  },
  inspectBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  inspectBtnTextDisabled: {
    color: colors.border,
  },
  rowInspection: {
    color: colors.primary,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
