import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import { createIconSet } from '@expo/vector-icons';
import materialGlyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json';
import materialFont from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf';
import ioniconsFont from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf';
import { Ionicons } from './kit/ionicons';

/**
 * TEMPORARY diagnostic overlay for the broken-icon-glyph hunt. v2: loads a
 * SECOND icon family (MaterialIcons) through the identical pipeline and dumps
 * the bytes/URL the device actually downloaded for the Ionicons ttf — if
 * Material renders while Ionicons stays tofu, the Ionicons.ttf file itself is
 * what Android rejects. Delete once icons render.
 */

const MaterialIcons = createIconSet(materialGlyphs, 'debug-material', materialFont);

const ION_CODEPOINT = Number(Ionicons.glyphMap.home);
const ION_CHAR = String.fromCodePoint(ION_CODEPOINT);
const MAT_CODEPOINT = Number(MaterialIcons.glyphMap.home);
const MAT_CHAR = String.fromCodePoint(MAT_CODEPOINT);

export function IconFontDebug() {
  const [lines, setLines] = useState<string[]>(['probing…']);

  useEffect(() => {
    (async () => {
      const out: string[] = [];
      out.push(
        `sdk=${Constants.expoConfig?.sdkVersion ?? '?'} goClient=${Constants.expoVersion ?? '?'}`,
      );
      try {
        await Font.loadAsync(Ionicons.font);
        out.push('loadAsync(dealership-ionicons): RESOLVED');
      } catch (e) {
        out.push(`loadAsync(dealership-ionicons): REJECTED -> ${String(e)}`);
      }
      try {
        await Font.loadAsync(MaterialIcons.font);
        out.push('loadAsync(debug-material): RESOLVED');
      } catch (e) {
        out.push(`loadAsync(debug-material): REJECTED -> ${String(e)}`);
      }
      try {
        const asset = Asset.fromModule(ioniconsFont);
        await asset.downloadAsync();
        out.push(`ion asset uri=${asset.uri}`);
        out.push(`ion asset localUri=${asset.localUri ?? '(none)'}`);
        const resp = await fetch(asset.uri);
        const buf = new Uint8Array(await resp.arrayBuffer());
        const head = Array.from(buf.slice(0, 16))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        out.push(`ion fetched bytes=${buf.length} first16=${head}`);
        out.push('(valid ttf: 00 01 00 00 …, expected ~389,734 bytes)');
      } catch (e) {
        out.push(`asset probe threw: ${String(e)}`);
      }
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
          <Text style={styles.line}>ION A:</Text>
          <Ionicons name="home" size={22} color="#0f0" />
          <Text style={styles.line}> B:</Text>
          <Text style={[styles.glyph, { fontFamily: 'dealership-ionicons' }]}>{ION_CHAR}</Text>
          <Text style={styles.line}>   MAT C:</Text>
          <MaterialIcons name="home" size={22} color="#0f0" />
          <Text style={styles.line}> D:</Text>
          <Text style={[styles.glyph, { fontFamily: 'debug-material' }]}>{MAT_CHAR}</Text>
          <Text style={styles.line}> E(tofu):</Text>
          <Text style={styles.glyph}>{ION_CHAR}</Text>
        </View>
        <Text style={styles.line}>
          A/B=Ionicons component/raw · C/D=MaterialIcons component/raw · E=no font
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
    maxHeight: 300,
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
    flexWrap: 'wrap',
  },
});
