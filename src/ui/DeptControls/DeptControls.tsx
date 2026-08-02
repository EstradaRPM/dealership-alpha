import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

/**
 * Shared department POLICY-control primitives (#318). Extracted from the Service
 * page's #309 control block so the Body Shop page reuses the exact same steppers,
 * supplier-tier chips, and posture dial against its own four collision categories
 * — one implementation, two profit centers (the shared department-line idiom).
 *
 * Pure presentational widgets: they render the live values + option lists the
 * composition root reads off the World and dispatch the setters back. No
 * game-logic reach-in; visual treatment is deliberately plain (the
 * neo-skeuomorphic rebrand — a real slider etc. — is the later `/map-mockup`
 * pass). Posture/par are policies: set once, applied automatically.
 */

/** Supplier-tier id — kept a bare string here so the UI never imports a game
 *  type. */
export type DeptSupplierTierId = string;

/** One parts category's procurement policy row. */
export interface DeptParControl {
  category: string;
  label: string;
  /** On-hand reorder trigger. */
  reorderPoint: number;
  /** Par level the reorder sweep fills back up to. */
  target: number;
  tier: DeptSupplierTierId;
  /** Units on hand right now — context for tuning the par levels. */
  onHand: number;
}

/** A selectable supplier tier, cheapest/slowest → priciest/fastest. */
export interface DeptTierOption {
  id: DeptSupplierTierId;
  label: string;
}

/** A selectable chip option (marketing arm, tier, …). */
export interface DeptChipOption {
  id: string;
  label: string;
  blurb?: string;
}

// Posture step per ± tap. The dial is continuous [0,1]; a real slider is the
// later /map-mockup pass — this slice steps it functionally.
export const POSTURE_STEP = 0.1;

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  accessibilityName,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  accessibilityName: string;
}) {
  const t = useTheme();
  const s = makeControlStyles(t);
  return (
    <View style={s.stepperRow}>
      <Text style={s.stepperLabel}>{label}</Text>
      <View style={s.stepperControls}>
        <TouchableOpacity
          style={s.stepBtn}
          onPress={() => onChange(Math.max(min, value - 1))}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${accessibilityName}`}
        >
          <Text style={s.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepValue} accessibilityLabel={`${accessibilityName} ${value}`}>
          {value}
        </Text>
        <TouchableOpacity
          style={s.stepBtn}
          onPress={() => onChange(value + 1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${accessibilityName}`}
        >
          <Text style={s.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ChipRow({
  options,
  selectedId,
  onSelect,
  disabled = false,
  testID,
}: {
  options: readonly DeptChipOption[] | readonly DeptTierOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Inert + dimmed — the pre-open levers are locked while the floor is live
   *  (#107 d11, #346). Default `false`: department policy chips are always live. */
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const s = makeControlStyles(t);
  return (
    <View style={s.chipRow} testID={testID}>
      {options.map((o) => {
        const sel = o.id === selectedId;
        return (
          <TouchableOpacity
            key={o.id}
            style={[s.chip, sel && s.chipSel, disabled && s.chipDisabled]}
            disabled={disabled}
            onPress={() => onSelect(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel, disabled }}
            accessibilityLabel={o.label}
          >
            <Text style={[s.chipText, sel && s.chipTextSel]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ParControlRow({
  row,
  tierOptions,
  testIDPrefix,
  onSetReorderPoint,
  onSetTarget,
  onSetSupplierTier,
}: {
  row: DeptParControl;
  tierOptions: readonly DeptTierOption[];
  /** Per-department testID prefix, e.g. `service-par-` / `body-shop-par-`. */
  testIDPrefix: string;
  onSetReorderPoint: (category: string, value: number) => void;
  onSetTarget: (category: string, value: number) => void;
  onSetSupplierTier: (category: string, tier: DeptSupplierTierId) => void;
}) {
  const t = useTheme();
  const s = makeControlStyles(t);
  return (
    <View style={s.parRow} testID={`${testIDPrefix}${row.category}`}>
      <Text style={s.parTitle}>
        {row.label} <Text style={s.parOnHand}>· {row.onHand} on hand</Text>
      </Text>
      <Stepper
        label="Reorder at"
        value={row.reorderPoint}
        onChange={(v) => onSetReorderPoint(row.category, v)}
        accessibilityName={`${row.label} reorder point`}
      />
      <Stepper
        label="Stock up to"
        value={row.target}
        onChange={(v) => onSetTarget(row.category, v)}
        accessibilityName={`${row.label} target stock`}
      />
      <ChipRow
        options={tierOptions}
        selectedId={row.tier}
        onSelect={(tier) => onSetSupplierTier(row.category, tier)}
      />
    </View>
  );
}

/**
 * A continuous [0,1] policy dial stepped ±0.1, surfaced with a plain-language
 * word that NAMES THE AXIS (never a temperature — the locked rule). The caller
 * supplies the endpoint labels + word/accessibility phrasing so the same dial
 * drives Service's competitive↔premium posture and the Body Shop's
 * insurance↔retail channel mix.
 */
export function PostureDial({
  value,
  onChange,
  word,
  leftLabel,
  rightLabel,
  readoutA11y,
  decreaseA11y,
  increaseA11y,
  testID,
}: {
  value: number;
  onChange: (next: number) => void;
  /** Plain-language word for the current value (names the axis endpoints). */
  word: (v: number) => string;
  leftLabel: string;
  rightLabel: string;
  /** Accessibility readout, given the resolved word + percent toward the right. */
  readoutA11y: (word: string, pct: number) => string;
  decreaseA11y: string;
  increaseA11y: string;
  testID: string;
}) {
  const t = useTheme();
  const s = makeControlStyles(t);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const pct = Math.round(value * 100);
  const w = word(value);
  return (
    <View style={s.postureRow} testID={testID}>
      <TouchableOpacity
        style={s.stepBtn}
        onPress={() => onChange(clamp(value - POSTURE_STEP))}
        accessibilityRole="button"
        accessibilityLabel={decreaseA11y}
      >
        <Text style={s.stepBtnText}>−</Text>
      </TouchableOpacity>
      <View style={s.postureReadout}>
        <Text style={s.postureWord} accessibilityLabel={readoutA11y(w, pct)}>
          {w}
        </Text>
        <Text style={s.postureScale}>
          {leftLabel} ◄ {pct}% ► {rightLabel}
        </Text>
      </View>
      <TouchableOpacity
        style={s.stepBtn}
        onPress={() => onChange(clamp(value + POSTURE_STEP))}
        accessibilityRole="button"
        accessibilityLabel={increaseA11y}
      >
        <Text style={s.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export function makeControlStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    parRow: {
      paddingVertical: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.borderMuted,
    },
    parTitle: { ...t.typography.label, color: t.colors.textPrimary },
    parOnHand: { ...t.typography.caption, color: t.colors.textMuted },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.xxs,
    },
    stepperLabel: { ...t.typography.body, color: t.colors.textSecondary },
    stepperControls: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { ...t.typography.title, color: t.colors.accent },
    stepValue: {
      ...t.typography.label,
      color: t.colors.textPrimary,
      minWidth: 28,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.xs,
      marginTop: t.spacing.xs,
    },
    chip: {
      paddingVertical: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.base,
    },
    chipSel: { borderColor: t.colors.accent, backgroundColor: t.colors.primaryDim },
    chipDisabled: { opacity: 0.45 },
    chipText: { ...t.typography.caption, color: t.colors.textSecondary },
    chipTextSel: { color: t.colors.accent },
    postureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      marginTop: t.spacing.xs,
    },
    postureReadout: { flex: 1, alignItems: 'center' },
    postureWord: { ...t.typography.label, color: t.colors.textPrimary },
    postureScale: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
  });
}
