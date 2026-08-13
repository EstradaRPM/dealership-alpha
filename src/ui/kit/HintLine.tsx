import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { useTheme } from '../theme';

export interface HintLineProps {
  /**
   * The hint's id, exactly as `data/hints.json` declares it. It is the whole
   * testID: `hint-<id>` with the underscores spelled as dashes, minted here so
   * one line cannot be addressed by two names across the twenty-odd surfaces
   * that draw one.
   */
  id: string;
  /** The hint's copy. Always from `data/hints.json`, never a literal here. */
  text: string;
}

/**
 * One consequence hint (issue 386): a muted line under a control saying what
 * moving it costs the store.
 *
 * Presentation only, and deliberately not pressable — whether a hint is still
 * owed is the app layer's read of the slot's teaching cell, and the surface
 * above simply omits this when the answer is no. It is also what keeps the
 * pressable-count assertions on the lever surfaces honest: a hint adds text to
 * a control, never another thing to tap.
 */
export function HintLine({ id, text }: HintLineProps) {
  const t = useTheme();
  const line: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.sm,
  };
  return (
    <Text style={line} testID={`hint-${id.replace(/_/g, '-')}`}>
      {text}
    </Text>
  );
}
