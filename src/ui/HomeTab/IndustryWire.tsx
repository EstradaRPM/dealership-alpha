import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, Badge, Button, Icon, type BadgeTone } from '../kit';
import type { IndustryWireModel, WireReliability } from './industryWireModel';

/**
 * Trust-badge tone per reliability tier. The tone is the *only* visual encoding
 * of trust beyond the word itself, and the word always leads — a player who
 * can't distinguish the colors still reads "Confirmed" / "Rumor" / "Recap".
 */
const RELIABILITY_TONE: Record<WireReliability, BadgeTone> = {
  direct: 'positive',
  leading: 'reward',
  lagging: 'neutral',
};

export interface IndustryWireProps {
  model: IndustryWireModel;
  /**
   * Toggle a wire subscription (#178). Omit to render the footer read-only —
   * the hints still say what would open each lane.
   */
  onToggleSubscription?: (id: string, on: boolean) => void;
}

/**
 * The Home-screen industry wire (#176): the last N headlines, newest first,
 * each stamped with who said it and how much it's worth. The legend is
 * collapsed behind a tap because it teaches once and then just takes room.
 *
 * **Access gating (#178).** A lane the player hasn't opened still occupies its
 * row in the chronology — dimmed, padlocked, naming who filed it but not what
 * they said. That is deliberate: the wire has to make what you're *not* reading
 * as visible as what you are, or a subscription is a purchase with no felt
 * absence behind it. The footer names each closed door and, for a subscription
 * the player's tier already sells them, buys it right there.
 */
export function IndustryWire({ model, onToggleSubscription }: IndustryWireProps) {
  const t = useTheme();
  const [legendOpen, setLegendOpen] = React.useState(false);

  const caption: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const divider: ViewStyle = {
    height: 1,
    backgroundColor: t.colors.border,
    marginVertical: t.spacing.md,
  };

  const unlocksFooter =
    model.unlocks.length > 0 ? (
      <>
        <View style={divider} />
        <Text
          style={{ ...t.typography.label, color: t.colors.textSecondary }}
          testID="wire-unlocks-heading"
        >
          {model.unlocksHeading}
        </Text>
        {model.unlocks.map((u) => (
          <View
            key={u.id}
            style={{ marginTop: t.spacing.sm }}
            testID={`wire-unlock-${u.id}`}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.sm,
              }}
            >
              <Icon name={u.active ? 'checkmark' : 'lock-closed'} size="sm" tone="muted" />
              <Text
                style={{ ...t.typography.body, color: t.colors.textPrimary, flex: 1 }}
              >
                {u.label}
              </Text>
              {u.withheldLabel != null && (
                <Badge label={u.withheldLabel} tone="neutral" variant="soft" />
              )}
            </View>
            <Text style={{ ...caption, marginTop: t.spacing.xs }}>
              {u.active ? u.blurb : u.hint}
            </Text>
            {u.costNote != null && (
              <Text style={{ ...caption, marginTop: t.spacing.xs }}>{u.costNote}</Text>
            )}
            {u.actionLabel != null && onToggleSubscription != null && (
              <View style={{ marginTop: t.spacing.sm, alignSelf: 'flex-start' }}>
                <Button
                  label={u.actionLabel}
                  variant={u.active ? 'ghost' : 'primary'}
                  onPress={() => onToggleSubscription(u.id, !u.active)}
                  testID={`wire-unlock-action-${u.id}`}
                />
              </View>
            )}
          </View>
        ))}
      </>
    ) : null;

  if (model.headlines.length === 0) {
    return (
      <Surface testID="industry-wire">
        <Text style={caption}>
          Nothing on the wire yet. Reports start coming in as the market moves.
        </Text>
        {unlocksFooter}
      </Surface>
    );
  }

  return (
    <Surface testID="industry-wire">
      {model.headlines.map((h, i) => (
        <View key={h.id} testID={`wire-headline-${h.id}`}>
          {i > 0 && <View style={divider} />}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              marginBottom: t.spacing.xs,
            }}
          >
            <Badge
              label={h.reliabilityLabel}
              tone={h.locked ? 'neutral' : RELIABILITY_TONE[h.reliability]}
              variant="soft"
              textCase="caps"
            />
            <Text style={{ ...caption, flex: 1 }} numberOfLines={1}>
              {h.sourceLabel}
            </Text>
            <Text style={caption}>{h.dayLabel}</Text>
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
          >
            {h.locked && <Icon name="lock-closed" size="sm" tone="muted" />}
            <Text
              style={{
                ...t.typography.body,
                color: h.locked ? t.colors.textMuted : t.colors.textPrimary,
                flex: 1,
              }}
              testID={h.locked ? `wire-headline-locked-${h.id}` : undefined}
            >
              {h.text}
            </Text>
          </View>
        </View>
      ))}

      {model.legend.length > 0 && (
        <>
          <View style={divider} />
          <Pressable
            onPress={() => setLegendOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              legendOpen ? 'Hide what the tags mean' : 'Show what the tags mean'
            }
            testID="wire-legend-toggle"
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
            >
              <Text style={{ ...caption, flex: 1 }}>What do these tags mean?</Text>
              <Icon
                name={legendOpen ? 'chevron-up' : 'chevron-down'}
                size="sm"
                tone="muted"
              />
            </View>
          </Pressable>
          {legendOpen && (
            <View style={{ marginTop: t.spacing.sm }} testID="wire-legend">
              {model.legend.map((entry) => (
                <View
                  key={entry.reliability}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: t.spacing.sm,
                    marginTop: t.spacing.xs,
                  }}
                >
                  <Badge
                    label={entry.label}
                    tone={RELIABILITY_TONE[entry.reliability]}
                    variant="soft"
                    textCase="caps"
                  />
                  <Text style={{ ...caption, flex: 1 }}>{entry.note}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {unlocksFooter}
    </Surface>
  );
}
