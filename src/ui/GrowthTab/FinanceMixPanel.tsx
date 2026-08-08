import React from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, Icon, ProgressBar } from '../kit';
import type { FinanceMixModel, FinanceMixRow } from './financeMixModel';

export interface FinanceMixPanelProps {
  model: FinanceMixModel;
}

/**
 * How the coming crowd pays (#371) — the read the finance posture is set
 * against, sitting with the wire because it is bought or hired the same way.
 *
 * Closed, it names EVERY way in rather than the first one: the lane opens on a
 * paid feed or on an F&I manager, and a locked row that mentioned only the
 * subscription would be selling a player something the hire already gives them.
 */
export function FinanceMixPanel({ model }: FinanceMixPanelProps) {
  const t = useTheme();
  const caption: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const rowStyle: ViewStyle = { marginTop: t.spacing.sm };

  if (!model.open) {
    return (
      <Surface variant="inset" testID="finance-mix-locked">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Icon name="lock-closed" size="sm" tone="muted" />
          <Text style={{ ...t.typography.body, color: t.colors.textSecondary, flex: 1 }}>
            {model.lockedNote}
          </Text>
        </View>
        {model.doors.map((door) => (
          <View key={door.id} style={rowStyle} testID={`finance-mix-door-${door.id}`}>
            <Text style={{ ...t.typography.label, color: t.colors.textSecondary }}>
              {door.label}
            </Text>
            <Text style={{ ...caption, marginTop: t.spacing.xs }}>{door.hint}</Text>
          </View>
        ))}
      </Surface>
    );
  }

  return (
    <Surface testID="finance-mix-panel">
      <Text style={caption}>{model.note}</Text>
      {model.paymentRows.map((row) => (
        <ShareRow key={row.id} row={row} testID={`finance-mix-payment-${row.id}`} />
      ))}
      <Text
        style={{
          ...t.typography.label,
          color: t.colors.textSecondary,
          marginTop: t.spacing.lg,
        }}
      >
        {model.creditHeading}
      </Text>
      {model.creditRows.map((row) => (
        <ShareRow key={row.id} row={row} testID={`finance-mix-credit-${row.id}`} />
      ))}
    </Surface>
  );
}

function ShareRow({ row, testID }: { row: FinanceMixRow; testID: string }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.spacing.sm }} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Text style={{ ...t.typography.body, color: t.colors.textPrimary, flex: 1 }}>
          {row.label}
        </Text>
        <Text style={{ ...t.typography.body, color: t.colors.textPrimary }}>
          {row.value}
        </Text>
      </View>
      <View style={{ marginTop: t.spacing.xs }}>
        <ProgressBar value={row.share} />
      </View>
    </View>
  );
}
