import React, { useContext, useEffect, useRef, useState } from 'react';
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
import { Button, Icon, Gradient, Pill, type IconName, type BadgeTone } from '../kit';

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
  /**
   * Optional semantic tone so a status reads as a glanceable dial — the
   * reg-pressure chip shifts green→amber→red as it climbs. The composition root
   * maps the live value to a tone; the view just paints the rim + value in it.
   */
  tone?: BadgeTone;
}

export interface AppShellProps {
  /** Dealership name shown in the shell header. */
  businessName: string;
  /** Pre-formatted tier line, e.g. "Tier 1 — Micro Lot". */
  tierLabel: string;
  /** Short tier tag (e.g. "T1") for the collapsed single-line readout. */
  tierCompact?: string;
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
  primaryAction?: {
    label: string;
    onPress: () => void;
    /** Leading glyph on the CTA face. Default: the checkered start flag. */
    icon?: IconName;
    /**
     * The bite picker (#381), pinned directly ABOVE the day CTA inside the same
     * footer — the calendar-zoom ladder and the day verb are one control in one
     * place. A node rather than a data prop (the `banner` idiom) so the shell
     * stays generic and never imports a tab's surface.
     */
    picker?: React.ReactNode;
  };
  /**
   * Optional persistent status strip pinned above the primary-action footer,
   * visible across every tab (the recovery banner, #326). Absent ⇒ nothing
   * renders and the footer sits where it always did.
   */
  banner?: React.ReactNode;
  /**
   * The active tab's pushed sub-screen (#348, locked IA §3). When present the
   * shell renders it in the body — filling the space the hero header, the tab
   * page and the day-action footer occupy — and keeps the TAB BAR mounted and
   * interactive beneath it. This is what replaces the unmount-the-shell pattern:
   * a room you walked into is still inside the console, one tap from anywhere
   * else in it. The sub-screen owns its own header and its own back control, so
   * the shell contributes no chrome above it.
   */
  stackScreen?: React.ReactNode;
}

/**
 * Vertical room the pinned day-action footer occupies: the hero CTA's own body
 * (its label line box plus `lg` padding above and below) plus the footer's `md`
 * padding on each side. Tab content carries at least this much bottom inset, so
 * the last interactive control in a tab can never end up beneath the Open Floor
 * CTA or the floating chips that hover just above it (#346, audit P8). Derived
 * from theme tokens rather than a literal so a re-skin can't silently
 * invalidate the clearance.
 */
export function actionFooterClearance(t: ReturnType<typeof useTheme>): number {
  const labelSize = t.typography.buttonHero.fontSize ?? 17;
  const ctaBody = labelSize * 1.4 + t.spacing.lg * 2;
  return Math.round(ctaBody + t.spacing.md * 2);
}

/** Collapsed identity-bar body height, below the status-bar inset. */
const BAR_BODY = 52;
/** Side of the circular game-menu button in the identity bar. */
const MENU_BUTTON = 38;
/** Height of the collapsed single-line readout, centered on the title row. */
const COMPACT_ROW = 30;
/** Tallest the hero backdrop runs (below the status-bar inset). */
const HERO_BODY_MAX = 236;
/** Hero backdrop height as a fraction of screen width (2:1-ish art, cropped). */
const HERO_BODY_RATIO = 0.52;

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
  tierCompact,
  stats = [],
  heroSource,
  onOpenGameMenu,
  tabs,
  initialTabKey,
  activeTabKey,
  onTabChange,
  primaryAction,
  banner,
  stackScreen,
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
  /**
   * Tab-switch reset choreography: the scroll position snaps to 0 instantly
   * (a tab change is a new page), but snapping `scrollY` with it would make the
   * collapsed header POP back open. Instead the header reads
   * `headerY = scrollY + resetBoost`: on switch the boost is set to the old
   * offset and decays to 0 over ~180ms, so the hero re-expands as a glide while
   * the incoming tab's content crossfades in on the same beat.
   */
  const resetBoost = useRef(new Animated.Value(0)).current;
  const headerY = useRef(Animated.add(scrollY, resetBoost)).current;
  const contentFade = useRef(new Animated.Value(1)).current;
  // JS-side mirror of the live offset, read only at the moment of a tab switch.
  const lastOffset = useRef(0);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      lastOffset.current = value;
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);
  const selectTab = (key: ShellTabKey) => {
    if (key !== activeKey) {
      // Collapse progress maxes out at `range`; cap the glide there so a deep
      // scroll doesn't stall the re-expansion in the clamped zone.
      const from = Math.min(lastOffset.current, range);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      scrollY.setValue(0);
      lastOffset.current = 0;
      if (from > 0) {
        resetBoost.setValue(from);
        Animated.timing(resetBoost, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
      contentFade.setValue(0);
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
    if (!controlled) setInternalKey(key);
    onTabChange?.(key);
  };
  // A tab can disappear under us (tier change); fall back to the first.
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  // --- Scroll-driven header choreography (all native-driver-safe props) ---
  // Everything below reads `headerY` (scroll + tab-switch reset boost), never
  // raw `scrollY`, so the same curves drive both the live scroll collapse and
  // the animated re-expansion on a tab change.
  /** Hero parallax: drifts up at ~1/3 scroll speed instead of sitting frozen. */
  const heroShift = headerY.interpolate({
    inputRange: [0, range],
    outputRange: [0, -range * 0.35],
    extrapolate: 'clamp',
  });
  /** iOS pull-down: the hero stretches from its top edge instead of tearing. */
  const heroStretch = headerY.interpolate({
    inputRange: [-160, 0],
    outputRange: [1.45, 1],
    extrapolate: 'clamp',
  });
  /** The art dims toward the scrim as it slims, so it reads less pronounced. */
  const heroDim = headerY.interpolate({
    inputRange: [0, range * 0.35, range],
    outputRange: [0, 0.1, 1],
    extrapolate: 'clamp',
  });
  /** Stacked tier line + stat block: gone by mid-collapse. */
  const metaOpacity = headerY.interpolate({
    inputRange: [0, range * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const metaShift = headerY.interpolate({
    inputRange: [0, range * 0.55],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });
  /** Single-line compact readout: fades in as the stacked block leaves. */
  const compactOpacity = headerY.interpolate({
    inputRange: [range * 0.6, range],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  /** The bar earns an opaque backdrop once cards start sliding beneath it.
   *  Resolves to a FULLY opaque fill so the collapsed bar completely occludes
   *  the hero art behind it — at 0.97 the dimmed photo (and scrolling content)
   *  bled faintly through the top band. */
  const barBgOpacity = headerY.interpolate({
    inputRange: [range * 0.45, range],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  /** The dealership name settles slightly smaller in the collapsed bar. */
  const titleScale = headerY.interpolate({
    inputRange: [0, range],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });

  const root: ViewStyle = { flex: 1, backgroundColor: t.colors.base };
  // Belt-and-suspenders legibility over photo art: the scrims carry the bulk
  // of the contrast, the shadow guarantees the glyph edges.
  const onHeroShadow: TextStyle = {
    textShadowColor: t.colors.heroTextShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  };
  const dealershipName: TextStyle = {
    ...t.typography.title,
    color: t.colors.textPrimary,
    ...onHeroShadow,
  };
  const menuBtn: ViewStyle = {
    width: MENU_BUTTON,
    height: MENU_BUTTON,
    borderRadius: t.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.neutralTint,
    borderWidth: 1,
    borderColor: t.colors.border,
  };
  // A status's semantic accent — the rim + value color that turns the chip into
  // a glanceable dial. `undefined` tone reads as a plain identity chip.
  const toneAccent = (tone?: BadgeTone): string =>
    tone === 'info'
      ? t.colors.primary
      : tone === 'positive'
        ? t.colors.positive
        : tone === 'reward'
          ? t.colors.reward
          : tone === 'danger'
            ? t.colors.danger
            : t.colors.textSecondary;
  // A contained stat chip (label + value) on the hero — the chip's own
  // surfaceRaised fill carries the contrast, so it stays legible over any photo
  // without leaning on the text shadow the way bare-on-photo text would.
  const statChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.xxs,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    backgroundColor: t.colors.surfaceRaised,
  };
  const statChipLabel: TextStyle = {
    ...t.typography.badge,
    color: t.colors.textMuted,
  };
  const statChipValue: TextStyle = {
    ...t.typography.badge,
    fontVariant: ['tabular-nums'],
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
    paddingHorizontal: t.spacing.sm,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.surfaceRaised,
  };

  // The tab bar is the shell's constant: it renders identically whether the
  // body is a tab page or a pushed sub-screen, which is the whole point of
  // in-tab stacks (locked IA §3) — you never lose the console by walking into
  // a room.
  const tabBarNode = (
    <View style={tabBar} testID="app-shell-tabbar" accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === active?.key;
        // The active tab sits in its own filled, rounded slot (home-hub
        // mockup) rather than under a 2px top rule: on a dark bar the rule
        // reads as a hairline artifact, while the tinted slot reads as a
        // selected control and carries the accent the same way the tab's
        // icon + label do.
        const tabStyle: ViewStyle = {
          flex: 1,
          alignItems: 'center',
          gap: t.spacing.xxs,
          paddingVertical: t.spacing.sm,
          marginVertical: t.spacing.xs,
          marginHorizontal: t.spacing.xxs,
          borderRadius: t.radius.md,
          backgroundColor: selected ? t.colors.primaryTint : 'transparent',
        };
        // Sentence-case nav labels (#265): tab labels are wayfinding, not
        // status tags — tracked all-caps here is wireframe texture. Keep the
        // small bold size, drop the uppercase + wide tracking.
        const tabLabel: TextStyle = {
          ...t.typography.badge,
          textTransform: 'none',
          letterSpacing: 0.3,
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
  );

  if (stackScreen) {
    // A pushed sub-screen owns the body outright — it brings its own title and
    // its own back control, and the day action belongs to the tab page it was
    // pushed from, not to the room. Everything the shell still contributes is
    // the tab bar below it.
    return (
      <View style={root}>
        <View style={{ flex: 1 }} testID="app-shell-stack">
          {stackScreen}
        </View>
        {tabBarNode}
      </View>
    );
  }

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
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        testID="app-shell-content"
      >
        {/* Transparent hero-reveal spacer: the only band where the photo shows
            through. It runs to the hero's BOTTOM edge — where heroScrimBottom
            has already faded to solid `base` (#121a2b) — so the opaque sheet
            below picks up seamlessly with no hard line, while the scrim's soft
            fade still blends the photo into the page. Everything below scrolls
            on the sheet, so the hero never peeks through gaps between cards. */}
        <View style={{ height: heroHeight }} pointerEvents="none" />
        <View
          style={{
            flexGrow: 1,
            backgroundColor: t.colors.base,
            paddingHorizontal: t.spacing.lg,
            // Clear the pinned CTA footer (and the chips floating above it) —
            // scrolled to the bottom, the last card must still be tappable.
            paddingBottom: actionFooterClearance(t),
          }}
          testID="app-shell-sheet"
        >
          <Animated.View style={{ opacity: contentFade }}>
            {active?.content}
          </Animated.View>
        </View>
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
          {/* `overflow: hidden` so a long dealership name ellipsizes at the
              column edge instead of spilling into the compact-readout zone. */}
          <View style={{ flex: 1, overflow: 'hidden' }} pointerEvents="none">
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
            {/* Expanded-only meta: tier chip + a row of contained stat chips.
                Everything here is a real container — the dealership name is the
                only bare text the hero carries, so nothing reads as a debug
                overlay floating on the photo. */}
            <Animated.View
              style={{
                opacity: metaOpacity,
                transform: [{ translateY: metaShift }],
                marginTop: t.spacing.xs,
              }}
            >
              <Pill label={tierLabel} tone="info" variant="outline" />
              {stats.length > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    marginTop: t.spacing.sm,
                    gap: t.spacing.sm,
                  }}
                >
                  {stats.map((s) => {
                    const accent = toneAccent(s.tone);
                    return (
                      <View
                        key={s.label}
                        style={{
                          ...statChip,
                          borderColor: s.tone ? accent : t.colors.border,
                        }}
                      >
                        <Text style={statChipLabel}>{s.label}</Text>
                        <Text
                          style={{
                            ...statChipValue,
                            color: s.tone ? accent : t.colors.textPrimary,
                          }}
                        >
                          {s.value}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </Animated.View>

            {/* Collapsed-only: tier + stats fold up INTO the slim bar as one
                inline line, right-aligned and vertically centered on the title
                row — never below the bar. Positioned ABSOLUTELY inside this
                column rather than laid out as a flex sibling of it: as a
                sibling it reserved its full intrinsic width in the EXPANDED
                state too, where it is invisible, squeezing the identity column
                to roughly a third of the bar — enough to stretch the tier pill
                out to its clipping edge and push the dealership name past its
                own box. Absolute, it costs the expanded state nothing. */}
            {(stats.length > 0 || tierCompact) && (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  opacity: compactOpacity,
                  height: COMPACT_ROW,
                  justifyContent: 'center',
                }}
                pointerEvents="none"
              >
                <Text style={compactStat} numberOfLines={1}>
                  {[tierCompact, ...stats.map((s) => `${s.label} ${s.value}`)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Animated.View>
            )}
          </View>

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

      {banner}

      {primaryAction && (
        <View style={footer} testID="app-shell-action-footer">
          {primaryAction.picker}
          {/* Mockup's START DAY face: start flag on the left rim, the verb
              centered, the onward arrow on the right rim. The arrow is a
              trailing ICON, never a "→" glued onto the label — that drew the
              arrow twice, once on each side of the verb. */}
          <Button
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            size="hero"
            icon={primaryAction.icon ?? 'flag-checkered'}
            trailingIcon="arrow-forward"
          />
        </View>
      )}

      {tabBarNode}
    </View>
  );
}
