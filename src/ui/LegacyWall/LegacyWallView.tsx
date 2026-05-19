import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import type { LegacyEntry } from '../../game/SaveStore';
import { EndCard } from '../EndCard';
import type { EndCardData, EndCardReason } from '../../game/EndCard';
import { END_CARD_OUTCOME } from '../../game/EndCard';
import { colors } from '../theme';

const REASON_LABELS: Record<string, string> = {
  bankruptcy: 'Bankruptcy',
  ag_complaint: 'AG Complaint',
  indictment: 'Indictment',
  retire: 'Retired',
  sellout: 'Sold to PE',
  family_handoff: 'Family Handoff',
};

const REASON_ICON: Record<string, string> = {
  bankruptcy: '🪦',
  ag_complaint: '📋',
  indictment: '⚖️',
  retire: '🌅',
  sellout: '💼',
  family_handoff: '🔑',
};

function outcomeColor(reason: string): string {
  const outcome = END_CARD_OUTCOME[reason as EndCardReason];
  return outcome === 'success' ? colors.positive : colors.danger;
}

interface LegacyRowProps {
  entry: LegacyEntry;
  onPress: () => void;
}

function LegacyRow({ entry, onPress }: LegacyRowProps) {
  const icon = REASON_ICON[entry.reason] ?? '?';
  const label = REASON_LABELS[entry.reason] ?? entry.reason;
  const color = outcomeColor(entry.reason);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{entry.playerName}</Text>
        <Text style={[styles.rowReason, { color }]}>{label}</Text>
        <Text style={styles.rowMeta}>
          Yr {entry.careerYear} · Tier {entry.tierReached}
        </Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

interface Props {
  visible: boolean;
  legacies: readonly LegacyEntry[];
  onClose: () => void;
}

export function LegacyWallView({ visible, legacies, onClose }: Props) {
  const [selected, setSelected] = useState<LegacyEntry | null>(null);

  function toEndCardData(entry: LegacyEntry): EndCardData {
    return {
      playerName: entry.playerName,
      backstoryId: entry.backstoryId as EndCardData['backstoryId'],
      careerYear: entry.careerYear,
      tierReached: entry.tierReached,
      reason: entry.reason as EndCardReason,
      flavorText: entry.flavorText,
    };
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>WALL OF LEGACIES</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {legacies.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No careers completed yet.</Text>
          </View>
        ) : (
          <FlatList
            data={legacies as LegacyEntry[]}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <LegacyRow entry={item} onPress={() => setSelected(item)} />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>

      {selected !== null && (
        <EndCard
          visible
          data={toEndCardData(selected)}
          onDismiss={() => setSelected(null)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.border,
    letterSpacing: 6,
  },
  closeBtn: {
    fontSize: 18,
    color: colors.borderMuted,
  },
  list: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowIcon: {
    fontSize: 28,
    opacity: 0.6,
    marginRight: 16,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  rowReason: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rowMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.border,
  },
  rowChevron: {
    fontSize: 22,
    color: colors.border,
  },
  separator: {
    height: 1,
    backgroundColor: colors.base,
    marginLeft: 64,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.border,
    letterSpacing: 2,
  },
});
