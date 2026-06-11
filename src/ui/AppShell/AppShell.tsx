import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { Button } from '../kit';

/**
 * The canonical bottom-tab IA (#215). Five enduring tabs across the whole game;
 * T1 ships only Home + Operations (the rest gate in at #226). The differing nav
 * bars in the mockup PNGs are generation artifacts — this taxonomy is the lock.
 */
export type ShellTabKey = 'home' | 'operations' | 'people' | 'finance' | 'growth';

export interface ShellTab {
  key: ShellTabKey;
  label: string;
  content: React.ReactNode;
}

export interface ShellStat {
  label: string;
  value: string;
}

export interface AppShellProps {
  /** Dealership name shown in the shell header. */
  businessName: string;
  /** Pre-formatted tier line, e.g. "Tier 1 — Micro Lot". */
  tierLabel: string;
  /** Pre-formatted header stat strip (cash / reputation / pressure / tier). */
  stats?: readonly ShellStat[];
  /** Opens the in-session save/load/menu surface. */
  onOpenGameMenu?: () => void;
  /** The fixed 5-tab IA, composed by the caller (see `loadNavTabs`). */
  tabs: readonly ShellTab[];
  /** Which tab is shown first (uncontrolled mode). Defaults to the first tab. */
  initialTabKey?: ShellTabKey;
  /**
   * Controlled active tab. When provided, the shell renders this tab and reports
   * taps via `onTabChange` instead of owning the state. The composition root
   * lifts this so the active tab survives a round-trip through a sub-screen
   * (auction / pricing / a department) — without it, the shell unmounts on
   * navigation and the tab resets to Home on return.
   */
  activeTabKey?: ShellTabKey;
  /** Tap handler for controlled mode. */
  onTabChange?: (key: ShellTabKey) => void;
  /**
   * The pinned primary day action (Next Day / Open Floor). It sits in a fixed
   * footer above the tab bar so day close can never push it below the fold —
   * the capacity problem this shell absorbs (#215).
   */
  primaryAction?: { label: string; onPress: () => void };
}

/**
 * The durable operating console for the management phase (#215). It owns the
 * information architecture — header, tab navigation, pinned day action — while
 * each tab's body is composed-read-model content handed in by the composition
 * root. The live floor is a separate full-screen MODE (entered via START DAY),
 * never a tab, so it is rendered outside this shell.
 */
export function AppShell({
  businessName,
  tierLabel,
  stats = [],
  onOpenGameMenu,
  tabs,
  initialTabKey,
  activeTabKey,
  onTabChange,
  primaryAction,
}: AppShellProps) {
  const t = useTheme();
  const [internalKey, setInternalKey] = useState<ShellTabKey>(
    initialTabKey ?? tabs[0]?.key ?? 'home',
  );
  const controlled = activeTabKey !== undefined;
  const activeKey = controlled ? activeTabKey : internalKey;
  const selectTab = (key: ShellTabKey) => {
    if (!controlled) setInternalKey(key);
    onTabChange?.(key);
  };
  // A tab can disappear under us (tier change); fall back to the first.
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  const root: ViewStyle = { flex: 1, backgroundColor: t.colors.base };
  const header: ViewStyle = {
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.sm,
  };
  const titleRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  };
  const dealershipName: TextStyle = {
    ...t.typography.statValue,
    color: t.colors.primary,
  };
  const tierText: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
  };
  const menuBtn: ViewStyle = {
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radius.sm,
    borderWidth: 1,
    borderColor: t.colors.border,
  };
  const menuBtnText: TextStyle = {
    ...t.typography.badge,
    color: t.colors.textSecondary,
  };
  const statStrip: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: t.spacing.md,
    gap: t.spacing.xxl,
  };
  const statLabel: TextStyle = {
    ...t.typography.statLabel,
    fontSize: 11,
    color: t.colors.textMuted,
  };
  const statValue: TextStyle = {
    ...t.typography.statValue,
    fontSize: 18,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginTop: t.spacing.xxs,
  };
  const footer: ViewStyle = {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.borderMuted,
    backgroundColor: t.colors.base,
  };
  const tabBar: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.surfaceRaised,
  };

  return (
    <View style={root}>
      <View style={header}>
        <View style={titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={dealershipName}>{businessName}</Text>
            <Text style={tierText}>{tierLabel}</Text>
          </View>
          {onOpenGameMenu ? (
            <Pressable
              style={menuBtn}
              accessibilityRole="button"
              accessibilityLabel="Open game menu"
              onPress={onOpenGameMenu}
            >
              <Text style={menuBtnText}>Menu</Text>
            </Pressable>
          ) : null}
        </View>
        {stats.length > 0 && (
          <View style={statStrip}>
            {stats.map((s) => (
              <View key={s.label}>
                <Text style={statLabel}>{s.label}</Text>
                <Text style={statValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.spacing.lg,
          paddingTop: t.spacing.md,
          paddingBottom: t.spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        testID="app-shell-content"
      >
        {active?.content}
      </ScrollView>

      {primaryAction && (
        <View style={footer} testID="app-shell-action-footer">
          <Button label={primaryAction.label} onPress={primaryAction.onPress} />
        </View>
      )}

      <View style={tabBar} testID="app-shell-tabbar" accessibilityRole="tablist">
        {tabs.map((tab) => {
          const selected = tab.key === active?.key;
          const tabStyle: ViewStyle = {
            flex: 1,
            alignItems: 'center',
            paddingVertical: t.spacing.md,
            borderTopWidth: 2,
            borderTopColor: selected ? t.colors.primary : 'transparent',
          };
          const tabLabel: TextStyle = {
            ...t.typography.badge,
            color: selected ? t.colors.primary : t.colors.textMuted,
          };
          return (
            <Pressable
              key={tab.key}
              style={tabStyle}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              onPress={() => selectTab(tab.key)}
            >
              <Text style={tabLabel}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
