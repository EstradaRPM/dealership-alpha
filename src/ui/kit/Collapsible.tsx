import React from 'react';
import {
  View,
  Text,
  Pressable,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { Surface, type SurfaceVariant } from './Surface';
import { Icon } from './Icon';

export interface CollapsibleProps {
  /** The panel's name — what the group of things inside it IS. */
  title: string;
  /**
   * Optional leading node, typically an `IconBadge` tile. Gives a panel an
   * identity a player can find again without reading the title.
   */
  leading?: React.ReactNode;
  /**
   * One line under the title, visible whether the panel is open or shut. A shut
   * panel that says nothing about its contents is a box the player has to open
   * to know they can ignore it.
   */
  summary?: string;
  /** Right-aligned node before the chevron — a count, a `Badge`. */
  accessory?: React.ReactNode;
  /**
   * Content rendered under the header whether the panel is open or shut. For
   * the one thing inside a group that cannot wait to be opened — a prompt the
   * player has to answer. Everything else belongs in `children`.
   */
  pinned?: React.ReactNode;
  /** Initial open state when uncontrolled. Default `true`. */
  defaultExpanded?: boolean;
  /** Controlled open state. Supply together with `onToggle`. */
  expanded?: boolean;
  /** Called with the state the header press is asking for. */
  onToggle?: (next: boolean) => void;
  /** Nothing to open — the header renders inert and grows no chevron. */
  disabled?: boolean;
  /** How the panel sits in the depth stack. Default `raised`. */
  variant?: SurfaceVariant;
  /**
   * Apply the standard body gutter. Set `false` when the body is itself a card
   * and would otherwise sit inside two nested paddings.
   */
  bodyPadded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}

/**
 * A headed panel that opens and shuts — the grouping primitive for a surface
 * with more content than one screen of attention.
 *
 * The header is the whole affordance: it states what the group is, how much is
 * in it, and (through `summary` / `accessory`) enough of the answer that a shut
 * panel is still informative. The body **unmounts** while shut rather than
 * hiding — a collapsed group should cost nothing to render, and a hidden-but-
 * mounted subtree is a surface that keeps doing work nobody asked for.
 *
 * Uncontrolled by default (it owns its own open state). Pass `expanded` +
 * `onToggle` when the parent needs to drive it — a group that must open because
 * something inside it demands an answer.
 *
 * Presentation only; no game-logic imports.
 */
export function Collapsible({
  title,
  leading,
  summary,
  accessory,
  pinned,
  defaultExpanded = true,
  expanded,
  onToggle,
  disabled = false,
  variant = 'raised',
  bodyPadded = true,
  style,
  testID,
  children,
}: CollapsibleProps) {
  const t = useTheme();
  const [ownExpanded, setOwnExpanded] = React.useState(defaultExpanded);
  const controlled = expanded !== undefined;
  const open = disabled ? false : controlled ? expanded : ownExpanded;

  const toggle = () => {
    const next = !open;
    if (!controlled) setOwnExpanded(next);
    onToggle?.(next);
  };

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.xl,
  };
  const headerText: ViewStyle = { flex: 1 };
  const titleText: TextStyle = { ...t.typography.bodyStrong, color: t.colors.textPrimary };
  const summaryText: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
  };
  const body: ViewStyle = {
    paddingHorizontal: bodyPadded ? t.spacing.xl : t.spacing.none,
    paddingBottom: bodyPadded ? t.spacing.xl : t.spacing.none,
    // The header already carries a full gutter above; the body only needs the
    // rhythm step that separates it from that header.
    paddingTop: t.spacing.none,
  };

  return (
    <Surface variant={variant} padded={false} style={style} testID={testID}>
      <Pressable
        onPress={disabled ? undefined : toggle}
        disabled={disabled}
        accessibilityRole={disabled ? undefined : 'button'}
        accessibilityState={disabled ? undefined : { expanded: open }}
        accessibilityLabel={summary ? `${title}. ${summary}` : title}
        style={header}
        testID={testID ? `${testID}-header` : undefined}
      >
        {leading}
        <View style={headerText}>
          <Text style={titleText}>{title}</Text>
          {summary != null && <Text style={summaryText}>{summary}</Text>}
        </View>
        {accessory}
        {!disabled && (
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size="sm" tone="muted" />
        )}
      </Pressable>
      {pinned != null && <View style={body}>{pinned}</View>}
      {open && (
        <View style={body} testID={testID ? `${testID}-body` : undefined}>
          {children}
        </View>
      )}
    </Surface>
  );
}
