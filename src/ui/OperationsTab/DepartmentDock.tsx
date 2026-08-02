import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { Card, IconBadge, Badge, type IconName } from '../kit';
import type { DeptKey } from '../../game/DepartmentQueue';

/**
 * One department the world has stood up (#346). The composition root decides
 * membership — this list IS the dock, and a department with no mechanic behind
 * it at the current tier simply isn't in it (locked IA rule 3: no grayed
 * foreshadow tiles, and the UI layer contains zero unlock logic).
 */
export interface DeptTile {
  readonly key: DeptKey;
  readonly label: string;
  readonly icon: IconName;
  /** Items waiting in this department's queue. 0 renders no badge. */
  readonly badge: number;
  /** One line of plain language: what this room is for right now. */
  readonly status: string;
  /** Full-width tile. The Lot carries the stock pipeline through Act 1. */
  readonly hero: boolean;
}

export interface DepartmentDockProps {
  tiles: readonly DeptTile[];
  onPress: (dept: DeptKey) => void;
}

/**
 * The department dock (#346, locked IA §4): a kit-styled tile grid, two across
 * with a full-width hero row, replacing the legacy `BottomNav` row reuse — a
 * bottom-tab-bar component that had been rendered inline as page content.
 *
 * Pure view. It renders the tiles it is handed and dispatches a `DeptKey`.
 */
export function DepartmentDock({ tiles, onPress }: DepartmentDockProps) {
  const t = useTheme();

  const grid: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.md,
  };
  const tileBase: ViewStyle = {
    padding: t.spacing.lg,
    gap: t.spacing.sm,
  };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.sm,
  };
  const label: TextStyle = {
    ...t.typography.title,
    color: t.colors.textPrimary,
  };
  const status: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
  };

  return (
    <View style={grid} testID="department-dock">
      {tiles.map((tile) => (
        <Pressable
          key={tile.key}
          style={
            tile.hero
              ? { width: '100%' }
              : // Two across, sharing one gutter.
                { flexGrow: 1, flexBasis: '47%' }
          }
          accessibilityRole="button"
          accessibilityLabel={
            tile.badge > 0
              ? `${tile.label}, ${tile.badge} waiting`
              : tile.label
          }
          testID={`dept-tile-${tile.key}`}
          onPress={() => onPress(tile.key)}
        >
          <Card variant="raised" style={tileBase}>
            <View style={headRow}>
              <IconBadge name={tile.icon} tone="accent" variant="soft" />
              {tile.badge > 0 && (
                <Badge label={String(tile.badge)} tone="danger" variant="soft" />
              )}
            </View>
            <Text style={label}>{tile.label}</Text>
            <Text style={status}>{tile.status}</Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
