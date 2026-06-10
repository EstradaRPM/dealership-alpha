import React from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';

export interface SectionHeaderProps {
  title: string;
  /** Optional right-aligned accessory — a count, a `Badge`, an action. */
  accessory?: React.ReactNode;
}

/**
 * The uppercase eyebrow that titles a card or section. Optional right-aligned
 * accessory slot for a count or chip. Presentation only.
 */
export function SectionHeader({ title, accessory }: SectionHeaderProps) {
  const t = useTheme();
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const titleText: TextStyle = { ...t.typography.sectionTitle, color: t.colors.textMuted };

  return (
    <View style={row}>
      <Text style={titleText}>{title}</Text>
      {accessory}
    </View>
  );
}
