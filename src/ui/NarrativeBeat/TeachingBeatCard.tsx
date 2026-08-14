import React from 'react';
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Button, Badge } from '../kit';
import type { TeachingBeatModel } from './teachingBeat';

interface Props {
  visible: boolean;
  beat: TeachingBeatModel;
  onConfirm: () => void;
}

/**
 * The teaching-beat card (#394, generalized by #395). Same full-bleed
 * acknowledge grammar as `RecoveryBeatCard`, deliberately NOT the same card: a
 * recovery beat is what the store lost, and a teaching beat is what the store
 * is now able to lose — or earn. So the action is an acknowledgement ("Got it")
 * rather than the recovery card's "Keep going".
 *
 * **One card, one grammar, every beat.** The chip and its accent come from the
 * catalog (a warning is `danger`, a mechanic coming into reach is `info`) and
 * the three section headers are generic on purpose: they are the same three
 * questions of every beat — what is happening, why it matters, what you can do
 * — so a beat added next year needs four sentences and no layout. Per-beat
 * headers would be three more strings to review for a distinction the player
 * never makes.
 */
export function TeachingBeatCard({ visible, beat, onConfirm }: Props) {
  const t = useTheme();
  const s = styles(t, beat.tone === 'danger' ? t.colors.danger : t.colors.accent);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={s.overlay}>
        <ScrollView contentContainerStyle={s.card} testID="teaching-beat-card">
          <Badge label={beat.badge} tone={beat.tone} variant="soft" />
          <Text style={s.title} testID="teaching-beat-title">
            {beat.title}
          </Text>

          <View style={s.divider} />

          <Text style={s.sectionLabel}>What&apos;s happening</Text>
          <Text style={s.body}>{beat.cause}</Text>

          <Text style={s.sectionLabel}>Why it matters</Text>
          <Text style={s.body}>{beat.cost}</Text>

          <Text style={s.sectionLabel}>What you can do</Text>
          <Text style={s.body}>{beat.path}</Text>

          <View style={s.actionWrap}>
            <Button label="Got it" onPress={onConfirm} size="hero" />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (t: ReturnType<typeof useTheme>, accent: string) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: t.spacing.lg,
    },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderTopWidth: 3,
      borderTopColor: accent,
      padding: t.spacing.xxl,
      width: 340,
      maxWidth: '100%',
    },
    title: {
      ...t.typography.title,
      color: t.colors.textPrimary,
      marginTop: t.spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: t.colors.border,
      marginVertical: t.spacing.lg,
    },
    sectionLabel: {
      ...t.typography.badge,
      color: t.colors.textMuted,
      marginBottom: t.spacing.xs,
    },
    body: {
      ...t.typography.body,
      color: t.colors.textSecondary,
      marginBottom: t.spacing.lg,
    },
    actionWrap: {
      marginTop: t.spacing.xs,
    },
  });
