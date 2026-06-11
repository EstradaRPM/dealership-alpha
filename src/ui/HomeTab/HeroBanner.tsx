import React from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

export interface HeroBannerProps {
  /** Lot/building photo keyed to tier. Absent = gradient placeholder. */
  imageSource?: ImageSourcePropType;
}

// Hero art ships at 2:1 (e.g. lot-tier1 is 1774x887). Deriving height from
// width at this ratio shows the full frame instead of cover-cropping a fixed
// 200px strip out of it.
const HERO_ASPECT = 2;

export function HeroBanner({ imageSource }: HeroBannerProps) {
  const t = useTheme();
  return (
    <View
      style={{
        // Bleed across the AppShell content padding (lg horizontal / md top,
        // see AppShell's ScrollView contentContainerStyle) so the banner runs
        // the full device width with no inset.
        marginHorizontal: -t.spacing.lg,
        marginTop: -t.spacing.md,
        aspectRatio: HERO_ASPECT,
        overflow: 'hidden',
        marginBottom: t.spacing.md,
      }}
      testID="home-hero-banner"
    >
      {imageSource ? (
        <Image source={imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#1e3a5f', t.colors.base]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}
      {/* Scrim: fades bottom half to base so the card row below reads without a hard seam */}
      <LinearGradient
        colors={['transparent', t.colors.base]}
        locations={[0.45, 1.0]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </View>
  );
}
