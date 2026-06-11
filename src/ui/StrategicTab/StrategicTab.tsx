import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader } from '../kit';

export interface StrategicTabProps {
  /** Surface title, e.g. "People". */
  title: string;
  /** One-line description of what this surface becomes. */
  tagline: string;
}

/**
 * Placeholder for a strategic tab — People · Finance · Growth — whose rebranded
 * surface hasn't been built yet. These tabs are part of the fixed 5-tab IA and
 * are ALWAYS present (navigation is never gated by tier); this just stands in
 * until each tab's real surface lands via its own per-surface rebrand slice. It
 * names what the surface becomes — no tier/unlock framing. Presentation only.
 */
export function StrategicTab({ title, tagline }: StrategicTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const body: ViewStyle = { marginTop: t.spacing.md };
  const tag: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textSecondary,
  };
  const placeholder: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontStyle: 'italic',
    marginTop: t.spacing.md,
  };

  return (
    <View style={region} testID={`strategic-tab-${title.toLowerCase()}`}>
      <SectionHeader title={title} />
      <Surface variant="inset" style={body}>
        <Text style={tag}>{tagline}</Text>
        <Text style={placeholder}>This surface is coming in a later slice.</Text>
      </Surface>
    </View>
  );
}
