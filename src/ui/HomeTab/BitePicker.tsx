import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Button, Icon } from '../kit';
import type { BiteOption } from '../../game/ClockBite';

/**
 * The **bite picker** (B4 S1, #381) — how big a bite of the calendar to run
 * before you look again. It sits in the pinned day-action footer, directly
 * above the day CTA, so the whole zoom ladder is one control in one place.
 *
 * Only bites ABOVE the day are rendered here: the day is the live floor and
 * keeps the shell's hero CTA with its intra-day pause/speed control. Running
 * the day headless would delete the floor view, which is the opposite of what
 * B4 extends.
 *
 * A locked bite renders **with its door stated in plain language** — never
 * hidden, never a silently greyed control. The sentence arrives pre-phrased
 * from `availableBites`; nothing is worded here.
 *
 * An open bite renders **with its stakes stated under the control** (#383): the
 * bite is a bet, and a bet you cannot read before placing is not a decision.
 * That sentence is pre-phrased too — the whole picker words nothing.
 */
export function BitePicker({
  options,
  onRun,
  disabled,
}: {
  options: readonly BiteOption[];
  onRun: (biteId: BiteOption['id']) => void;
  /** The floor is open / an overlay is up — a bite can't start from here. */
  disabled?: boolean;
}) {
  const t = useTheme();
  const bigger = options.filter((o) => o.days > 1);
  if (bigger.length === 0) return null;
  return (
    <View testID="bite-picker" style={{ marginBottom: t.spacing.md }}>
      {bigger.map((option, i) =>
        option.unlocked ? (
          <View key={option.id} style={{ marginTop: i === 0 ? 0 : t.spacing.sm }}>
            <Button
              label={option.label}
              variant="secondary"
              icon="calendar"
              onPress={() => onRun(option.id)}
              disabled={disabled}
              testID={`bite-run-${option.id}`}
            />
            {option.stakes ? (
              <Text
                testID={`bite-stakes-${option.id}`}
                style={{
                  ...t.typography.caption,
                  color: t.colors.textSecondary,
                  marginTop: t.spacing.xs,
                }}
              >
                {option.stakes}
              </Text>
            ) : null}
          </View>
        ) : (
          <View
            key={option.id}
            testID={`bite-locked-${option.id}`}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: t.spacing.sm,
              marginTop: i === 0 ? 0 : t.spacing.sm,
              paddingVertical: t.spacing.sm,
            }}
          >
            <Icon name="lock-closed" size="sm" tone="muted" />
            <Text
              style={{
                ...t.typography.caption,
                color: t.colors.textSecondary,
                flexShrink: 1,
              }}
            >
              {`${option.label}: ${option.lockedReason ?? ''}`}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}
