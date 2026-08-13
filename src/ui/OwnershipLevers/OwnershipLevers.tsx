import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, HintLine } from '../kit';
import { ChipRow } from '../DeptControls';
import { FniPeakMeter, type FniPeakMeterProps } from './FniPeakMeter';

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

/** One selectable standing F&I posture (#366). */
export interface FniPostureLeverOption {
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
  /** F&I posture lever (#366): options + current selection + setter. */
  fniPostureOptions: readonly FniPostureLeverOption[];
  fniPostureId: string;
  onSelectFniPosture: (id: string) => void;
  /**
   * Is an `f&i-manager` on staff? The posture is a standing instruction to the
   * finance desk, so with no desk it is a setting that changes nothing yet —
   * the surface says so rather than implying an effect it doesn't have (Q2).
   */
  fniDeskStaffed: boolean;
  /**
   * The posture peak meter's reading (#370) — what each stop on the dial is
   * worth on this store's own loan contracts, and where the total crests. Sits
   * with the dial because it is the feedback that makes the dial a bet rather
   * than a guess. Omit and the block renders the dial alone.
   */
  fniPeak?: FniPeakMeterProps;
  /**
   * Consequence hints (#386), each null once the player has used that dial. The
   * copy is `data/hints.json`'s and arrives already resolved — this surface
   * never decides what a hint says or whether it is still owed.
   */
  hoursHint?: string | null;
  tradePolicyHint?: string | null;
  fniPostureHint?: string | null;
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
  fniPostureOptions,
  fniPostureId,
  onSelectFniPosture,
  fniDeskStaffed,
  fniPeak,
  hoursHint,
  tradePolicyHint,
  fniPostureHint,
}: OwnershipLeversProps) {
  const t = useTheme();
  const selectedPolicy =
    tradePolicyOptions.find((p) => p.id === tradePolicyId) ??
    tradePolicyOptions[0];
  const selectedPosture =
    fniPostureOptions.find((p) => p.id === fniPostureId) ?? fniPostureOptions[0];
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
          {hoursHint && <HintLine id="hours_of_operation" text={hoursHint} />}
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
            {tradePolicyHint && (
              <HintLine id="trade_policy" text={tradePolicyHint} />
            )}
          </Surface>
        </View>

        <View style={region}>
          <Surface testID="prep-fni-posture">
            <SectionHeader title="Finance Office" />
            <Text style={hint}>
              How hard your finance manager marks up the loan rate.
            </Text>
            <ChipRow
              options={fniPostureOptions.map((o) => ({
                id: o.id,
                label: o.label,
              }))}
              selectedId={fniPostureId}
              onSelect={onSelectFniPosture}
              disabled={!enabled}
            />
            {selectedPosture && (
              <Text style={blurb}>{selectedPosture.blurb}</Text>
            )}
            {!fniDeskStaffed && (
              <Text style={blurb} testID="fni-posture-unstaffed">
                No finance manager on staff — nobody is working the rate, so this
                setting does nothing until you hire one.
              </Text>
            )}
            {fniPostureHint && (
              <HintLine id="fni_posture" text={fniPostureHint} />
            )}
            {fniPeak && <FniPeakMeter {...fniPeak} />}
          </Surface>
        </View>
      </View>
    </View>
  );
}
