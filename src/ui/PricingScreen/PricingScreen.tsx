import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { colors } from '../theme';
import { money, HintLine } from '../kit';
import type { PricePosition, IntelPrecision } from '../../game/MarketEconomy';

/** Static per-vehicle facts the screen renders. The vehicle doesn't change
 *  while the screen is open, so these are computed once by the composition
 *  root; only the ask (and everything derived from it) moves live. */
export interface PricingScreenVehicle {
  readonly id: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly trim: string;
  /** Honest book + market from the live providers (#155–#157). */
  readonly bookValue: number;
  readonly marketPrice: number;
  /** Cost basis (`purchasePrice + reconCost`) for the projected-gross math. */
  readonly vehicleCost: number;
  readonly initialAskingPrice: number;
  readonly daysInInventory: number;
  readonly carryingCostToDate: number;
  /** Current per-day carrying burn — the projected carry rate (#173). */
  readonly dailyCarryingCost: number;
  readonly aged: boolean;
  readonly agedThresholdDays: number;
}

/** One competitor's comparable asking price (derived once; static vs. the ask). */
export interface PricingScreenComp {
  readonly id: string;
  readonly name: string;
  readonly pricePoint: string;
  readonly price: number;
}

/** Staff-suggested list price + its provenance (#154). */
export interface PricingScreenSuggestion {
  readonly price: number;
  readonly source: 'ucm' | 'heuristic';
  /** UCM `pricing` skill 0–100, present only when a UCM is on staff. */
  readonly pricingSkill?: number;
  /** Human label for the active strategy ("Market", "Aggressive", "Value"). */
  readonly strategyLabel: string;
}

export interface PricingScreenProps {
  vehicle: PricingScreenVehicle;
  comps: readonly PricingScreenComp[];
  suggestion: PricingScreenSuggestion;
  /**
   * Pricing-intel precision (#284): how sharp the read is. Coarse (no UCM)
   * widens the suggested-price band + days-to-sell range and caps confidence;
   * sharp (UCM on staff) tightens them toward pinpoint as skill rises.
   */
  precision: IntelPrecision;
  /** Live days-to-sell predictor for an ask (delegates to MarketEconomy #174). */
  predictDays: (askingPrice: number) => { expectedDays: number; confidence: number };
  /** Live market-position classifier for an ask (MarketEconomy bands). */
  classifyPosition: (askingPrice: number) => PricePosition;
  /** False while the floor is live — the screen is read-only then. */
  enabled: boolean;
  /** Persist the chosen ask (Inventory.setAskingPrice). */
  onCommit: (price: number) => void;
  /**
   * What moving this one car's price costs and buys (#388), null once used.
   * Same catalog entry the Lot room's stock list draws — one lesson, two
   * places, retired once.
   */
  askingPriceHint?: string | null;
  onClose: () => void;
}

const STEP = 50;

const POSITION_META: Record<PricePosition, { label: string; color: string }> = {
  'fire-sale': { label: 'Fire sale', color: colors.danger },
  'below-market': { label: 'Below market', color: colors.primary },
  'at-market': { label: 'At market', color: colors.positive },
  'above-market': { label: 'Above market', color: colors.reward },
  wishful: { label: 'Wishful', color: colors.danger },
};

/**
 * Every figure on this screen is **exact** (issue 387) — an asking price is the
 * transaction anchor the player is setting, and the band around it is what they
 * are setting it against.
 */

/**
 * Surface a point estimate as a precision-scaled band. A wide `pct` (coarse, no
 * UCM) reads as a broad guess; a tight `pct` (sharp UCM) collapses toward the
 * point. Returns a single string when both edges round to the same display unit.
 */
function bandText(
  value: number,
  pct: number,
  fmt: (n: number) => string,
  round: (n: number) => number,
): string {
  const lo = round(value * (1 - pct));
  const hi = round(value * (1 + pct));
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
}

function clampStep(v: number, min: number, max: number): number {
  const stepped = Math.round(v / STEP) * STEP;
  return Math.min(max, Math.max(min, stepped));
}

/**
 * Lightweight drag slider built on `PanResponder` (RN core — no slider lib).
 * Relative-drag model: each gesture starts from the current value and tracks
 * finger `dx` against the measured track width, so it works whether the player
 * grabs the thumb or anywhere along the bar. Live-updates the parent on every
 * move; commits once on release.
 */
function PriceSlider({
  min,
  max,
  value,
  enabled,
  onChange,
  onCommit,
  bookPos,
  marketPos,
}: {
  min: number;
  max: number;
  value: number;
  enabled: boolean;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  /** Book/market fractions in [0,1] for the band rendered behind the track. */
  bookPos: number;
  marketPos: number;
}) {
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const startRef = useRef(value);
  // Latest callbacks/flags via refs so the once-created responder never goes stale.
  const cb = useRef({ onChange, onCommit, enabled, min, max });
  cb.current = { onChange, onCommit, enabled, min, max };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => cb.current.enabled,
      onMoveShouldSetPanResponder: () => cb.current.enabled,
      onPanResponderGrant: () => {
        startRef.current = valueRef.current;
      },
      onPanResponderMove: (_evt, g) => {
        const w = widthRef.current;
        if (w <= 0) return;
        const { min: lo, max: hi, onChange: oc } = cb.current;
        const delta = (g.dx / w) * (hi - lo);
        oc(clampStep(startRef.current + delta, lo, hi));
      },
      onPanResponderRelease: () => cb.current.onCommit(valueRef.current),
      onPanResponderTerminate: () => cb.current.onCommit(valueRef.current),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };
  const frac = max > min ? (value - min) / (max - min) : 0;
  const bandLeft = Math.min(bookPos, marketPos);
  const bandWidth = Math.abs(marketPos - bookPos);

  return (
    <View style={styles.sliderWrap}>
      <View
        style={styles.track}
        onLayout={onLayout}
        {...responder.panHandlers}
        testID="pricing-ask-slider"
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}
      >
        {/* Market band rendered behind the thumb: book → market range. */}
        <View
          style={[
            styles.band,
            { left: `${bandLeft * 100}%`, width: `${bandWidth * 100}%` },
          ]}
        />
        <View style={[styles.fill, { width: `${frac * 100}%` }]} />
        <View style={[styles.thumb, { left: `${frac * 100}%` }]} />
      </View>
      <View style={styles.tickRow}>
        <Text style={[styles.tick, { left: `${bookPos * 100}%` }]}>book</Text>
        <Text style={[styles.tick, { left: `${marketPos * 100}%` }]}>market</Text>
      </View>
    </View>
  );
}

/**
 * Per-vehicle real-time pricing screen (#175, absorbing #154). The
 * lemonade-stand slider applied to used cars: drag the ask and watch market
 * position, predicted days-to-sell, projected gross net of carry, competitor
 * comparables, and the staff suggestion react live. Purely presentational —
 * all numbers arrive as props/callbacks from the composition root; the screen
 * holds only the in-flight ask and commits it on release.
 */
export function PricingScreen({
  vehicle,
  comps,
  suggestion,
  precision,
  predictDays,
  classifyPosition,
  enabled,
  onCommit,
  askingPriceHint,
  onClose,
}: PricingScreenProps) {
  const { min, max } = useMemo(() => {
    const lo = clampStep(
      Math.min(vehicle.bookValue * 0.9, vehicle.marketPrice * 0.8),
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const hi = clampStep(
      vehicle.marketPrice * 1.3,
      lo + STEP,
      Number.MAX_SAFE_INTEGER,
    );
    return { min: lo, max: hi };
  }, [vehicle.bookValue, vehicle.marketPrice]);

  const [ask, setAsk] = useState(() => clampStep(vehicle.initialAskingPrice, min, max));

  const posFor = (v: number) => (max > min ? (v - min) / (max - min) : 0);
  const prediction = predictDays(ask);
  // Intel precision (#284): coarse caps confidence and widens the days/price
  // bands; sharp (UCM) tightens both and lifts confidence toward the raw model.
  const shownConfidence = prediction.confidence * precision.confidenceScale;
  const daysText = bandText(
    prediction.expectedDays,
    precision.daysRangePct,
    (n) => `${n}`,
    Math.round,
  );
  const suggestionText = bandText(
    suggestion.price,
    precision.suggestionBandPct,
    money,
    (n) => clampStep(n, 0, Number.MAX_SAFE_INTEGER),
  );
  const position = classifyPosition(ask);
  const posMeta = POSITION_META[position];
  const projectedGross =
    ask - vehicle.vehicleCost - vehicle.dailyCarryingCost * prediction.expectedDays;
  const grossPositive = projectedGross >= 0;

  const applySuggestion = () => {
    const v = clampStep(suggestion.price, min, max);
    setAsk(v);
    onCommit(v);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          testID="pricing-close"
          accessibilityRole="button"
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        testID="pricing-screen"
        keyboardShouldPersistTaps="handled"
      >
        {!enabled && (
          <Text style={styles.lockedNote}>Floor open — pricing locked.</Text>
        )}

        {/* Ask readout + position chip */}
        <View style={styles.askBlock}>
          <Text style={styles.askLabel}>Asking price</Text>
          <Text style={styles.askValue}>{money(ask)}</Text>
          <View style={[styles.posChip, { borderColor: posMeta.color }]}>
            <Text style={[styles.posChipText, { color: posMeta.color }]}>
              {posMeta.label}
            </Text>
          </View>
        </View>

        <PriceSlider
          min={min}
          max={max}
          value={ask}
          enabled={enabled}
          onChange={setAsk}
          onCommit={onCommit}
          bookPos={posFor(vehicle.bookValue)}
          marketPos={posFor(vehicle.marketPrice)}
        />

        <View style={styles.stepRow}>
          <TouchableOpacity
            style={[styles.stepBtn, !enabled && styles.disabled]}
            disabled={!enabled}
            onPress={() => {
              const v = clampStep(ask - STEP, min, max);
              setAsk(v);
              onCommit(v);
            }}
            testID="pricing-ask-down"
            accessibilityRole="button"
            accessibilityLabel="Lower asking price"
          >
            <Text style={styles.stepBtnText}>− {money(STEP)}</Text>
          </TouchableOpacity>
          <Text style={styles.refRange}>
            {money(vehicle.bookValue)} book · {money(vehicle.marketPrice)} market
          </Text>
          <TouchableOpacity
            style={[styles.stepBtn, !enabled && styles.disabled]}
            disabled={!enabled}
            onPress={() => {
              const v = clampStep(ask + STEP, min, max);
              setAsk(v);
              onCommit(v);
            }}
            testID="pricing-ask-up"
            accessibilityRole="button"
            accessibilityLabel="Raise asking price"
          >
            <Text style={styles.stepBtnText}>+ {money(STEP)}</Text>
          </TouchableOpacity>
        </View>

        {askingPriceHint && (
          <HintLine id="asking_price" text={askingPriceHint} />
        )}

        {/* Predicted days-to-sell + projected gross */}
        <View style={styles.dualRow}>
          <View style={[styles.card, styles.half]}>
            <Text style={styles.cardLabel}>Predicted days to sell</Text>
            <Text style={styles.bigStat}>{daysText}</Text>
            <Text style={styles.subtle}>
              {Math.round(shownConfidence * 100)}% confidence
            </Text>
          </View>
          <View style={[styles.card, styles.half]}>
            <Text style={styles.cardLabel}>Projected gross</Text>
            <Text
              style={[
                styles.bigStat,
                { color: grossPositive ? colors.positive : colors.danger },
              ]}
            >
              {grossPositive ? '' : '−'}
              {money(Math.abs(projectedGross))}
            </Text>
            <Text style={styles.subtle}>net of projected carry</Text>
          </View>
        </View>

        {/* Staff suggestion */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {suggestion.source === 'ucm' ? 'Used-Car Manager' : 'Suggested price'}
          </Text>
          <View style={styles.suggestRow}>
            <Text style={styles.suggestPrice} numberOfLines={1}>
              {suggestionText}
            </Text>
            <TouchableOpacity
              style={[styles.applyBtn, !enabled && styles.disabled]}
              disabled={!enabled}
              onPress={applySuggestion}
              testID="pricing-ask-apply"
              accessibilityRole="button"
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.rationale}>
            {suggestion.source === 'ucm'
              ? `${suggestion.strategyLabel} strategy — your UCM (pricing ${Math.round(
                  suggestion.pricingSkill ?? 0,
                )}) recommends listing here to balance gross and turn.`
              : `${suggestion.strategyLabel} strategy — heuristic estimate. Hire a Used-Car Manager for a sharper read.`}
          </Text>
        </View>

        {/* Competitor comparables */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Competitor comparables</Text>
          {comps.length === 0 ? (
            <Text style={styles.empty}>No competitor data.</Text>
          ) : (
            comps.map((c) => {
              const delta = c.price - ask;
              return (
                <View key={c.id} style={styles.compRow}>
                  <Text style={styles.compName} numberOfLines={1}>
                    {c.name}
                    <Text style={styles.compPoint}>  {c.pricePoint}</Text>
                  </Text>
                  <Text style={styles.compPrice}>{money(c.price)}</Text>
                  <Text
                    style={[
                      styles.compDelta,
                      { color: delta >= 0 ? colors.positive : colors.danger },
                    ]}
                  >
                    {delta >= 0 ? '+' : '−'}
                    {money(Math.abs(delta))}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Aging warning */}
        {vehicle.aged && (
          <View style={[styles.card, styles.agedCard]}>
            <Text style={styles.agedTitle}>
              Aged — {vehicle.daysInInventory}d on lot (over {vehicle.agedThresholdDays}d)
            </Text>
            <Text style={styles.agedBody}>
              Carrying cost to date: {money(vehicle.carryingCostToDate)} — every
              additional day costs {money(vehicle.dailyCarryingCost)}.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  close: { padding: 6, marginLeft: 8 },
  closeText: { fontSize: 18, color: colors.textMuted },
  content: { padding: 16, paddingBottom: 40 },
  lockedNote: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  askBlock: { alignItems: 'center', marginBottom: 18 },
  askLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  askValue: { fontSize: 40, fontWeight: '800', color: colors.textPrimary, marginVertical: 4 },
  posChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  posChipText: { fontSize: 13, fontWeight: '700' },
  sliderWrap: { marginBottom: 6 },
  track: {
    height: 28,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.primaryDim,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  tickRow: { height: 16, marginTop: 2 },
  tick: {
    position: 'absolute',
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: -16,
    width: 40,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6,
  },
  stepBtn: {
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  stepBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  refRange: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textMuted },
  dualRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  half: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  cardLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  bigStat: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  subtle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestPrice: { flexShrink: 1, fontSize: 22, fontWeight: '800', color: colors.reward },
  applyBtn: {
    backgroundColor: colors.primaryDim,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  applyBtnText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  rationale: { fontSize: 12, color: colors.textSecondary, marginTop: 10, lineHeight: 17 },
  compRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  compName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  compPoint: { fontSize: 11, color: colors.textMuted },
  compPrice: { fontSize: 13, color: colors.textSecondary, width: 84, textAlign: 'right' },
  compDelta: { fontSize: 12, fontWeight: '600', width: 76, textAlign: 'right' },
  agedCard: { borderWidth: 1, borderColor: colors.danger },
  agedTitle: { fontSize: 14, fontWeight: '700', color: colors.danger, marginBottom: 4 },
  agedBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  disabled: { opacity: 0.5 },
});
