import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { RevealModel, RevealReaction, RevealReactionTone } from './buildReveal';

/**
 * The reusable Reveal renderer (#319): a plain-language scoreline plus the
 * starred-reaction feed. Built once — later plug-ins (individual sale
 * reactions, F&I, higher-tier zooms) grow `reactions[]` without touching this
 * component. Read-only; dispatches nothing.
 */
export function Reveal({ model }: { model: RevealModel }) {
  const t = useTheme();
  return (
    <View>
      <Text
        style={[
          t.typography.body,
          styles.scoreline,
          { color: t.colors.textPrimary },
        ]}
      >
        {model.scoreline}
      </Text>
      {model.reactions.map((reaction) => (
        <ReactionRow key={reaction.id} reaction={reaction} />
      ))}
    </View>
  );
}

function toneColor(t: ReturnType<typeof useTheme>, tone: RevealReactionTone): string {
  switch (tone) {
    case 'positive':
      return t.colors.positive;
    case 'negative':
      return t.colors.danger;
    case 'neutral':
      return t.colors.textSecondary;
  }
}

function ReactionRow({ reaction }: { reaction: RevealReaction }) {
  const t = useTheme();
  return (
    <View style={[styles.reactionRow, { marginTop: t.spacing.sm }]}>
      <View
        style={[styles.dot, { backgroundColor: toneColor(t, reaction.tone) }]}
      />
      <Text
        style={[t.typography.label, styles.reactionText, { color: toneColor(t, reaction.tone) }]}
      >
        {reaction.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreline: { fontWeight: '700' },
  reactionRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8 },
  reactionText: { flex: 1 },
});
