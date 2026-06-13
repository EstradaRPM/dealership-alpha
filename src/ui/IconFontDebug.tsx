import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import { Ionicons } from './kit/ionicons';

/**
 * TEMPORARY diagnostic overlay for the broken-icon-glyph hunt. Renders the
 * raw facts the terminal can't show us: which font families the native side
 * actually registered, whether our loadAsync resolves or rejects, and the
 * same glyph drawn through each candidate font family so the failing layer
 * is visible at a glance. Delete once icons render.
 */

const GLYPH_NAME = 'home' as const;
const CODEPOINT = Number(Ionicons.glyphMap[GLYPH_NAME]);
const GLYPH_CHAR = String.fromCodePoint(CODEPOINT);

export function IconFontDebug() {
  const [lines, setLines] = useState<string[]>(['probing…']);

  useEffect(() => {
    (async () => {
      const out: string[] = [];
      out.push(
        `sdk=${Constants.expoConfig?.sdkVersion ?? '?'} goClient=${Constants.expoVersion ?? '?'}`,
      );
      out.push(
        `pre-load: isLoaded(dealership-ionicons)=${Font.isLoaded('dealership-ionicons')} ` +
          `isLoaded(ionicons)=${Font.isLoaded('ionicons')}`,
      );
      try {
        await Font.loadAsync(Ionicons.font);
        out.push('loadAsync(dealership-ionicons): RESOLVED');
      } catch (e) {
        out.push(`loadAsync(dealership-ionicons): REJECTED -> ${String(e)}`);
      }
      out.push(`post-load: isLoaded(dealership-ionicons)=${Font.isLoaded('dealership-ionicons')}`);
      try {
        const fonts = Font.getLoadedFonts();
        out.push(`getLoadedFonts (${fonts.length}): ${fonts.join(' | ') || '(none)'}`);
      } catch (e) {
        out.push(`getLoadedFonts threw: ${String(e)}`);
      }
      out.push(`glyph '${GLYPH_NAME}' codepoint=${CODEPOINT} (0x${CODEPOINT.toString(16)})`);
      setLines(out);
    })();
  }, []);

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <ScrollView style={styles.scroll}>
        {lines.map((l, i) => (
          <Text key={i} style={styles.line}>
            {l}
          </Text>
        ))}
        <View style={styles.glyphRow}>
          <Text style={styles.line}>A:</Text>
          <Ionicons name={GLYPH_NAME} size={22} color="#0f0" />
          <Text style={styles.line}> B:</Text>
          <Text style={[styles.glyph, { fontFamily: 'dealership-ionicons' }]}>{GLYPH_CHAR}</Text>
          <Text style={styles.line}> C:</Text>
          <Text style={[styles.glyph, { fontFamily: 'ionicons' }]}>{GLYPH_CHAR}</Text>
          <Text style={styles.line}> D:</Text>
          <Text style={styles.glyph}>{GLYPH_CHAR}</Text>
        </View>
        <Text style={styles.line}>
          A=kit component B=our family C=go-client family D=no font (expected tofu)
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderTopWidth: 1,
    borderTopColor: '#0f0',
    zIndex: 9999,
  },
  scroll: {
    maxHeight: 280,
    padding: 8,
  },
  line: {
    color: '#0f0',
    fontSize: 11,
    lineHeight: 16,
  },
  glyph: {
    color: '#0f0',
    fontSize: 22,
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
