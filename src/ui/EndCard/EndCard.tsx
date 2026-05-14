import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { EndCardData, EndCardReason } from '../../game/EndCard';
import { END_CARD_OUTCOME } from '../../game/EndCard';

const REASON_LABELS: Record<EndCardReason, string> = {
  bankruptcy: 'Bankruptcy',
  ag_complaint: 'AG Complaint',
  indictment: 'Indictment',
  retire: 'Retired',
  sellout: 'Sold to PE',
  family_handoff: 'Family Handoff',
};

const REASON_ILLUSTRATION: Record<EndCardReason, string> = {
  bankruptcy: '🪦',
  ag_complaint: '📋',
  indictment: '⚖️',
  retire: '🌅',
  sellout: '💼',
  family_handoff: '🔑',
};

const HEADER_LABEL: Record<'failure' | 'success', string> = {
  failure: 'GAME OVER',
  success: 'CAREER COMPLETE',
};

interface Props {
  visible: boolean;
  data: EndCardData;
  onDismiss: () => void;
}

export function EndCard({ visible, data, onDismiss }: Props) {
  const reasonLabel = REASON_LABELS[data.reason];
  const illustration = REASON_ILLUSTRATION[data.reason];
  const headerLabel = HEADER_LABEL[END_CARD_OUTCOME[data.reason]];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.card}>
          <Text style={styles.gameOver}>{headerLabel}</Text>

          <Text style={styles.illustration}>{illustration}</Text>

          <Text style={styles.reasonLabel}>{reasonLabel}</Text>

          <View style={styles.divider} />

          <Text style={styles.playerName}>{data.playerName}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>YEAR</Text>
              <Text style={styles.metaValue}>{data.careerYear}</Text>
            </View>
            <View style={styles.metaSep} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>TIER REACHED</Text>
              <Text style={styles.metaValue}>{data.tierReached}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.flavor}>{data.flavorText}</Text>

          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>New Career</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#0a0a0a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 32,
    width: 340,
    alignItems: 'center',
  },
  gameOver: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#444',
    letterSpacing: 6,
    marginBottom: 28,
    textTransform: 'uppercase',
  },
  illustration: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.6,
  },
  reasonLabel: {
    fontFamily: 'monospace',
    fontSize: 20,
    color: '#bbb',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#1e1e1e',
    marginBottom: 24,
  },
  playerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e8e8e8',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  metaItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  metaSep: {
    width: 1,
    height: 32,
    backgroundColor: '#1e1e1e',
  },
  metaLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#444',
    letterSpacing: 2,
    marginBottom: 4,
  },
  metaValue: {
    fontFamily: 'monospace',
    fontSize: 22,
    color: '#888',
    fontWeight: '700',
  },
  flavor: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  dismissButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 2,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  dismissText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#666',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
