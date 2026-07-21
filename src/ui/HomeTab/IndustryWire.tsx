import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, Badge, Icon, type BadgeTone } from '../kit';
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
}

/**
 * The Home-screen industry wire (#176): the last N headlines, newest first,
 * each stamped with who said it and how much it's worth. The legend is
 * collapsed behind a tap because it teaches once and then just takes room.
 */
export function IndustryWire({ model }: IndustryWireProps) {
  const t = useTheme();
  const [legendOpen, setLegendOpen] = React.useState(false);

  const caption: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const divider: ViewStyle = {
    height: 1,
    backgroundColor: t.colors.border,
    marginVertical: t.spacing.md,
  };

  if (model.headlines.length === 0) {
    return (
      <Surface testID="industry-wire">
        <Text style={caption}>
          Nothing on the wire yet. Reports start coming in as the market moves.
        </Text>
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
              tone={RELIABILITY_TONE[h.reliability]}
              variant="soft"
              textCase="caps"
            />
            <Text style={{ ...caption, flex: 1 }} numberOfLines={1}>
              {h.sourceLabel}
            </Text>
            <Text style={caption}>{h.dayLabel}</Text>
          </View>
          <Text style={{ ...t.typography.body, color: t.colors.textPrimary }}>
            {h.text}
          </Text>
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
    </Surface>
  );
}
