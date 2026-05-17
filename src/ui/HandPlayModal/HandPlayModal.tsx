import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

/**
 * The player's active verb (#118): a hand-play spotlight over one grabbed
 * customer, reusing FloorSim's grab/advance surface. Opened from a forced-
 * exception alert row or a voluntary cherry-pick. The composition root owns
 * the `HandPlaySession` (grab/advance live behind the #99 seam) and the
 * day-pause; this view only renders the pending gate, dispatches the picked
 * approach, and shows the terminal outcome. It reaches no game-logic internals.
 *
 * `playLive=false` (the `handPlay.playtestLiveDefault` tunable default) means
 * the composition root has paused the day while the modal is open; `true` is
 * the #74/#105 playtest path where the day keeps ticking behind it. Either
 * way, `advance()` burns `tickCostPerGate` deterministic ticks — the clock
 * jumps on resume — so the banner only describes pause state, never alters it.
 */
export type HandPlayOutcome =
  | {
      readonly status: 'continue';
      readonly gate: string;
      readonly choices: readonly { readonly id: string; readonly label: string }[];
    }
  | { readonly status: 'closed' }
  | { readonly status: 'walk'; readonly cause: 'low_quality' | 'day_exhausted' };

interface Props {
  visible: boolean;
  /** Grabbed customer's ref id; null only while closed. */
  customerId: string | null;
  /** Day paused behind the modal (false) vs. running live (true). */
  playLive: boolean;
  /** Current session state, mapped by the composition root; null while closed. */
  outcome: HandPlayOutcome | null;
  /** Pick an approach for the pending gate → composition root calls advance(). */
  onChoose: (choiceId: string) => void;
  /** Dismiss (only meaningful once terminal, or to abandon). */
  onClose: () => void;
}

const WALK_CAUSE_LABEL: Record<'low_quality' | 'day_exhausted', string> = {
  low_quality: 'Customer walked — engagement quality too low.',
  day_exhausted: 'Day ran out mid-deal — the floor closed.',
};

export function HandPlayModal({
  visible,
  customerId,
  playLive,
  outcome,
  onChoose,
  onClose,
}: Props) {
  const terminal = outcome != null && outcome.status !== 'continue';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>HAND-PLAY</Text>
          <Text style={styles.customer}>{customerId ?? '—'}</Text>
          <Text style={styles.banner}>
            {playLive
              ? 'Live — the day is still running behind this.'
              : 'Day paused while you work this customer.'}
          </Text>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            {outcome == null ? (
              <Text style={styles.muted}>No customer in hand.</Text>
            ) : outcome.status === 'continue' ? (
              <>
                <Text style={styles.sectionLabel}>GATE</Text>
                <Text style={styles.gate}>{outcome.gate}</Text>
                <Text style={styles.sectionLabel}>APPROACH</Text>
                {outcome.choices.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.choice}
                    accessibilityRole="button"
                    accessibilityLabel={`Approach: ${c.label}`}
                    onPress={() => onChoose(c.id)}
                  >
                    <Text style={styles.choiceText}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : outcome.status === 'closed' ? (
              <Text style={styles.closed}>Deal closed.</Text>
            ) : (
              <Text style={styles.walk}>{WALK_CAUSE_LABEL[outcome.cause]}</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.dismiss, terminal && styles.dismissPrimary]}
            accessibilityRole="button"
            accessibilityLabel={terminal ? 'Done' : 'Abandon hand-play'}
            onPress={onClose}
          >
            <Text
              style={[
                styles.dismissText,
                terminal && styles.dismissTextPrimary,
              ]}
            >
              {terminal ? 'Done' : 'Abandon'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    maxHeight: '80%',
    backgroundColor: '#161616',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 20,
  },
  kicker: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#444',
    letterSpacing: 3,
  },
  customer: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: '#c8a96e',
    marginTop: 6,
  },
  banner: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#777',
    marginTop: 8,
  },
  body: { marginTop: 16 },
  bodyContent: { paddingBottom: 4 },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#444',
    letterSpacing: 3,
    marginTop: 16,
    marginBottom: 10,
  },
  gate: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: '#e6c98f',
  },
  choice: {
    backgroundColor: '#1f1a12',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3a2f1a',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  choiceText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#e6c98f',
  },
  closed: {
    fontFamily: 'monospace',
    fontSize: 15,
    color: '#7fc99a',
    marginTop: 8,
  },
  walk: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#c98f8f',
    marginTop: 8,
  },
  muted: { fontFamily: 'monospace', fontSize: 12, color: '#555' },
  dismiss: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
  },
  dismissPrimary: { backgroundColor: '#c8a96e' },
  dismissText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#888',
    letterSpacing: 1,
  },
  dismissTextPrimary: { color: '#111', fontWeight: '700' },
});
