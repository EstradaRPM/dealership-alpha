import React from 'react';
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Button, Badge } from '../kit';
import type { RecoveryBeat } from './recoveryBeat';

interface Props {
  visible: boolean;
  beat: RecoveryBeat;
  onConfirm: () => void;
}

/**
 * The recovery narrative beat (#326). A full-bleed acknowledge-card shown the
 * moment a survivable hit lands — a tier contraction or a consent decree. It is
 * deliberately NOT the terminal `EndCard`: the framing is "you took a hit and
 * are climbing back," so it carries a "SETBACK" chip (not GAME OVER), a
 * reward-amber accent (resilience, not the danger-red of a terminal end), and a
 * "Keep going" action instead of the end-card's run-summary dismissal. It drains
 * from the same non-terminal overlay channel as `ChapterCard` (one at a time,
 * FIFO), never from the `nav.reset('end-card')` terminal path.
 */
export function RecoveryBeatCard({ visible, beat, onConfirm }: Props) {
  const t = useTheme();
  const s = styles(t);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={s.overlay}>
        <ScrollView contentContainerStyle={s.card}>
          <Badge label="Setback" tone="reward" variant="soft" />
          <Text style={s.title}>{beat.title}</Text>

          <View style={s.divider} />

          <Text style={s.sectionLabel}>What happened</Text>
          <Text style={s.body}>{beat.cause}</Text>

          <Text style={s.sectionLabel}>What it cost</Text>
          <Text style={s.body}>{beat.cost}</Text>

          <Text style={s.sectionLabel}>Climbing back</Text>
          <Text style={s.body}>{beat.path}</Text>

          <View style={s.actionWrap}>
            <Button label="Keep going" onPress={onConfirm} size="hero" />
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
      borderTopColor: t.colors.reward,
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
