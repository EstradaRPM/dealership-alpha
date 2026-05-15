import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EventBus } from '../../game/EventBus';
import type { GameClock } from '../../game/GameClock';
import type { Economy } from '../../game/Economy';
import type { Inventory } from '../../game/Inventory';
import type { SaveStore } from '../../game/SaveStore';
import type { Telemetry } from '../../game/Telemetry';

interface Props {
  bus: EventBus;
  clock: GameClock;
  economy: Economy;
  inventory: Inventory;
  saveStore: SaveStore;
  telemetry: Telemetry;
  onSaveCleared: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AdminConsole({ bus, clock, economy, inventory, saveStore, telemetry, onSaveCleared }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [eventCount, setEventCount] = useState(telemetry.getEventCount());
  const [status, setStatus] = useState<string | null>(null);

  // Auto-enable telemetry in dev so the Export button always has something
  // to return. This whole component is __DEV__-gated upstream.
  useEffect(() => {
    if (!telemetry.isEnabled()) telemetry.setEnabled(true);
  }, [telemetry]);

  // Refresh the displayed event count whenever the modal is opened.
  useEffect(() => {
    if (open) setEventCount(telemetry.getEventCount());
  }, [open, telemetry]);

  const exportTelemetry = async () => {
    const count = telemetry.getEventCount();
    setEventCount(count);
    if (count === 0) {
      setStatus('no telemetry to export yet');
      return;
    }
    const json = telemetry.exportSessionLog();
    try {
      const result = await Share.share({
        message: json,
        title: `dealership-session-D${clock.currentDay}.json`,
      });
      setStatus(result.action === Share.dismissedAction
        ? 'export dismissed'
        : `exported ${count} events`);
    } catch (err) {
      setStatus(`export failed: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 56, right: insets.right + 8 },
        ]}
        hitSlop={4}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fabLabel}>DEV</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>ADMIN CONSOLE</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.statLine}>
              Day {clock.currentDay} · {clock.currentSeason}
            </Text>
            <Text style={styles.statLine}>
              Telemetry: {telemetry.isEnabled() ? 'recording' : 'off'} · {eventCount} events buffered
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={exportTelemetry}>
              <Text style={styles.primaryBtnLabel}>Export Session Log</Text>
            </TouchableOpacity>

            {status && <Text style={styles.statusLine}>{status}</Text>}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    backgroundColor: 'rgba(50,50,60,0.55)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 999,
  },
  fabLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c4a',
  },
  headerTitle: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  closeBtn: {
    color: '#888',
    fontSize: 22,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  statLine: {
    color: '#7f8c8d',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: '#2c3e50',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnLabel: {
    color: '#ecf0f1',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusLine: {
    marginTop: 16,
    color: '#27ae60',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
