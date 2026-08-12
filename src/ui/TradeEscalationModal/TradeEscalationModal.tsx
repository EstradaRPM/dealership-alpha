import React from 'react';
import { colors } from '../theme';
import { money, grouped } from '../kit';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';

/**
 * Manager-attention trade overlay (#170) — the player approver's decision
 * surface when an *unusual* trade escalates with no manager to handle it (or an
 * ask over the player override). Opened by the composition root in response to
 * `trade:escalated`; the day is paused behind it (via the render-loop hold). This view
 * only renders the honest figures and dispatches the player's decision — it
 * reaches no game-logic internals. The customer accept/reject on a proposed
 * counter (`rollCustomerCounterResponse`) runs behind the seam; the result
 * rides back in via `counterResult`.
 */
export interface TradeReview {
  readonly customerId: string;
  /** The unit on the lot this customer is buying (#364) — not the trade. */
  readonly vehicle: {
    readonly id: string;
    readonly make: string;
    readonly model: string;
    readonly year: number;
    readonly mileage: number;
    readonly category: string;
  };
  readonly currentVehicle: {
    readonly make: string;
    readonly model: string;
    readonly year: number;
    readonly mileage: number;
    readonly condition: string;
    readonly category: string;
    readonly loanPayoff: number | null;
  };
  /** Honest wholesale book for the trade. */
  readonly book: number;
  /** What the customer wants for the trade. */
  readonly allowanceAsk: number;
  /** Outstanding lien (0 for a free-and-clear owner). */
  readonly payoff: number;
  /** Staff's internal acceptance target. */
  readonly target: number;
  /** Advisory counter the salesperson would have offered. */
  readonly recommendedCounter: number;
  /** UCM condition-read confidence behind the appraisal (0 = no UCM). */
  readonly staffConfidence: number;
}

export type TradeDecision =
  | { readonly kind: 'accept_ask' }
  | { readonly kind: 'accept_counter' }
  | { readonly kind: 'propose_counter'; readonly amount: number }
  | { readonly kind: 'decline' };

/** Terminal buy/walk recap shown after the trade resolves (#283). */
export type TradeOutcome =
  | { readonly kind: 'booked'; readonly agreedAllowance: number }
  | { readonly kind: 'walked' };

interface Props {
  visible: boolean;
  /** The escalated trade, or null while closed. */
  review: TradeReview | null;
  /** Dispatch the player's decision → composition root resolves it. */
  onDecide: (decision: TradeDecision) => void;
  /**
   * Result of the most recent proposed counter, surfaced after the customer's
   * accept/reject roll resolves. `null` while none pending.
   */
  counterResult?: { readonly amount: number; readonly accepted: boolean } | null;
  /** When set, the trade has resolved — show the recap + a Done button (#283). */
  outcome?: TradeOutcome | null;
  /** Dismiss the resolved recap. */
  onDismiss?: () => void;
  /**
   * The car this deal is on was bought by another customer while the review sat
   * open (#364). Every decision below has the same answer now, so the prompt
   * says so plainly and offers nothing that cannot complete.
   */
  vehicleSold?: boolean;
}

// The figure being answered is stated **exactly** (issue 387) — this modal is
// the moment the player commits to it.
const dollars = money;

export function TradeEscalationModal({
  visible,
  review,
  onDecide,
  counterResult,
  outcome,
  onDismiss,
  vehicleSold,
}: Props) {
  const [counterText, setCounterText] = React.useState('');

  // Reset the typed counter once the trade resolves, so a re-opened modal for
  // the next customer starts clean.
  React.useEffect(() => {
    if (outcome != null) setCounterText('');
  }, [outcome]);

  const parsedCounter = Number.parseInt(counterText.replace(/[^0-9]/g, ''), 10);
  const counterValid = Number.isFinite(parsedCounter) && parsedCounter > 0;

  const cv = review?.currentVehicle;
  const vehicleSummary = cv
    ? `${cv.year} ${cv.make} ${cv.model} · ${grouped(cv.mileage)} mi · ${cv.condition}`
    : '—';

  // The unit off our lot the deal is on (#364) — named on every state, because
  // once it sells to someone else the prompt still has to say which car it was.
  const dv = review?.vehicle;
  const dealUnitSummary = dv
    ? `${dv.year} ${dv.make} ${dv.model} · ${grouped(dv.mileage)} mi`
    : '—';

  // The honest "why the ask is high" signal (#283): how far the lien exceeds
  // the trade's wholesale book. A positive gap is the negative equity the
  // customer is rolling — surfaced explicitly so a big ask reads as logical.
  const negativeEquity = review ? review.payoff - review.book : 0;

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
          <Text style={styles.kicker}>MANAGER ATTENTION — TRADE</Text>
          <Text style={styles.customer}>{review?.customerId ?? '—'}</Text>
          <Text style={styles.banner}>
            {vehicleSold
              ? 'The car this deal was on is gone.'
              : 'Unusual trade — your call. The day is paused.'}
          </Text>

          {review == null ? (
            <Text style={styles.muted}>No trade in review.</Text>
          ) : vehicleSold ? (
            // #364: another customer bought this car while the review sat open.
            // No accept, no counter — the only honest move left is to send them
            // home, and pressing it resolves the customer as the walk it is.
            <View style={styles.body}>
              <Text style={styles.vehicle}>{dealUnitSummary}</Text>
              <Text style={[styles.recap, styles.rejected]}>
                Another customer bought it while you were deciding. There is no
                deal left to make on this one.
              </Text>
              <View style={styles.actions}>
                <Action
                  label="Done"
                  onPress={() => onDecide({ kind: 'decline' })}
                />
              </View>
            </View>
          ) : outcome != null ? (
            <View style={styles.body}>
              <Text style={styles.vehicle}>{vehicleSummary}</Text>
              {outcome.kind === 'booked' ? (
                <Text style={[styles.recap, styles.accepted]}>
                  {`Trade booked at ${dollars(outcome.agreedAllowance)} allowance. Deal closed.`}
                </Text>
              ) : (
                <Text style={[styles.recap, styles.rejected]}>
                  Trade declined. Customer walked.
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
              <Text style={styles.dealUnit}>{`Buying: ${dealUnitSummary}`}</Text>

              <Row label="Honest book" value={dollars(review.book)} />
              <Row label="Customer asks" value={dollars(review.allowanceAsk)} emphasize />
              <Row
                label="Lien payoff"
                value={review.payoff > 0 ? dollars(review.payoff) : '—'}
              />
              {negativeEquity > 0 && (
                <Row
                  label="Underwater by"
                  value={dollars(negativeEquity)}
                  danger
                />
              )}
              <Row label="Our target" value={dollars(review.target)} />
              <Row
                label="Staff counter"
                value={dollars(review.recommendedCounter)}
              />
              <Row
                label="Appraisal confidence"
                value={`${Math.round(review.staffConfidence * 100)}%`}
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
                    : `Customer rejected your ${dollars(counterResult.amount)} counter.`}
                </Text>
              )}

              <View style={styles.actions}>
                <Action
                  label={`Accept ask — ${dollars(review.allowanceAsk)}`}
                  onPress={() => onDecide({ kind: 'accept_ask' })}
                />
                <Action
                  label={`Accept staff counter — ${dollars(review.recommendedCounter)}`}
                  onPress={() => onDecide({ kind: 'accept_counter' })}
                />

                <View style={styles.counterRow}>
                  <TextInput
                    style={styles.input}
                    value={counterText}
                    onChangeText={setCounterText}
                    keyboardType="number-pad"
                    placeholder="Your counter $"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Propose your own counter amount"
                  />
                  <TouchableOpacity
                    style={[styles.counterBtn, !counterValid && styles.counterBtnDisabled]}
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
                  label="Decline trade"
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
  danger,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          emphasize && styles.rowValueEmphasize,
          danger && styles.rowValueDanger,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.action, danger && styles.actionDanger]}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>
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
  dealUnit: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  rowLabel: { fontFamily: 'monospace', fontSize: 12, color: colors.textMuted },
  rowLabelDanger: { color: colors.danger },
  rowValue: { fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary },
  rowValueEmphasize: { color: colors.textPrimary, fontWeight: '700' },
  rowValueDanger: { color: colors.danger, fontWeight: '700' },
  recap: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  counterResult: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 12,
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
  actionText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textPrimary,
  },
  actionTextDanger: { color: colors.danger },
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
