import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type TextStyle,
} from 'react-native';
import type { LotOccupancy } from '../../game/Inventory';
import { useTheme } from '../theme';
import { Surface, SectionHeader, Badge, Button } from '../kit';
import { ChipRow } from '../DeptControls';
// The app chrome's floating bottom band is the shell's to describe; a pushed
// room clears the same band rather than guessing at a second number.
import { actionFooterClearance } from '../AppShell';

/**
 * One unit on the lot, as the Lot room shows it (#346). Same primitives the
 * pre-open levers used to render in Prep — days-on-lot and carrying cost are
 * the stock room's subject, not a pre-open policy.
 */
export interface LotRoomVehicle {
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

/** One selectable list-price strategy (#154). */
export interface LotPricingStrategyOption {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
}

export interface LotRoomProps {
  vehicles: readonly LotRoomVehicle[];
  /**
   * How full the lot is against its built spaces (#361). Straight off
   * `Inventory.getLotOccupancy()` — the room states the engine's numbers and
   * never counts the list itself, because a car in prep occupies a space just
   * like a car out front and only the engine holds that rule.
   */
  occupancy: LotOccupancy;
  onSetAskingPrice: (vehicleId: string, price: number) => void;
  /** Open the per-vehicle real-time pricing screen (#175). */
  onOpenPricing: (vehicleId: string) => void;
  pricingStrategyOptions: readonly LotPricingStrategyOption[];
  pricingStrategyId: string;
  onSelectPricingStrategy: (id: string) => void;
  /**
   * Standing auto-pricing policy active (#285, spine S13). True once a UCM is
   * on staff — the strategy then auto-prices incoming inventory to its
   * book↔market target. False ⇒ suggestion-only.
   */
  autoPricingActive: boolean;
  /** Sourcing: the auction lives in this room, not in Prep (locked IA §4). */
  onOpenAuction: () => void;
  onClose: () => void;
}

function StockRow({
  vehicle,
  onCommit,
  onOpen,
}: {
  vehicle: LotRoomVehicle;
  onCommit: (price: number) => void;
  onOpen: () => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  const [text, setText] = useState(String(vehicle.askingPrice));
  const commit = () => {
    const n = Number(text.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n)) onCommit(n);
    else setText(String(vehicle.askingPrice));
  };
  const carry: TextStyle = vehicle.aged
    ? { ...s.rowCarry, color: t.colors.danger }
    : s.rowCarry;
  return (
    <View style={s.stockRow} testID={`lot-stock-row-${vehicle.id}`}>
      <TouchableOpacity
        style={s.stockInfo}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open pricing for ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      >
        <View style={s.rowTitleLine}>
          <Text style={s.rowTitle} numberOfLines={1}>
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
          </Text>
          {vehicle.aged && (
            <Badge label="Sitting too long" tone="danger" variant="soft" />
          )}
        </View>
        <Text style={s.rowSuggested}>
          Suggested ${vehicle.suggestedRetail.toLocaleString()} · Tune ›
        </Text>
        <Text style={carry}>
          {vehicle.daysInInventory}d on lot · carry $
          {vehicle.carryingCostToDate.toLocaleString()} · $
          {vehicle.dailyCarryingCost.toLocaleString()}/day
        </Text>
      </TouchableOpacity>
      <TextInput
        style={s.priceInput}
        value={text}
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
 * The Lot room (#346, locked IA §4). The Lot owns the **whole stock pipeline as
 * one room** — the stock list with days-on-lot and carrying cost, the per-unit
 * pricing entry, the standing pricing strategy, and sourcing (the auction). It
 * replaces the generic empty-queue screen the Lot dock button used to open
 * while cars sat on the lot one tab away.
 *
 * Pure view: the composition root assembles the model and owns every write.
 */
/**
 * The lot's own sentence about how full it is (#361). Plain language, one line:
 * the two numbers first, then what they mean for buying. "Over by 1" is a real
 * state — a trade always lands, even past the cap — so it says so rather than
 * clamping to "full".
 */
function occupancyLine(occupancy: LotOccupancy): string {
  const { occupied, built, spacesOpen } = occupancy;
  const taken = `${occupied} of ${built} spaces taken`;
  if (occupied > built) {
    return `${taken} · over by ${occupied - built} — buying is frozen until you sell one`;
  }
  if (spacesOpen === 0) return `${taken} · no spaces open`;
  return `${taken} · ${spacesOpen} open`;
}

export function LotRoom({
  vehicles,
  occupancy,
  onSetAskingPrice,
  onOpenPricing,
  pricingStrategyOptions,
  pricingStrategyId,
  onSelectPricingStrategy,
  autoPricingActive,
  onOpenAuction,
  onClose,
}: LotRoomProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const selectedStrategy =
    pricingStrategyOptions.find((o) => o.id === pricingStrategyId) ??
    pricingStrategyOptions[0];
  const aging = vehicles.filter((v) => v.aged).length;

  return (
    <View style={s.root} testID="lot-room">
      <View style={s.header}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={s.backBtn}
        >
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Lot</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Surface testID="lot-stock-list">
          <SectionHeader title="Stock on the Lot" />
          <Text style={s.hint} testID="lot-occupancy">
            {occupancyLine(occupancy)}
          </Text>
          <Text style={s.hint}>
            {vehicles.length === 0
              ? 'Nothing in stock yet.'
              : `${vehicles.length} unit${vehicles.length === 1 ? '' : 's'}` +
                (aging > 0 ? ` · ${aging} sitting too long` : '')}
          </Text>
          {vehicles.length === 0 ? (
            <Text style={s.empty}>
              Buy something at the auction and it lands here.
            </Text>
          ) : (
            vehicles.map((v) => (
              <StockRow
                key={v.id}
                vehicle={v}
                onCommit={(price) => onSetAskingPrice(v.id, price)}
                onOpen={() => onOpenPricing(v.id)}
              />
            ))
          )}
        </Surface>

        <View style={s.region}>
          <Surface testID="lot-pricing-strategy">
            <SectionHeader title="Pricing Strategy" />
            <Text style={s.hint}>
              Where you list against book and market, before you tune a unit.
            </Text>
            <ChipRow
              options={pricingStrategyOptions.map((o) => ({
                id: o.id,
                label: o.label,
              }))}
              selectedId={pricingStrategyId}
              onSelect={onSelectPricingStrategy}
            />
            {selectedStrategy && (
              <Text style={s.blurb}>{selectedStrategy.blurb}</Text>
            )}
            <Text
              style={
                autoPricingActive
                  ? { ...s.status, color: t.colors.positive }
                  : { ...s.status, color: t.colors.textMuted }
              }
              testID="auto-pricing-status"
            >
              {autoPricingActive
                ? `Auto-pricing on — incoming inventory lists at your ${selectedStrategy?.label ?? 'chosen'} target. Override any unit above.`
                : 'Suggestion only — hire a Used-Car Manager to auto-price incoming inventory.'}
            </Text>
          </Surface>
        </View>

        <View style={s.region}>
          <Surface testID="lot-sourcing">
            <SectionHeader title="Buy Inventory" />
            <Text style={s.hint}>
              {occupancy.atCapacity
                ? 'No spaces open — sell a unit before you buy another.'
                : 'The wholesale auction — where the next unit on this lot comes from.'}
            </Text>
            <View style={s.actionRow}>
              <Button
                label="Go to the Auction"
                onPress={onOpenAuction}
                icon="gavel"
                testID="lot-auction-button"
              />
            </View>
          </Surface>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.base },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.borderMuted,
    },
    backBtn: { paddingRight: t.spacing.md, paddingVertical: t.spacing.xxs },
    backText: { ...t.typography.button, color: t.colors.accent },
    title: { ...t.typography.title, color: t.colors.textPrimary, flex: 1 },
    // Same bottom clearance the shell's tab content carries: the floating
    // playtest chip hovers over this band, and it used to land on a price
    // input (#346, audit P8).
    body: { padding: t.spacing.lg, paddingBottom: actionFooterClearance(t) },
    region: { marginTop: t.spacing.lg },
    hint: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
      marginBottom: t.spacing.xs,
    },
    empty: { ...t.typography.caption, color: t.colors.textMuted },
    blurb: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.sm,
    },
    status: { ...t.typography.caption, marginTop: t.spacing.xs },
    actionRow: { marginTop: t.spacing.sm, alignSelf: 'flex-start' },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.sm,
    },
    stockInfo: { flex: 1, paddingRight: t.spacing.md },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    rowTitle: { ...t.typography.body, color: t.colors.textPrimary, flexShrink: 1 },
    rowSuggested: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
    rowCarry: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
    priceInput: {
      width: 96,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.border,
      borderWidth: 1,
      borderRadius: t.radius.sm,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      color: t.colors.textPrimary,
      ...t.typography.body,
      textAlign: 'right',
    },
  });
}
