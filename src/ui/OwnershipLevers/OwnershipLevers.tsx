import React, { useState } from 'react';
import { colors } from '../theme';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export interface LeverVehicle {
  readonly id: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly trim: string;
  readonly suggestedRetail: number;
  readonly askingPrice: number;
  /** Days the unit has sat on the lot (#173). */
  readonly daysInInventory: number;
  /** Floorplan + carrying cost burned against the unit so far (#173). */
  readonly carryingCostToDate: number;
  /** The unit's current daily burn rate (#173). */
  readonly dailyCarryingCost: number;
  /** `true` once days-on-lot crosses the aged threshold (#173). */
  readonly aged: boolean;
}

export interface HoursOption {
  readonly id: string;
  readonly label: string;
  readonly ticksPerDay: number;
}

/** One selectable trade-acquisition policy (#172). */
export interface TradePolicyLeverOption {
  readonly id: string;
  readonly label: string;
  /** One-sentence description of the consequence, shown for the selection. */
  readonly blurb: string;
}

/** One selectable list-price strategy (#154). Same shape as trade policy. */
export interface PricingStrategyLeverOption {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
}

/** Reserved advertising campaign lever (#212). */
export interface AdvertisingLeverOption {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
}

export interface OwnershipLeversProps {
  /** ⇔ DayLoopState.ownershipUnlocked. All levers greyed + inert when false
   *  (#107 d11: levers greyed while the floor is live). */
  enabled: boolean;
  vehicles: readonly LeverVehicle[];
  onSetAskingPrice: (vehicleId: string, price: number) => void;
  /** Open the per-vehicle real-time pricing screen (#175). */
  onOpenPricing: (vehicleId: string) => void;
  /** Pricing-strategy lever (#154): options + current selection + setter. */
  pricingStrategyOptions: readonly PricingStrategyLeverOption[];
  pricingStrategyId: string;
  onSelectPricingStrategy: (id: string) => void;
  onOpenAuction: () => void;
  onOpenHiring: () => void;
  rosterCount: number;
  hoursOptions: readonly HoursOption[];
  hoursOfOpId: string;
  onSelectHours: (id: string) => void;
  /** Trade-policy lever (#172): options + current selection + setter. */
  tradePolicyOptions: readonly TradePolicyLeverOption[];
  tradePolicyId: string;
  onSelectTradePolicy: (id: string) => void;
  /** Advertising lever (#212): reserved campaign seam + setter. */
  advertisingOptions: readonly AdvertisingLeverOption[];
  advertisingCampaignId: string;
  onSelectAdvertisingCampaign: (id: string) => void;
}

const ACCENT = colors.primary;

function PriceRow({
  vehicle,
  enabled,
  onCommit,
  onOpen,
}: {
  vehicle: LeverVehicle;
  enabled: boolean;
  onCommit: (price: number) => void;
  onOpen: () => void;
}) {
  const [text, setText] = useState(String(vehicle.askingPrice));
  const commit = () => {
    const n = Number(text.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n)) onCommit(n);
    else setText(String(vehicle.askingPrice));
  };
  return (
    <View style={styles.priceRow}>
      <TouchableOpacity
        style={styles.priceInfo}
        onPress={onOpen}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={`Open pricing for ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      >
        <Text style={styles.vehName} numberOfLines={1}>
          {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
          {vehicle.aged ? <Text style={styles.agedFlag}>  AGED</Text> : null}
        </Text>
        <Text style={styles.vehSuggested}>
          Suggested ${vehicle.suggestedRetail.toLocaleString()}  ·  Tune ›
        </Text>
        <Text style={[styles.vehCarry, vehicle.aged && styles.vehCarryAged]}>
          {vehicle.daysInInventory}d on lot · carry $
          {vehicle.carryingCostToDate.toLocaleString()} · $
          {vehicle.dailyCarryingCost.toLocaleString()}/day
        </Text>
      </TouchableOpacity>
      <TextInput
        style={[styles.priceInput, !enabled && styles.inputDisabled]}
        value={text}
        editable={enabled}
        keyboardType="number-pad"
        onChangeText={setText}
        onEndEditing={commit}
        onBlur={commit}
        accessibilityLabel={`Asking price for ${vehicle.id}`}
      />
    </View>
  );
}

/**
 * MANAGERIAL pre-open ownership levers (#120, design #107 d11). Thin input
 * forms only — Pricing → Inventory, Stock/Auction → existing AuctionMenu,
 * Hiring → StaffOrg via PersonnelScreen, Hours-of-op → scaled ticksPerDay
 * (stored by the composition root; FloorSim feed is downstream), Advertising
 * → reserved DemandShaper influence seam (#212).
 */
export function OwnershipLevers({
  enabled,
  vehicles,
  onSetAskingPrice,
  onOpenPricing,
  pricingStrategyOptions,
  pricingStrategyId,
  onSelectPricingStrategy,
  onOpenAuction,
  onOpenHiring,
  rosterCount,
  hoursOptions,
  hoursOfOpId,
  onSelectHours,
  tradePolicyOptions,
  tradePolicyId,
  onSelectTradePolicy,
  advertisingOptions,
  advertisingCampaignId,
  onSelectAdvertisingCampaign,
}: OwnershipLeversProps) {
  const selectedPolicy =
    tradePolicyOptions.find((p) => p.id === tradePolicyId) ??
    tradePolicyOptions[0];
  const selectedStrategy =
    pricingStrategyOptions.find((p) => p.id === pricingStrategyId) ??
    pricingStrategyOptions[0];
  const selectedAdvertising =
    advertisingOptions.find((p) => p.id === advertisingCampaignId) ??
    advertisingOptions[0];
  return (
    <View
      style={styles.root}
      testID="ownership-levers"
    >
      <Text style={styles.heading}>Next-Day Prep</Text>
      {!enabled && (
        <Text style={styles.lockedNote}>Floor open — levers locked.</Text>
      )}

      <View style={[styles.card, !enabled && styles.cardDisabled]}>
        <Text style={styles.cardTitle}>Pricing</Text>
        <View style={styles.hoursRow}>
          {pricingStrategyOptions.map((o) => {
            const sel = o.id === pricingStrategyId;
            return (
              <TouchableOpacity
                key={o.id}
                style={[
                  styles.hoursOpt,
                  sel && styles.hoursOptSel,
                  !enabled && styles.btnDisabled,
                ]}
                disabled={!enabled}
                onPress={() => onSelectPricingStrategy(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.hoursOptText, sel && styles.hoursOptTextSel]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedStrategy && (
          <Text style={styles.policyBlurb}>{selectedStrategy.blurb}</Text>
        )}
        {vehicles.length === 0 ? (
          <Text style={styles.empty}>No vehicles on the lot.</Text>
        ) : (
          vehicles.map((v) => (
            <PriceRow
              key={v.id}
              vehicle={v}
              enabled={enabled}
              onCommit={(p) => onSetAskingPrice(v.id, p)}
              onOpen={() => onOpenPricing(v.id)}
            />
          ))
        )}
      </View>

      <View style={[styles.card, !enabled && styles.cardDisabled]}>
        <Text style={styles.cardTitle}>Stock / Auction</Text>
        <TouchableOpacity
          style={[styles.actionBtn, !enabled && styles.btnDisabled]}
          disabled={!enabled}
          onPress={onOpenAuction}
          accessibilityRole="button"
        >
          <Text style={styles.actionBtnText}>Visit Auction →</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, !enabled && styles.cardDisabled]}>
        <Text style={styles.cardTitle}>Hiring & Staff</Text>
        <Text style={styles.subtle}>{rosterCount} on payroll</Text>
        <TouchableOpacity
          style={[styles.actionBtn, !enabled && styles.btnDisabled]}
          disabled={!enabled}
          onPress={onOpenHiring}
          accessibilityRole="button"
        >
          <Text style={styles.actionBtnText}>Hire Staff →</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, !enabled && styles.cardDisabled]}>
        <Text style={styles.cardTitle}>Hours of Operation</Text>
        <View style={styles.hoursRow}>
          {hoursOptions.map((o) => {
            const sel = o.id === hoursOfOpId;
            return (
              <TouchableOpacity
                key={o.id}
                style={[
                  styles.hoursOpt,
                  sel && styles.hoursOptSel,
                  !enabled && styles.btnDisabled,
                ]}
                disabled={!enabled}
                onPress={() => onSelectHours(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.hoursOptText, sel && styles.hoursOptTextSel]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, !enabled && styles.cardDisabled]}>
        <Text style={styles.cardTitle}>Advertising</Text>
        <View style={styles.hoursRow}>
          {advertisingOptions.map((o) => {
            const sel = o.id === advertisingCampaignId;
            return (
              <TouchableOpacity
                key={o.id}
                style={[
                  styles.hoursOpt,
                  sel && styles.hoursOptSel,
                  !enabled && styles.btnDisabled,
                ]}
                disabled={!enabled}
                onPress={() => onSelectAdvertisingCampaign(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.hoursOptText, sel && styles.hoursOptTextSel]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedAdvertising && (
          <Text style={styles.policyBlurb}>{selectedAdvertising.blurb}</Text>
        )}
      </View>

      <View style={[styles.card, !enabled && styles.cardDisabled]}>
        <Text style={styles.cardTitle}>Trade Policy</Text>
        <View style={styles.hoursRow}>
          {tradePolicyOptions.map((o) => {
            const sel = o.id === tradePolicyId;
            return (
              <TouchableOpacity
                key={o.id}
                style={[
                  styles.hoursOpt,
                  sel && styles.hoursOptSel,
                  !enabled && styles.btnDisabled,
                ]}
                disabled={!enabled}
                onPress={() => onSelectTradePolicy(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.hoursOptText, sel && styles.hoursOptTextSel]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {selectedPolicy && (
          <Text style={styles.policyBlurb}>{selectedPolicy.blurb}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  heading: {
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  lockedNote: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  cardDisabled: { opacity: 0.45 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 8,
  },
  empty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  subtle: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  priceInfo: { flex: 1, paddingRight: 12 },
  vehName: { fontSize: 14, color: colors.textPrimary },
  vehSuggested: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  vehCarry: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  vehCarryAged: { color: colors.danger },
  agedFlag: { fontSize: 11, fontWeight: '700', color: colors.danger },
  priceInput: {
    width: 96,
    backgroundColor: colors.base,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: colors.textPrimary,
    fontSize: 14,
    textAlign: 'right',
  },
  inputDisabled: { color: colors.textMuted },
  actionBtn: {
    backgroundColor: colors.primaryDim,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  hoursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hoursOpt: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base,
  },
  hoursOptSel: { borderColor: ACCENT, backgroundColor: colors.primaryDim },
  hoursOptText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  hoursOptTextSel: { color: ACCENT },
  policyBlurb: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 10,
    lineHeight: 17,
  },
});
