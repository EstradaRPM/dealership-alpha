import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Icon, type IconName } from '../kit';
import type { RecoveryBannerModel, RecoveryBannerKind } from './recoveryBeat';

interface Props {
  banners: readonly RecoveryBannerModel[];
}

const ICON_BY_KIND: Record<RecoveryBannerKind, IconName> = {
  'debt-overhang': 'wallet',
  'license-suspension': 'calendar',
};

/**
 * The persistent recovery banner (#326): a pinned strip that stays visible while
 * a recovery state is still active (debt overhang paying down, or a license
 * suspension window ticking). Renders nothing when no state is active, so it
 * costs zero footprint in the common case and clears itself the instant the
 * underlying persisted state resolves. Reward-amber to read as "climbing back,"
 * matching the beat's accent — not the danger-red of a terminal end.
 */
export function RecoveryBanner({ banners }: Props) {
  const t = useTheme();
  if (banners.length === 0) return null;
  const s = styles(t);

  return (
    <View style={s.wrap} testID="recovery-banner">
      {banners.map((b) => (
        <View key={b.kind} style={s.row} accessibilityRole="text">
          <Icon name={ICON_BY_KIND[b.kind]} size="sm" tone="reward" />
          <View style={s.copy}>
            <Text style={s.headline}>{b.headline}</Text>
            <Text style={s.detail}>{b.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: {
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      backgroundColor: t.colors.surfaceRaised,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.reward,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    } as ViewStyle,
    copy: {
      flex: 1,
    },
    headline: {
      ...t.typography.label,
      color: t.colors.textPrimary,
    },
    detail: {
      ...t.typography.caption,
      color: t.colors.textMuted,
    },
  });
