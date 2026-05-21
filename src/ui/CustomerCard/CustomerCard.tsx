import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import type { CurrentVehicle } from '../../game/NPC';

/**
 * Inspect-a-customer surface (#165). Renders the durable customer header
 * (label + customerId) and the `currentVehicle` summary the trade-in
 * machinery (#166–#171) consumes downstream.
 *
 * Stays pure: no game-logic reach, no dispatch. The composition root passes
 * the read-model in. Reusable from AdminConsole (current site), HandPlayModal
 * (the in-game inspect path), and the upcoming trade-escalation overlay.
 */
export interface CustomerCardModel {
  customerId: string;
  archetypeLabel: string;
  currentVehicle?: CurrentVehicle;
}

interface Props {
  model: CustomerCardModel;
}

const CONDITION_LABEL: Record<'clean' | 'average' | 'rough', string> = {
  clean: 'Clean',
  average: 'Average',
  rough: 'Rough',
};

export function CustomerCard({ model }: Props) {
  const cv = model.currentVehicle;
  return (
    <View
      style={styles.card}
      accessibilityLabel={`Customer card for ${model.archetypeLabel}`}
    >
      <Text style={styles.kicker}>CUSTOMER</Text>
      <Text style={styles.label}>{model.archetypeLabel}</Text>
      <Text style={styles.id} numberOfLines={1}>
        {model.customerId}
      </Text>

      <Text style={styles.sectionLabel}>CURRENTLY DRIVING</Text>
      {cv === undefined ? (
        <Text style={styles.muted}>Unknown</Text>
      ) : (
        <>
          <Text style={styles.vehicle}>
            {cv.year} {cv.make} {cv.model}
          </Text>
          <Text style={styles.detailLine}>
            {cv.mileage.toLocaleString()} mi · {CONDITION_LABEL[cv.condition]}
          </Text>
          <Text style={styles.payoffLine}>
            {cv.loanPayoff === null
              ? 'Owned outright'
              : `Loan payoff: $${cv.loanPayoff.toLocaleString()}`}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    padding: 12,
  },
  kicker: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.border,
    letterSpacing: 3,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 4,
  },
  id: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.border,
    letterSpacing: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  vehicle: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textPrimary,
  },
  detailLine: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  payoffLine: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  muted: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.borderMuted,
  },
});
