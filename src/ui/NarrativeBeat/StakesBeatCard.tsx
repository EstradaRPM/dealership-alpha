import React from 'react';
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Button, Badge } from '../kit';
import type { StakesBeat } from './stakesBeat';

interface Props {
  visible: boolean;
  beat: StakesBeat;
  onConfirm: () => void;
}

/**
 * The failure-stakes card (#394). Same full-bleed acknowledge grammar as
 * `RecoveryBeatCard`, deliberately NOT the same card: a recovery beat is what
 * the store lost, and this is what it still stands to lose. So the chip reads
 * "Heads up" rather than "Setback", the sections are a warning's three
 * questions rather than a post-mortem's, and the action is an acknowledgement
 * ("Got it") rather than the recovery card's "Keep going".
 *
 * The danger accent is the honest one here — unlike a recovery beat, nothing
 * has been survived yet.
 */
export function StakesBeatCard({ visible, beat, onConfirm }: Props) {
  const t = useTheme();
  const s = styles(t);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={s.overlay}>
        <ScrollView contentContainerStyle={s.card} testID="stakes-beat-card">
          <Badge label="Heads up" tone="danger" variant="soft" />
          <Text style={s.title}>{beat.title}</Text>

          <View style={s.divider} />

          <Text style={s.sectionLabel}>Where you stand</Text>
          <Text style={s.body}>{beat.cause}</Text>

          <Text style={s.sectionLabel}>What happens if it runs out</Text>
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

const styles = (t: ReturnType<typeof useTheme>) =>
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
      borderTopColor: t.colors.danger,
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
