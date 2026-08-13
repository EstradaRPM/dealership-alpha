import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EventBus, TapListener } from '../../game/EventBus';
import type { EventName } from '../../game/EventBus';
import type { GameClock } from '../../game/GameClock';
import type { Economy } from '../../game/Economy';
import type { Inventory } from '../../game/Inventory';
import type { SaveStore } from '../../game/SaveStore';
import type { Telemetry } from '../../game/Telemetry';
import type { CustomerPool } from '../../game/CustomerPool';
import { SALES_ARCHETYPES } from '../../game/CustomerPool';
import type { PlaytestLog } from '../../game/PlaytestLog';
import { exportMarkdown } from '../../game/PlaytestLog';
import { CustomerCard } from '../CustomerCard';
import { useConfirm, money } from '../kit';
import { colors } from '../theme';

interface Props {
  bus: EventBus;
  clock: GameClock;
  economy: Economy;
  inventory: Inventory;
  saveStore: SaveStore;
  telemetry: Telemetry;
  customerPool: CustomerPool;
  /** #74 playtest recorder (#332) — read-out + export + clear live here. */
  playtestLog: PlaytestLog;
  tier: number;
  onSaveCleared: () => void;
}

export function AdminConsole({ bus, clock, economy, inventory, saveStore, telemetry, customerPool, playtestLog, tier, onSaveCleared }: Props) {
  const insets = useSafeAreaInsets();
  const { ask, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [eventCount, setEventCount] = useState(telemetry.getEventCount());
  const [status, setStatus] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState(clock.currentDay);
  const [cash, setCash] = useState(economy.cash);
  const [cashInput, setCashInput] = useState('');
  const [daysInput, setDaysInput] = useState('');
  const [selectedArchetypeIdx, setSelectedArchetypeIdx] = useState(0);
  const [sessionTick, setSessionTick] = useState(0);
  const [busLogEnabled, setBusLogEnabled] = useState(false);
  const [busLog, setBusLog] = useState<Array<{ id: number; event: string; preview: string }>>([]);
  const busLogIdRef = useRef(0);
  const logScrollRef = useRef<ScrollView>(null);

  const BUS_LOG_CAP = 100;

  const tapListener = useCallback<TapListener>((event: EventName, payload) => {
    const preview = JSON.stringify(payload);
    setBusLog(prev => {
      const next = [...prev, { id: busLogIdRef.current++, event, preview }];
      return next.length > BUS_LOG_CAP ? next.slice(next.length - BUS_LOG_CAP) : next;
    });
  }, []);

  useEffect(() => {
    if (busLogEnabled) {
      bus.tap(tapListener);
    } else {
      bus.untap(tapListener);
    }
    return () => { bus.untap(tapListener); };
  }, [busLogEnabled, bus, tapListener]);

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
    setStatus(`injected ${money(amount)} → balance ${money(economy.cash)}`);
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
    setStatus(`balance set to ${money(economy.cash)}`);
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
    setSessionTick((t) => t + 1);
    setStatus(`spawned ${arch.label} → ${id}`);
  };

  // Snapshot of live customer sessions for the inspect-a-customer card (#165).
  // Recomputed when the modal opens or a customer is spawned; the live floor
  // pushes new sessions through the bus path, not via this admin entrypoint.
  const liveSessions = React.useMemo(() => {
    if (!open) return [];
    return customerPool.getSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionTick, customerPool]);

  // Recomputed whenever the console opens (or a clear bumps sessionTick) — the
  // log itself is appended to from the bus, which never re-renders this modal.
  const playtestCounts = React.useMemo(
    () => playtestLog.counts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, sessionTick, playtestLog],
  );

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

  const exportPlaytestLog = async () => {
    const counts = playtestLog.counts();
    if (playtestLog.count() === 0) {
      setStatus('playtest log is empty');
      return;
    }
    await playtestLog.flush();
    const md = exportMarkdown(playtestLog.entries(), {
      day: clock.currentDay,
      tier,
      exportedAt: new Date().toISOString(),
    });
    try {
      const result = await Share.share({
        message: md,
        title: `playtest-log-D${clock.currentDay}.md`,
      });
      setStatus(result.action === Share.dismissedAction
        ? 'export dismissed'
        : `exported ${counts.flag} flags / ${counts.deal} deals / ${counts.walk} walks`);
    } catch (err) {
      setStatus(`export failed: ${(err as Error).message}`);
    }
  };

  const clearPlaytestLog = () => {
    ask({
      title: 'Clear Playtest Log',
      message: `This deletes all ${playtestLog.count()} recorded entries. Export first if you haven't.`,
      confirmLabel: 'Clear',
      tone: 'danger',
      onConfirm: async () => {
        await playtestLog.clear();
        setSessionTick((t) => t + 1);
        setStatus('playtest log cleared');
      },
    });
  };

  const resetSave = () => {
    ask({
      title: 'Reset Save',
      message: 'This will wipe all progress and start a new run. This cannot be undone.',
      confirmLabel: 'Reset',
      tone: 'danger',
      onConfirm: async () => {
        await saveStore.clear();
        setOpen(false);
        onSaveCleared();
      },
    });
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 56, right: insets.right + 8 },
        ]}
        hitSlop={4}
        testID="admin-console-fab"
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
                Cash: {money(cash)}
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
                placeholderTextColor={colors.borderMuted}
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
                placeholderTextColor={colors.borderMuted}
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

              {liveSessions.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>LIVE CUSTOMERS</Text>
                  {liveSessions.map((s) => (
                    <View key={s.customerId} style={styles.customerCardWrap}>
                      <CustomerCard
                        model={{
                          customerId: s.customerId,
                          archetypeLabel: s.archetypeLabel,
                          currentVehicle: s.bundle.person.currentVehicle,
                        }}
                      />
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.sectionLabel}>EVENT LOG</Text>
              <View style={styles.cashRow}>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.halfBtn, busLogEnabled && styles.activeBtn]}
                  onPress={() => {
                    if (!busLogEnabled) setBusLog([]);
                    setBusLogEnabled(v => !v);
                  }}
                >
                  <Text style={styles.primaryBtnLabel}>{busLogEnabled ? 'Stop' : 'Start'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.halfBtn]}
                  onPress={() => setBusLog([])}
                >
                  <Text style={styles.primaryBtnLabel}>Clear</Text>
                </TouchableOpacity>
              </View>
              {busLog.length > 0 && (
                <ScrollView
                  ref={logScrollRef}
                  style={styles.logPanel}
                  onContentSizeChange={() => logScrollRef.current?.scrollToEnd({ animated: false })}
                  nestedScrollEnabled
                >
                  {busLog.map(entry => (
                    <Text key={entry.id} style={styles.logEntry}>
                      <Text style={styles.logEventName}>{entry.event}</Text>
                      {'  '}{entry.preview}
                    </Text>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.sectionLabel}>PLAYTEST LOG</Text>
              <Text style={styles.statLine}>
                {playtestCounts.flag} flags · {playtestCounts.deal} deals · {playtestCounts.walk} walk-offs
              </Text>
              <Text style={styles.statLine}>
                {playtestCounts.step} script steps · {playtestCounts.answer} probe answers
              </Text>
              <View style={styles.cashRow}>
                <TouchableOpacity
                  testID="playtest-export"
                  style={[styles.primaryBtn, styles.halfBtn]}
                  onPress={exportPlaytestLog}
                >
                  <Text style={styles.primaryBtnLabel}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.halfBtn]}
                  onPress={clearPlaytestLog}
                >
                  <Text style={styles.primaryBtnLabel}>Clear</Text>
                </TouchableOpacity>
              </View>

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
          {/* Inside the console's own full-screen modal so the question layers
              over the screen that asked it. */}
          {dialog}
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
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  headerTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  closeBtn: {
    color: colors.textMuted,
    fontSize: 22,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  statLine: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  sectionLabel: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.base,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
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
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusLine: {
    marginTop: 16,
    color: colors.positive,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  archetypeRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    marginBottom: 6,
    backgroundColor: colors.base,
  },
  archetypeRowSelected: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  archetypeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  archetypeLabelSelected: {
    color: colors.textPrimary,
  },
  customerCardWrap: {
    marginTop: 8,
  },
  spawnBtn: {
    marginTop: 10,
  },
  scrollPad: {
    height: 32,
  },
  activeBtn: {
    backgroundColor: colors.positive,
    borderWidth: 1,
    borderColor: colors.positive,
  },
  logPanel: {
    marginTop: 10,
    backgroundColor: colors.base,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    borderRadius: 6,
    maxHeight: 220,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  logEntry: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 4,
    lineHeight: 14,
  },
  logEventName: {
    color: colors.danger,
  },
  dangerBtn: {
    marginTop: 0,
    backgroundColor: colors.danger,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerBtnLabel: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
