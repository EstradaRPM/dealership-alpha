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
  Animated,
} from 'react-native';
import { discountAcceptProbability } from '../../game/StaffDispatch';
import { acceptanceHeatBands, bandForProb, bandColor } from './acceptanceHeat';

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
  // Acceptance-heat readout (#287).
  /** Max counter-offers the customer hears before walking — the pip denominator. */
  readonly counterAttempts: number;
  /** Counters missed at open (always 0; the modal tracks live from counterResult). */
  readonly priorMisses: number;
  /** Acceptance prob of the salesperson's failed counter — the opening read. */
  readonly salespersonCounterAcceptProb: number;
  /** Customer price-sensitivity (0..1) — colors the live price input. */
  readonly priceSensitivity: number;
  /** Per-miss acceptance cool-off — the live color reflects accumulated misses. */
  readonly missPenalty: number;
}

export type DiscountDecision =
  | { readonly kind: 'accept_ask' }
  | { readonly kind: 'accept_counter' }
  | { readonly kind: 'propose_counter'; readonly amount: number }
  | { readonly kind: 'decline' };

/** Terminal buy/walk recap shown after the deal resolves. */
export type DiscountOutcome =
  | { readonly kind: 'sold'; readonly soldPrice: number; readonly frontGross: number }
  | { readonly kind: 'walked' }
  // The price was agreed and no lender would buy the paper (#367). A separate
  // recap from a plain walk because the player did close the customer — what
  // lost the deal was the store's standing rate markup, not this negotiation.
  | { readonly kind: 'finance_declined' };

interface Props {
  visible: boolean;
  review: DiscountReview | null;
  onDecide: (decision: DiscountDecision) => void;
  counterResult?: {
    readonly amount: number;
    readonly accepted: boolean;
    readonly attemptsRemaining?: number;
    /** Acceptance prob of the just-rejected offer — the new headline (#287). */
    readonly acceptProb?: number;
  } | null;
  /** When set, the negotiation has resolved — show the recap + a Done button. */
  outcome?: DiscountOutcome | null;
  onDismiss?: () => void;
  /**
   * The car this deal is on was bought by another customer while the review sat
   * open (#364). Every decision below has the same answer now, so the prompt
   * says so plainly and offers nothing that cannot complete.
   */
  vehicleSold?: boolean;
}

const dollars = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (p: number): string => `${Math.round(p * 100)}%`;

export function DiscountEscalationModal({
  visible,
  review,
  onDecide,
  counterResult,
  outcome,
  onDismiss,
  vehicleSold,
}: Props) {
  const [counterText, setCounterText] = React.useState('');
  const bands = React.useMemo(() => acceptanceHeatBands(), []);

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

  // Patience: pips total = counterAttempts; the haggle drains them, and each
  // miss also cools every future roll (priorMisses feeds the live color).
  const remaining = counterResult?.attemptsRemaining ?? review?.counterAttempts ?? 0;
  const priorMisses = (review?.counterAttempts ?? 0) - remaining;

  // The reactive headline: the salesperson's failed-counter prob until the
  // player commits an offer, then that committed offer's resolved prob.
  const headlineProb =
    counterResult?.acceptProb ?? review?.salespersonCounterAcceptProb ?? 0;
  const headlineBand = bandForProb(headlineProb, bands);
  const headlineColor = bandColor(headlineBand);

  // Coarse, number-free color on the price input as directional feel — the
  // exact % only ever resolves on a committed offer, never as you type.
  const liveBand =
    review != null && counterValid
      ? bandForProb(
          discountAcceptProbability(
            review.customerTargetPrice,
            parsedCounter,
            review.priceSensitivity,
            priorMisses,
            review.missPenalty,
          ),
          bands,
        )
      : null;
  const inputBorderColor = liveBand ? bandColor(liveBand) : colors.border;

  // A brief pulse whenever the headline number changes (open → first commit →
  // each subsequent commit), so the slope of the read is felt, not just read.
  const pulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    pulse.setValue(0.4);
    Animated.timing(pulse, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [headlineProb, pulse]);

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
            {vehicleSold
              ? 'The car this deal was on is gone.'
              : 'Customer wants to pay less than the salesperson can authorize.'}
          </Text>

          {review == null ? (
            <Text style={styles.muted}>No discount in review.</Text>
          ) : vehicleSold ? (
            // #364: another customer bought this car while the review sat open.
            // No accept, no counter — the only honest move left is to send them
            // home, and pressing it resolves the customer as the walk it is.
            <View style={styles.body}>
              <Text style={styles.vehicle}>{vehicleSummary}</Text>
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
              {outcome.kind === 'sold' ? (
                <Text style={[styles.recap, styles.accepted]}>
                  {`SOLD at ${dollars(outcome.soldPrice)} — ${dollars(outcome.frontGross)} front gross.`}
                </Text>
              ) : outcome.kind === 'finance_declined' ? (
                <Text style={[styles.recap, styles.rejected]}>
                  They took the price, but no bank would take the loan at the
                  rate your finance office marks up to. No deal.
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

              {/* Acceptance-heat readout: the centerpiece. */}
              <View style={styles.heatBlock}>
                <Animated.Text
                  style={[
                    styles.heatPct,
                    { color: headlineColor, opacity: pulse },
                  ]}
                  accessibilityLabel={`Acceptance ${pct(headlineProb)}, ${headlineBand.label}`}
                >
                  {pct(headlineProb)}
                </Animated.Text>
                <Text style={[styles.heatBand, { color: headlineColor }]}>
                  {headlineBand.label}
                </Text>
                <Text style={styles.heatCaption}>
                  {counterResult != null
                    ? `Your ${dollars(counterResult.amount)} counter — rejected.`
                    : `Salesperson's ${dollars(review.salespersonCounter)} counter — and they balked.`}
                </Text>
              </View>

              {/* Patience: a pip dies per swing-and-a-miss. */}
              <View style={styles.pipsRow}>
                <Text style={styles.pipsLabel}>Patience</Text>
                <View style={styles.pips}>
                  {Array.from({ length: review.counterAttempts }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.pip,
                        i < remaining ? styles.pipLive : styles.pipDead,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.actions}>
                <Action
                  label="Meet their target - guaranteed close"
                  disabled={!review.canAcceptAsk}
                  onPress={() => onDecide({ kind: 'accept_ask' })}
                />
                <Action
                  label={`Re-pitch ${dollars(review.salespersonCounter)} counter`}
                  onPress={() => onDecide({ kind: 'accept_counter' })}
                />

                <View style={styles.counterRow}>
                  <TextInput
                    style={[styles.input, { borderColor: inputBorderColor }]}
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
  heatBlock: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  heatPct: {
    fontFamily: 'monospace',
    fontSize: 52,
    fontWeight: '700',
    lineHeight: 58,
  },
  heatBand: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 2,
  },
  heatCaption: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  pipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  pipsLabel: { fontFamily: 'monospace', fontSize: 12, color: colors.textMuted },
  pips: { flexDirection: 'row' },
  pip: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: 6,
  },
  pipLive: { backgroundColor: colors.primary },
  pipDead: { backgroundColor: colors.borderMuted },
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
