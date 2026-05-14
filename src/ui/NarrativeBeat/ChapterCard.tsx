import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { loadTierConfig } from '../../game/CareerProgression';
import type { AccentOption, FontOption } from '../../game/CareerProgression';

export interface ChapterCardConfirmation {
  businessName: string;
  accentColor: string;
  fontId: string;
}

interface Props {
  visible: boolean;
  toTier: number;
  defaultBusinessName: string;
  onConfirm: (opts: ChapterCardConfirmation) => void;
}

const config = loadTierConfig();

export function ChapterCard({ visible, toTier, defaultBusinessName, onConfirm }: Props) {
  const tierEntry = config.tiers[toTier - 1] ?? config.tiers[0];
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [accentId, setAccentId] = useState<string>(config.accentOptions[0].id);
  const [fontId, setFontId] = useState<string>(config.fontOptions[0].id);
  const [error, setError] = useState('');

  const selectedAccent: AccentOption =
    config.accentOptions.find((a) => a.id === accentId) ?? config.accentOptions[0];

  function handleConfirm() {
    const trimmed = businessName.trim();
    if (!trimmed) {
      setError('Give your business a name.');
      return;
    }
    onConfirm({ businessName: trimmed, accentColor: selectedAccent.color, fontId });
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.card}>
          <Text style={styles.chapterLabel}>Chapter</Text>
          <Text style={[styles.tierIllustration]}>{tierEntry.illustration}</Text>
          <Text style={styles.tierTitle}>Tier {toTier} — {tierEntry.label}</Text>
          <Text style={styles.caption}>{tierEntry.caption}</Text>

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>Business Name</Text>
          <TextInput
            style={styles.nameInput}
            value={businessName}
            onChangeText={(v) => { setBusinessName(v); setError(''); }}
            maxLength={50}
            placeholder="Your dealership name"
            placeholderTextColor="#555"
          />

          <Text style={styles.fieldLabel}>Accent Color</Text>
          <View style={styles.swatchRow}>
            {config.accentOptions.map((opt: AccentOption) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.swatch,
                  { backgroundColor: opt.color },
                  accentId === opt.id && styles.swatchSelected,
                ]}
                onPress={() => setAccentId(opt.id)}
                accessibilityLabel={opt.label}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Sign Font</Text>
          <View style={styles.fontRow}>
            {config.fontOptions.map((opt: FontOption) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.fontPill, fontId === opt.id && styles.fontPillSelected]}
                onPress={() => setFontId(opt.id)}
              >
                <Text
                  style={[
                    styles.fontPillText,
                    fontId === opt.id && { color: selectedAccent.color },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: selectedAccent.color }]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>Open for Business</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 28,
    width: 340,
    alignItems: 'center',
  },
  chapterLabel: {
    fontSize: 11,
    color: '#555',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  tierIllustration: {
    fontSize: 72,
    marginBottom: 12,
  },
  tierTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  caption: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#2a2a2a',
    marginBottom: 20,
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    color: '#666',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  nameInput: {
    width: '100%',
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: '#fff',
  },
  fontRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  fontPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  fontPillSelected: {
    borderColor: '#555',
  },
  fontPillText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  error: {
    color: '#e05555',
    fontSize: 13,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  confirmButton: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
});
