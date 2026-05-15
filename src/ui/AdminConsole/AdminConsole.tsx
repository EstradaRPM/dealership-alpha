import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Share,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EventBus } from '../../game/EventBus';
import type { GameClock } from '../../game/GameClock';
import type { Economy } from '../../game/Economy';
import type { Inventory } from '../../game/Inventory';
import type { SaveStore } from '../../game/SaveStore';
import type { Telemetry } from '../../game/Telemetry';
import type { CustomerPool } from '../../game/CustomerPool';
import { SALES_ARCHETYPES } from '../../game/CustomerPool';

interface Props {
  bus: EventBus;
  clock: GameClock;
  economy: Economy;
  inventory: Inventory;
  saveStore: SaveStore;
  telemetry: Telemetry;
  customerPool: CustomerPool;
  onSaveCleared: () => void;
}

export function AdminConsole({ bus, clock, economy, inventory, saveStore, telemetry, customerPool, onSaveCleared }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [eventCount, setEventCount] = useState(telemetry.getEventCount());
  const [status, setStatus] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(clock.currentDay);
  const [cash, setCash] = useState(economy.cash);
  const [cashInput, setCashInput] = useState('');
  const [daysInput, setDaysInput] = useState('');
  const [selectedArchetypeIdx, setSelectedArchetypeIdx] = useState(0);

  // Auto-enable telemetry in dev so the Export button always has something
  // to return. This whole component is __DEV__-gated upstream.
  useEffect(() => {
    if (!telemetry.isEnabled()) telemetry.setEnabled(true);
  }, [telemetry]);

  // Refresh counters whenever the modal is opened.
  useEffect(() => {
    if (open) {
      setEventCount(telemetry.getEventCount());
      setCurrentDay(clock.currentDay);
      setCash(economy.cash);
      setCashInput('');
      setDaysInput('');
      setSelectedArchetypeIdx(0);
      setStatus(null);
    }
  }, [open, telemetry, economy]);

  const parsedCashInput = (): number | null => {
    const v = parseFloat(cashInput.replace(/,/g, ''));
    return isNaN(v) || v < 0 ? null : v;
  };

  const injectCash = () => {
    const amount = parsedCashInput();
    if (amount === null) { setStatus('enter a valid amount'); return; }
    economy.postRevenue(amount, 'Admin cash injection');
    setCash(economy.cash);
    setStatus(`injected $${amount.toLocaleString()} → balance $${economy.cash.toLocaleString()}`);
  };

  const resetCash = () => {
    const target = parsedCashInput();
    if (target === null) { setStatus('enter a valid amount'); return; }
    const delta = target - economy.cash;
    if (delta > 0) {
      economy.postRevenue(delta, 'Admin cash reset');
    } else if (delta < 0) {
      economy.forceDebit(-delta, 'Admin cash reset');
    }
    setCash(economy.cash);
    setStatus(`balance set to $${economy.cash.toLocaleString()}`);
  };

  const advanceDays = () => {
    const n = parseInt(daysInput, 10);
    if (isNaN(n) || n < 1 || n > 365) { setStatus('enter 1–365 days'); return; }
    for (let i = 0; i < n; i++) clock.advanceDay();
    setCurrentDay(clock.currentDay);
    setStatus(`advanced ${n} day${n === 1 ? '' : 's'} → now day ${clock.currentDay}`);
  };

  const spawnCustomer = () => {
    const arch = SALES_ARCHETYPES[selectedArchetypeIdx];
    const id = customerPool.spawnCustomer(arch.personId, arch.visitId, arch.label);
    setStatus(`spawned ${arch.label} → ${id}`);
  };

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

  const resetSave = () => {
    Alert.alert(
      'Reset Save',
      'This will wipe all progress and start a new run. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await saveStore.clear();
            setOpen(false);
            onSaveCleared();
          },
        },
      ],
    );
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

          <KeyboardAvoidingView
            style={styles.body}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.statLine}>
                Day {currentDay} · {clock.currentSeason}
              </Text>
              <Text style={styles.statLine}>
                Cash: ${cash.toLocaleString()}
              </Text>
              <Text style={styles.statLine}>
                Telemetry: {telemetry.isEnabled() ? 'recording' : 'off'} · {eventCount} events buffered
              </Text>

              <Text style={styles.sectionLabel}>CASH CONTROL</Text>
              <TextInput
                style={styles.input}
                value={cashInput}
                onChangeText={setCashInput}
                placeholder="amount"
                placeholderTextColor="#555"
                keyboardType="numeric"
                returnKeyType="done"
              />
              <View style={styles.cashRow}>
                <TouchableOpacity style={[styles.primaryBtn, styles.halfBtn]} onPress={injectCash}>
                  <Text style={styles.primaryBtnLabel}>Inject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.halfBtn]} onPress={resetCash}>
                  <Text style={styles.primaryBtnLabel}>Set To</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>TIME SKIP</Text>
              <TextInput
                style={styles.input}
                value={daysInput}
                onChangeText={setDaysInput}
                placeholder="days (1–365)"
                placeholderTextColor="#555"
                keyboardType="number-pad"
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={advanceDays}>
                <Text style={styles.primaryBtnLabel}>Advance Days</Text>
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>CUSTOMER SPAWN</Text>
              {SALES_ARCHETYPES.map((arch, idx) => (
                <TouchableOpacity
                  key={arch.personId}
                  style={[styles.archetypeRow, idx === selectedArchetypeIdx && styles.archetypeRowSelected]}
                  onPress={() => setSelectedArchetypeIdx(idx)}
                >
                  <Text style={[styles.archetypeLabel, idx === selectedArchetypeIdx && styles.archetypeLabelSelected]}>
                    {arch.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.primaryBtn, styles.spawnBtn]} onPress={spawnCustomer}>
                <Text style={styles.primaryBtnLabel}>Spawn Customer</Text>
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>TELEMETRY</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={exportTelemetry}>
                <Text style={styles.primaryBtnLabel}>Export Session Log</Text>
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>DANGER ZONE</Text>
              <TouchableOpacity style={styles.dangerBtn} onPress={resetSave}>
                <Text style={styles.dangerBtnLabel}>Reset Save / New Run</Text>
              </TouchableOpacity>

              {status && <Text style={styles.statusLine}>{status}</Text>}
              <View style={styles.scrollPad} />
            </ScrollView>
          </KeyboardAvoidingView>
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
  sectionLabel: {
    color: '#e74c3c',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0d0d1a',
    borderWidth: 1,
    borderColor: '#2c2c4a',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ecf0f1',
    fontSize: 15,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  cashRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfBtn: {
    flex: 1,
    marginTop: 0,
  },
  primaryBtn: {
    marginTop: 0,
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
  archetypeRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2c2c4a',
    marginBottom: 6,
    backgroundColor: '#0d0d1a',
  },
  archetypeRowSelected: {
    borderColor: '#e74c3c',
    backgroundColor: '#1e1030',
  },
  archetypeLabel: {
    color: '#7f8c8d',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  archetypeLabelSelected: {
    color: '#ecf0f1',
  },
  spawnBtn: {
    marginTop: 10,
  },
  scrollPad: {
    height: 32,
  },
  dangerBtn: {
    marginTop: 0,
    backgroundColor: '#7b1c1c',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  dangerBtnLabel: {
    color: '#e74c3c',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
