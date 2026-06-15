import React from 'react';
import { colors } from '../theme';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';

export interface DiscountReview {
  readonly customerId: string;
  readonly vehicle: {
    readonly id: string;
    readonly make: string;
    readonly model: string;
    readonly year: number;
    readonly mileage: number;
    readonly category: string;
  };
  readonly marketPrice: number;
  /** Our list price — the top of the range. */
  readonly askingPrice: number;
  /** What the customer wants to pay (their target) — the bottom of the range. */
  readonly customerTargetPrice: number;
  /** The salesperson's failed counter — sits between the two, by skill. */
  readonly salespersonCounter: number;
  readonly minimumAcceptablePrice: number;
  readonly frontGrossAtAsk: number;
  readonly canAcceptAsk: boolean;
}

export type DiscountDecision =
  | { readonly kind: 'accept_ask' }
  | { readonly kind: 'accept_counter' }
  | { readonly kind: 'propose_counter'; readonly amount: number }
  | { readonly kind: 'decline' };

/** Terminal buy/walk recap shown after the deal resolves. */
export type DiscountOutcome =
  | { readonly kind: 'sold'; readonly soldPrice: number; readonly frontGross: number }
  | { readonly kind: 'walked' };

interface Props {
  visible: boolean;
  review: DiscountReview | null;
  onDecide: (decision: DiscountDecision) => void;
  counterResult?: {
    readonly amount: number;
    readonly accepted: boolean;
    readonly attemptsRemaining?: number;
  } | null;
  /** When set, the negotiation has resolved — show the recap + a Done button. */
  outcome?: DiscountOutcome | null;
  onDismiss?: () => void;
}

const dollars = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

export function DiscountEscalationModal({
  visible,
  review,
  onDecide,
  counterResult,
  outcome,
  onDismiss,
}: Props) {
  const [counterText, setCounterText] = React.useState('');

  // Reset the typed counter once the negotiation resolves, so a re-opened
  // modal for the next customer starts clean.
  React.useEffect(() => {
    if (outcome != null) setCounterText('');
  }, [outcome]);

  const parsedCounter = Number.parseInt(counterText.replace(/[^0-9]/g, ''), 10);
  const counterValid =
    Number.isFinite(parsedCounter) &&
    parsedCounter >= (review?.minimumAcceptablePrice ?? 0);

  const vehicleSummary = review
    ? `${review.vehicle.year} ${review.vehicle.make} ${review.vehicle.model} · ${review.vehicle.mileage.toLocaleString('en-US')} mi`
    : '-';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() =>
        outcome != null ? onDismiss?.() : onDecide({ kind: 'decline' })
      }
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>MANAGER ATTENTION - DISCOUNT</Text>
          <Text style={styles.customer}>{review?.customerId ?? '-'}</Text>
          <Text style={styles.banner}>
            Customer wants to pay less than the salesperson can authorize.
          </Text>

          {review == null ? (
            <Text style={styles.muted}>No discount in review.</Text>
          ) : outcome != null ? (
            <View style={styles.body}>
              <Text style={styles.vehicle}>{vehicleSummary}</Text>
              {outcome.kind === 'sold' ? (
                <Text style={[styles.recap, styles.accepted]}>
                  {`SOLD at ${dollars(outcome.soldPrice)} — ${dollars(outcome.frontGross)} front gross.`}
                </Text>
              ) : (
                <Text style={[styles.recap, styles.rejected]}>
                  Customer walked. No deal.
                </Text>
              )}
              <View style={styles.actions}>
                <Action label="Done" onPress={() => onDismiss?.()} />
              </View>
            </View>
          ) : (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
            >
              <Text style={styles.vehicle}>{vehicleSummary}</Text>

              <Row
                label="Our list price"
                value={dollars(review.askingPrice)}
                emphasize
              />
              <Row
                label="Customer target"
                value={dollars(review.customerTargetPrice)}
                emphasize
              />
              <Row
                label="Salesperson's failed counter"
                value={dollars(review.salespersonCounter)}
              />
              <Row label="Market price" value={dollars(review.marketPrice)} />
              <Row
                label="Our cost floor"
                value={dollars(review.minimumAcceptablePrice)}
              />
              <Row
                label="Gross at list"
                value={dollars(review.frontGrossAtAsk)}
              />

              {counterResult != null && (
                <Text
                  style={[
                    styles.counterResult,
                    counterResult.accepted ? styles.accepted : styles.rejected,
                  ]}
                >
                  {counterResult.accepted
                    ? `Customer took your ${dollars(counterResult.amount)} counter.`
                    : `Customer held — rejected your ${dollars(counterResult.amount)} counter. ${
                        counterResult.attemptsRemaining === 1
                          ? 'One more offer before they walk.'
                          : `${counterResult.attemptsRemaining ?? 0} offers left before they walk.`
                      }`}
                </Text>
              )}

              <View style={styles.actions}>
                <Action
                  label={`Accept their price - ${dollars(review.customerTargetPrice)}`}
                  disabled={!review.canAcceptAsk}
                  onPress={() => onDecide({ kind: 'accept_ask' })}
                />
                <Action
                  label={`Re-pitch counter - ${dollars(review.salespersonCounter)}`}
                  onPress={() => onDecide({ kind: 'accept_counter' })}
                />

                <View style={styles.counterRow}>
                  <TextInput
                    style={styles.input}
                    value={counterText}
                    onChangeText={setCounterText}
                    keyboardType="number-pad"
                    placeholder="Your price $"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Propose your own sale price"
                  />
                  <TouchableOpacity
                    style={[
                      styles.counterBtn,
                      !counterValid && styles.counterBtnDisabled,
                    ]}
                    disabled={!counterValid}
                    accessibilityRole="button"
                    accessibilityLabel="Propose counter"
                    onPress={() =>
                      counterValid &&
                      onDecide({ kind: 'propose_counter', amount: parsedCounter })
                    }
                  >
                    <Text style={styles.counterBtnText}>Propose</Text>
                  </TouchableOpacity>
                </View>

                <Action
                  label="Let them walk"
                  danger
                  onPress={() => onDecide({ kind: 'decline' })}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasize && styles.rowValueEmphasize]}>
        {value}
      </Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.action,
        danger && styles.actionDanger,
        disabled && styles.actionDisabled,
      ]}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionText,
          danger && styles.actionTextDanger,
          disabled && styles.actionTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    padding: 20,
  },
  kicker: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 3,
  },
  customer: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: colors.primary,
    marginTop: 6,
  },
  banner: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
  },
  body: { marginTop: 16 },
  bodyContent: { paddingBottom: 4 },
  vehicle: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  rowLabel: { fontFamily: 'monospace', fontSize: 12, color: colors.textMuted },
  rowValue: { fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary },
  rowValueEmphasize: { color: colors.textPrimary, fontWeight: '700' },
  counterResult: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 12,
  },
  recap: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  accepted: { color: colors.positive },
  rejected: { color: colors.danger },
  actions: { marginTop: 16 },
  action: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  actionDanger: { borderColor: colors.danger },
  actionDisabled: { borderColor: colors.borderMuted },
  actionText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textPrimary,
  },
  actionTextDanger: { color: colors.danger },
  actionTextDisabled: { color: colors.textMuted },
  counterRow: { flexDirection: 'row', marginVertical: 4 },
  input: {
    flex: 1,
    backgroundColor: colors.base,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginRight: 8,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textPrimary,
  },
  counterBtn: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  counterBtnDisabled: { backgroundColor: colors.borderMuted },
  counterBtnText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: colors.base,
  },
  muted: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.borderMuted,
    marginTop: 16,
  },
});
