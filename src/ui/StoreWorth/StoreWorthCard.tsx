import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { IconBadge } from '../kit';
import type { StoreWorthModel } from './storeWorthModel';

/**
 * The store's position (#380), rendered.
 *
 * Two components over one model, because the two rooms arrive with different
 * halves already on the page. The Home HUD has carried a cash headline since
 * #230 (with the #255 ops/stock delta under it) and needs only the worth line
 * beneath it; the Finance room has no cash figure at all and takes the pair.
 * Both draw their copy from `buildStoreWorth`, so the pair is one statement in
 * two places rather than two statements that happen to agree today.
 *
 * Presentation only — every string arrives pre-formatted.
 */

export interface StoreWorthLineProps {
  model: StoreWorthModel;
  testID?: string;
}

/**
 * The worth half on its own: label, figure, and the sentence that says what it
 * sums. Sized as a secondary reading — **cash stays the primary number** on
 * every surface, because cash is the constraint the whole game branches on and
 * a bigger worth figure beside it would be a lie of a different kind.
 */
export function StoreWorthLine({ model, testID }: StoreWorthLineProps) {
  const t = useTheme();
  return (
    <View testID={testID ?? 'store-worth-line'}>
      <Text style={{ ...t.typography.statLabel, color: t.colors.textMuted }}>
        {model.worthLabel}
      </Text>
      <Text
        style={{ ...t.typography.bodyStrong, color: t.colors.textPrimary }}
        testID="store-worth-value"
      >
        {model.worthValue}
      </Text>
      <Text
        style={{
          ...t.typography.caption,
          color: t.colors.textMuted,
          marginTop: t.spacing.xxs,
        }}
      >
        {model.worthCaption}
      </Text>
    </View>
  );
}

export interface StoreWorthPairProps {
  model: StoreWorthModel;
  testID?: string;
}

/** Cash on Hand as the headline, the worth line under a hairline beneath it. */
export function StoreWorthPair({ model, testID }: StoreWorthPairProps) {
  const t = useTheme();
  return (
    <View testID={testID ?? 'store-worth-pair'}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          marginBottom: t.spacing.sm,
        }}
      >
        <IconBadge name="cash" tone="positive" variant="solid" size="sm" />
        <Text style={{ ...t.typography.statLabel, color: t.colors.textMuted }}>
          {model.cashLabel}
        </Text>
      </View>
      <Text
        style={{ ...t.typography.statValue, color: t.colors.textPrimary }}
        testID="store-worth-cash-value"
      >
        {model.cashValue}
      </Text>
      <View
        style={{
          height: 1,
          backgroundColor: t.colors.border,
          marginVertical: t.spacing.md,
        }}
      />
      <StoreWorthLine model={model} />
    </View>
  );
}
