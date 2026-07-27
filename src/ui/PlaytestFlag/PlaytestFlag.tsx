import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export interface PlaytestFlagProps {
  /**
   * Fired the instant the FAB is tapped. The parent stamps world context here
   * — the useful moment is when the player *reacted*, not when they finished
   * typing, and a note can take a while to write.
   */
  onOpen: () => void;
  /** The (possibly empty) note. An empty note is a valid "something here". */
  onSave: (note: string) => void;
  onCancel?: () => void;
  /** Entries recorded so far — shown on the FAB so it reads as *recording*. */
  count: number;
  /** Test seam: render with the sheet already open. */
  initiallyOpen?: boolean;
}

const QUICK_NOTES = [
  'Dragged here',
  'Did not understand this',
  'Why did that happen?',
  'This felt good',
] as const;

/**
 * The always-on-screen playtest flag (#332).
 *
 * Sits above the DEV console FAB and is deliberately the *cheaper* of the two
 * to reach: the whole point is that reacting to something costs one tap, so an
 * in-the-moment observation survives without the player leaving the game — the
 * thing that was corrupting the felt-day-length reading.
 *
 * Pure presentation: it never touches the log, the world or the bus.
 */
export function PlaytestFlag({
  onOpen,
  onSave,
  onCancel,
  count,
  initiallyOpen = false,
}: PlaytestFlagProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(initiallyOpen);
  const [note, setNote] = useState('');

  const openSheet = () => {
    onOpen();
    setNote('');
    setOpen(true);
  };

  const save = () => {
    onSave(note);
    setNote('');
    setOpen(false);
  };

  const cancel = () => {
    onCancel?.();
    setNote('');
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        testID="playtest-flag-fab"
        accessibilityRole="button"
        accessibilityLabel="Flag a playtest observation"
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 88, right: insets.right + 8 },
        ]}
        hitSlop={8}
        onPress={openSheet}
      >
        <Text style={styles.fabLabel}>⚑ {count}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={cancel}
      >
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.sheet}>
              <Text style={styles.title}>FLAG THIS MOMENT</Text>
              <Text style={styles.hint}>
                Day, phase, cash and tier are already recorded. A note is optional.
              </Text>

              <TextInput
                testID="playtest-flag-note"
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="what just happened?"
                placeholderTextColor={colors.borderMuted}
                multiline
                autoFocus
                returnKeyType="done"
              />

              <View style={styles.quickRow}>
                {QUICK_NOTES.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={styles.quickChip}
                    onPress={() => setNote(q)}
                  >
                    <Text style={styles.quickChipLabel}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={cancel}>
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="playtest-flag-save"
                  style={[styles.btn, styles.saveBtn]}
                  onPress={save}
                >
                  <Text style={styles.saveLabel}>Save flag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    backgroundColor: 'rgba(190,140,40,0.75)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 999,
  },
  fabLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  input: {
    backgroundColor: colors.base,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickChipLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.surfaceRaised,
  },
  cancelLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.positive,
  },
  saveLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
