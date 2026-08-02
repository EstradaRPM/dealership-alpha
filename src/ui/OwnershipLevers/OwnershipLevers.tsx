import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader } from '../kit';
import { ChipRow } from '../DeptControls';

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

export interface OwnershipLeversProps {
  /** ⇔ DayLoopState.ownershipUnlocked. All levers greyed + inert when false
   *  (#107 d11: levers greyed while the floor is live). */
  enabled: boolean;
  hoursOptions: readonly HoursOption[];
  hoursOfOpId: string;
  onSelectHours: (id: string) => void;
  /** Trade-policy lever (#172): options + current selection + setter. */
  tradePolicyOptions: readonly TradePolicyLeverOption[];
  tradePolicyId: string;
  onSelectTradePolicy: (id: string) => void;
}

/**
 * The pre-open Prep levers (#120, design #107 d11), reduced in #346 to what the
 * locked IA §4 says Prep is: **pure pre-open policy — hours of operation and
 * trade policy.** Two levers, one block, no navigation links parked here.
 *
 * What used to live here and where it went: the stock list, per-unit price rows
 * and pricing strategy → the Lot room (the Lot owns the stock pipeline); the
 * auction → the Lot room's sourcing section; hiring → the People tab; the
 * advertising campaign → the demand console, which Growth inherits.
 *
 * The block paints no heading of its own — the Operations tab's "Prep"
 * `SectionHeader` is the only one (it used to draw a second "NEXT-DAY PREP"
 * line directly beneath it).
 */
export function OwnershipLevers({
  enabled,
  hoursOptions,
  hoursOfOpId,
  onSelectHours,
  tradePolicyOptions,
  tradePolicyId,
  onSelectTradePolicy,
}: OwnershipLeversProps) {
  const t = useTheme();
  const selectedPolicy =
    tradePolicyOptions.find((p) => p.id === tradePolicyId) ??
    tradePolicyOptions[0];
  const root: ViewStyle = { alignSelf: 'stretch' };
  const locked: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
  };
  const hint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
    marginBottom: t.spacing.xs,
  };
  const blurb: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.sm,
  };
  const region: ViewStyle = { marginTop: t.spacing.md };
  const dim: ViewStyle = enabled ? {} : { opacity: 0.45 };

  return (
    <View style={root} testID="ownership-levers">
      {!enabled && <Text style={locked}>Floor open — levers locked.</Text>}

      <View style={dim}>
        <Surface testID="prep-hours">
          <SectionHeader title="Hours of Operation" />
          <Text style={hint}>How long you keep the lot open tomorrow.</Text>
          <ChipRow
            options={hoursOptions.map((o) => ({ id: o.id, label: o.label }))}
            selectedId={hoursOfOpId}
            onSelect={onSelectHours}
            disabled={!enabled}
          />
        </Surface>

        <View style={region}>
          <Surface testID="prep-trade-policy">
            <SectionHeader title="Trade Policy" />
            <Text style={hint}>
              How aggressively you take trade-ins against the customer&apos;s car.
            </Text>
            <ChipRow
              options={tradePolicyOptions.map((o) => ({
                id: o.id,
                label: o.label,
              }))}
              selectedId={tradePolicyId}
              onSelect={onSelectTradePolicy}
              disabled={!enabled}
            />
            {selectedPolicy && (
              <Text style={blurb}>{selectedPolicy.blurb}</Text>
            )}
          </Surface>
        </View>
      </View>
    </View>
  );
}
