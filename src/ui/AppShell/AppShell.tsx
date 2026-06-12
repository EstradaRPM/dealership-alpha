import React, { useContext, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type ScrollView,
  type ViewStyle,
  type TextStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Button, Icon, Gradient, type IconName } from '../kit';

/**
 * The canonical bottom-tab IA (#215). Five enduring tabs across the whole game;
 * T1 ships only Home + Operations (the rest gate in at #226). The differing nav
 * bars in the mockup PNGs are generation artifacts — this taxonomy is the lock.
 */
export type ShellTabKey = 'home' | 'operations' | 'people' | 'finance' | 'growth';

/**
 * Tab glyphs (#241). Keyed by the closed ShellTabKey union so a new tab can't
 * ship without an icon; the glyph choice lives here with the IA, not in data —
 * Ionicons names are a presentation detail of this nav, like the mockup art.
 */
const TAB_ICONS: Record<ShellTabKey, IconName> = {
  home: 'home',
  operations: 'storefront',
  people: 'people',
  finance: 'cash',
  growth: 'trending-up',
};

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
  /** Pre-formatted header stat strip (reg pressure today; room for more). */
  stats?: readonly ShellStat[];
  /**
   * Tier-keyed lot/building art rendered as the header's physical background —
   * the hero is the page's backdrop, not a card in the scroll (home-hub mockup).
   * Absent ⇒ themed gradient placeholder (tests, art not yet landed).
   */
  heroSource?: ImageSourcePropType;
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

/** Collapsed identity-bar body height, below the status-bar inset. */
const BAR_BODY = 52;
/** Tallest the hero backdrop runs (below the status-bar inset). */
const HERO_BODY_MAX = 236;
/** Hero backdrop height as a fraction of screen width (2:1-ish art, cropped). */
const HERO_BODY_RATIO = 0.52;
/** How far the first content card tucks up over the hero's bottom fade. */
const CARD_OVERLAP = 24;

/**
 * The durable operating console for the management phase (#215). It owns the
 * information architecture — collapsing hero header, tab navigation, pinned day
 * action — while each tab's body is composed-read-model content handed in by
 * the composition root. The live floor is a separate full-screen MODE (entered
 * via START DAY), never a tab, so it is rendered outside this shell.
 *
 * Header anatomy (home-hub mockup): the hero art is a fixed full-bleed backdrop
 * behind the scroll — content cards slide up OVER it — and the identity bar
 * (name / tier / reg pressure / menu) is pinned above both, with a scrim
 * guaranteeing text legibility. As the user scrolls, the hero parallaxes and
 * dims, the stacked tier+stat block fades out while a single-line compact
 * readout fades in, and the bar grows an opaque backdrop — a smooth, scroll-
 * driven collapse running entirely on the native driver.
 */
export function AppShell({
  businessName,
  tierLabel,
  stats = [],
  heroSource,
  onOpenGameMenu,
  tabs,
  initialTabKey,
  activeTabKey,
  onTabChange,
  primaryAction,
}: AppShellProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  // Context (not the hook) so the shell still renders standalone in tests with
  // no SafeAreaProvider; in the app the provider is mounted at the root.
  const insets = useContext(SafeAreaInsetsContext) ?? {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };

  const heroHeight = Math.round(
    insets.top + Math.min(width * HERO_BODY_RATIO, HERO_BODY_MAX),
  );
  const barHeight = insets.top + BAR_BODY;
  // The scroll distance over which the header fully collapses.
  const range = Math.max(heroHeight - barHeight, 1);

  const [internalKey, setInternalKey] = useState<ShellTabKey>(
    initialTabKey ?? tabs[0]?.key ?? 'home',
  );
  const controlled = activeTabKey !== undefined;
  const activeKey = controlled ? activeTabKey : internalKey;
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const selectTab = (key: ShellTabKey) => {
    if (key !== activeKey) {
      // A tab change is a new page: reset to the expanded header instantly so
      // the next tab never starts half-collapsed.
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      scrollY.setValue(0);
    }
    if (!controlled) setInternalKey(key);
    onTabChange?.(key);
  };
  // A tab can disappear under us (tier change); fall back to the first.
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  // --- Scroll-driven header choreography (all native-driver-safe props) ---
  /** Hero parallax: drifts up at ~1/3 scroll speed instead of sitting frozen. */
  const heroShift = scrollY.interpolate({
    inputRange: [0, range],
    outputRange: [0, -range * 0.35],
    extrapolate: 'clamp',
  });
  /** iOS pull-down: the hero stretches from its top edge instead of tearing. */
  const heroStretch = scrollY.interpolate({
    inputRange: [-160, 0],
    outputRange: [1.45, 1],
    extrapolate: 'clamp',
  });
  /** The art dims toward the scrim as it slims, so it reads less pronounced. */
  const heroDim = scrollY.interpolate({
    inputRange: [0, range * 0.35, range],
    outputRange: [0, 0.1, 1],
    extrapolate: 'clamp',
  });
  /** Stacked tier line + stat block: gone by mid-collapse. */
  const metaOpacity = scrollY.interpolate({
    inputRange: [0, range * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const metaShift = scrollY.interpolate({
    inputRange: [0, range * 0.55],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });
  /** Single-line compact readout: fades in as the stacked block leaves. */
  const compactOpacity = scrollY.interpolate({
    inputRange: [range * 0.6, range],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  /** The bar earns an opaque backdrop once cards start sliding beneath it. */
  const barBgOpacity = scrollY.interpolate({
    inputRange: [range * 0.45, range],
    outputRange: [0, 0.97],
    extrapolate: 'clamp',
  });
  /** The dealership name settles slightly smaller in the collapsed bar. */
  const titleScale = scrollY.interpolate({
    inputRange: [0, range],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });

  const root: ViewStyle = { flex: 1, backgroundColor: t.colors.base };
  const dealershipName: TextStyle = {
    ...t.typography.title,
    color: t.colors.textPrimary,
  };
  const tierText: TextStyle = {
    ...t.typography.statLabel,
    color: t.colors.textSecondary,
    marginTop: t.spacing.xxs,
  };
  const menuBtn: ViewStyle = {
    width: 38,
    height: 38,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.neutralTint,
    borderWidth: 1,
    borderColor: t.colors.border,
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
  const compactStat: TextStyle = {
    ...t.typography.badge,
    color: t.colors.textSecondary,
    fontVariant: ['tabular-nums'],
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
      {/* Hero backdrop — the page's physical background. Content scrolls OVER
          it; it never participates in layout, only in the scroll choreography. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: heroHeight,
          overflow: 'hidden',
        }}
        pointerEvents="none"
        testID="app-shell-hero"
      >
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            transformOrigin: 'top',
            transform: [{ translateY: heroShift }, { scale: heroStretch }],
          }}
        >
          {heroSource ? (
            <Image
              source={heroSource}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Gradient gradient="primaryDim" style={StyleSheet.absoluteFill} />
          )}
        </Animated.View>
        {/* Legibility scrim behind the identity text + translucent status bar. */}
        <Gradient
          gradient="heroScrimTop"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 118,
          }}
        />
        {/* Bottom fade into `base` so the first cards float with no hard seam. */}
        <Gradient
          gradient="heroScrimBottom"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96 }}
        />
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: t.colors.scrim,
            opacity: heroDim,
          }}
        />
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: heroHeight - CARD_OVERLAP,
          paddingHorizontal: t.spacing.lg,
          paddingBottom: t.spacing.xl,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        testID="app-shell-content"
      >
        {active?.content}
      </Animated.ScrollView>

      {/* Identity bar — pinned over hero AND scrolling content. */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="box-none"
        testID="app-shell-header"
      >
        {/* Opaque backdrop, sized to the COLLAPSED bar, fading in as content
            slides beneath — the "darker, less pronounced" end state. */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: barHeight,
            opacity: barBgOpacity,
          }}
          pointerEvents="none"
        >
          <Gradient gradient="surface" style={StyleSheet.absoluteFill} />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: t.colors.borderMuted,
            }}
          />
        </Animated.View>

        <View
          style={{
            paddingTop: insets.top + t.spacing.sm,
            paddingHorizontal: t.spacing.xl,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: t.spacing.md,
          }}
          pointerEvents="box-none"
        >
          <View style={{ flex: 1 }} pointerEvents="none">
            <Animated.View
              style={{
                alignSelf: 'flex-start',
                transformOrigin: 'left top',
                transform: [{ scale: titleScale }],
              }}
            >
              <Text style={dealershipName} numberOfLines={1}>
                {businessName}
              </Text>
            </Animated.View>
            {/* Expanded-only meta: tier line + stacked stat block. */}
            <Animated.View
              style={{ opacity: metaOpacity, transform: [{ translateY: metaShift }] }}
            >
              <Text style={tierText}>{tierLabel}</Text>
              {stats.length > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginTop: t.spacing.sm,
                    gap: t.spacing.xxl,
                  }}
                >
                  {stats.map((s) => (
                    <View key={s.label}>
                      <Text style={statLabel}>{s.label}</Text>
                      <Text style={statValue}>{s.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          </View>

          {/* Collapsed-only: the same stats on a single inline line. */}
          {stats.length > 0 && (
            <Animated.View
              style={{
                opacity: compactOpacity,
                alignSelf: 'center',
                alignItems: 'flex-end',
              }}
              pointerEvents="none"
            >
              {stats.map((s) => (
                <Text key={s.label} style={compactStat}>
                  {`${s.label} ${s.value}`}
                </Text>
              ))}
            </Animated.View>
          )}

          {onOpenGameMenu ? (
            <Pressable
              style={menuBtn}
              accessibilityRole="button"
              accessibilityLabel="Open game menu"
              onPress={onOpenGameMenu}
            >
              <Icon name="menu" size="md" tone="primary" />
            </Pressable>
          ) : null}
        </View>
      </View>

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
            gap: t.spacing.xxs,
            paddingVertical: t.spacing.sm,
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
              <Icon
                name={TAB_ICONS[tab.key]}
                size="md"
                tone={selected ? 'primary' : 'muted'}
              />
              <Text style={tabLabel}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
