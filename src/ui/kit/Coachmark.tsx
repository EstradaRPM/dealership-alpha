import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/**
 * One step of the first-run spine (issue 213), as the surface it is drawn on
 * receives it: the numbering, the two sentences, and the acknowledgment.
 *
 * A data prop rather than a node, the `hint` idiom — what a step SAYS is
 * `data/spine-steps.json`'s and whether it is still owed is the slot's teaching
 * cell, neither of which a presentation surface should decide.
 */
export interface CoachmarkModel {
  /** The step's catalog id — the whole testID (`coachmark-<id>`, dashed). */
  id: string;
  /** 1-based position, and how many steps the spine has. */
  step: number;
  of: number;
  title: string;
  text: string;
  /** The player has read it. Retires this step and advances the spine. */
  onDone: () => void;
}

/**
 * A first-run coachmark: a bordered callout drawn INSIDE the region whose
 * control the step is about.
 *
 * Anchored by composition, not by measurement. The surface that owns the region
 * renders this, so a step whose region is not on screen produces nothing at all
 * — there is no floating overlay pointing at a room the player is not standing
 * in, because there is never one to place. Presentation only: the one pressable
 * is the acknowledgment, and it reports rather than decides.
 */
export function Coachmark({ model }: { model: CoachmarkModel }) {
  const t = useTheme();
  const key = model.id.replace(/_/g, '-');
  const root: ViewStyle = {
    marginTop: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primaryTint,
    gap: t.spacing.xs,
  };
  const eyebrow: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.primary,
  };
  const title: TextStyle = {
    ...t.typography.bodyStrong,
    color: t.colors.textPrimary,
  };
  const body: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
  };
  const done: ViewStyle = {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    marginTop: t.spacing.xs,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.primaryDim,
  };
  return (
    <View style={root} testID={`coachmark-${key}`}>
      <Text style={eyebrow}>{`Step ${model.step} of ${model.of}`}</Text>
      <Text style={title}>{model.title}</Text>
      <Text style={body}>{model.text}</Text>
      <Pressable
        style={done}
        accessibilityRole="button"
        accessibilityLabel="Got it"
        testID={`coachmark-${key}-done`}
        onPress={model.onDone}
      >
        <Text style={{ ...t.typography.button, color: t.colors.primary }}>
          Got it
        </Text>
        <Icon name="arrow-forward" size="sm" tone="primary" />
      </Pressable>
    </View>
  );
}
