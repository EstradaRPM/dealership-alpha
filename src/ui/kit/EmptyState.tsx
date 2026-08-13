import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme';
import { Surface } from './Surface';
import { IconBadge } from './IconBadge';
import type { IconName } from './Icon';

export interface EmptyStateProps {
  /** The catalog sentence. Always from `data/empty-states.json` (issue 389). */
  text: string;
  /** Muted glyph saying which region is waiting. Omit for a bare note. */
  icon?: IconName;
  testID?: string;
}

/**
 * A region with nothing in it yet, rendered as a REAL contained note rather
 * than a bare grey sentence floating under a tracked-caps eyebrow (issue 389).
 *
 * Every other band on a tab is a card; an un-contained line of muted text in
 * that stack is what makes the lower half of a page read as an unfinished
 * wireframe even when the copy itself is honest and correct. Home and Growth
 * each hand-rolled this same note before it came onto the barrel — two copies
 * of one idiom, which is how the two pages start looking different about the
 * same fact.
 *
 * Presentation only, like `HintLine`: the caller resolves the sentence through
 * `emptyState(id)` and hands it over. This component never reaches the catalog.
 */
export function EmptyState({ text, icon, testID }: EmptyStateProps) {
  const t = useTheme();
  return (
    <Surface
      variant="inset"
      padded={false}
      testID={testID}
      style={{
        padding: t.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
      }}
    >
      {icon != null && <IconBadge name={icon} tone="muted" variant="soft" size="sm" />}
      <Text style={{ ...t.typography.caption, color: t.colors.textMuted, flex: 1 }}>
        {text}
      </Text>
    </Surface>
  );
}
