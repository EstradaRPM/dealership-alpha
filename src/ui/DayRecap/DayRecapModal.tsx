import React from 'react';
import { View, Modal, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Button } from '../kit';
import { DayRecap, type DayRecapModel } from './DayRecap';

/**
 * The day-close reward beat as a modal (#253). On day close the managerial
 * loop's payoff pops over Home instead of burying the recap card three screens
 * under the fold; it is also reopenable from the Today-region chip. Pure
 * presentation — the composition root owns when it is visible and what model it
 * carries; this only renders the existing `DayRecap` card inside a dismissable
 * scrim. Smoke tests only.
 */
export function DayRecapModal({
  visible,
  model,
  onDismiss,
}: {
  visible: boolean;
  /** The just-closed (or last-persisted) day's recap; null ⇒ nothing to show. */
  model: DayRecapModel | null;
  onDismiss: () => void;
}) {
  const t = useTheme();
  // Nothing to show without a model — never pop an empty sheet.
  if (!model) return null;

  const overlay: ViewStyle = {
    flex: 1,
    backgroundColor: t.colors.scrim,
    justifyContent: 'center',
    padding: t.spacing.xl,
  };
  const sheet: ViewStyle = {
    maxHeight: '88%',
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.md,
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={overlay}>
        <View style={sheet} testID="day-recap-modal">
          <ScrollView
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            <DayRecap model={model} />
          </ScrollView>
          <View style={{ marginTop: t.spacing.sm }}>
            <Button label="Done" onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollInner: { flexGrow: 1 },
});
