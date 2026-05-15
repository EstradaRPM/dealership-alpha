import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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

export function AdminConsole({ bus, clock, economy, inventory, saveStore, telemetry, onSaveCleared }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [telemetryOn, setTelemetryOn] = useState(telemetry.isEnabled());
  const [eventCount, setEventCount] = useState(telemetry.getEventCount());

  const stamp = (label: string) =>
    setLog(prev => [`[D${clock.currentDay}] ${label}`, ...prev.slice(0, 11)]);

  const advanceDays = (n: number) => {
    for (let i = 0; i < n; i++) clock.advanceDay();
    stamp(`+${n} day${n > 1 ? 's' : ''} → D${clock.currentDay}`);
  };

  const injectCash = (amount: number) => {
    economy.postRevenue(amount, 'admin:cash_inject');
    stamp(`+$${(amount / 1000).toFixed(0)}k cash`);
  };

  const buyFirstAuction = () => {
    const listings = inventory.getAuctionListings();
    if (listings.length === 0) { stamp('no auction listings'); return; }
    const cheapest = [...listings].sort((a, b) => a.askingPrice - b.askingPrice)[0];
    inventory.buyFromAuction(cheapest.id);
    stamp(`bought ${cheapest.year} ${cheapest.make} ${cheapest.model}`);
  };

  const tierUp = (from: number, to: number) => {
    bus.publish('career:tier_up', { fromTier: from, toTier: to, day: clock.currentDay });
    stamp(`tier ${from} → ${to}`);
  };

  const triggerRetire = () => {
    bus.publish('career:retired', {
      day: clock.currentDay,
      tier: 1,
      cashOnHand: economy.cash,
      careerYear: Math.floor(clock.currentDay / 365) + 1,
    });
    stamp('career:retired fired');
  };

  const triggerSellout = () => {
    bus.publish('career:pe_sellout', {
      day: clock.currentDay,
      tier: 2,
      offerAmount: 500_000,
    });
    stamp('career:pe_sellout fired');
  };

  const triggerFamilyHandoff = () => {
    bus.publish('career:family_handoff', {
      day: clock.currentDay,
      tier: 3,
      careerYear: Math.floor(clock.currentDay / 365) + 1,
    });
    stamp('career:family_handoff fired');
  };

  const triggerBankruptcy = (tier: number) => {
    if (tier === 1) {
      bus.publish('career:bankruptcy_terminal', { day: clock.currentDay, tier: 1 });
      stamp('bankruptcy terminal (T1)');
    } else if (tier === 2) {
      bus.publish('career:bankruptcy_contraction', {
        day: clock.currentDay,
        fromTier: 2,
        debtPrincipal: 75_000,
      });
      stamp('bankruptcy contraction (T2)');
    } else {
      bus.publish('career:bankruptcy_compliance', {
        day: clock.currentDay,
        tier: 3,
        cashCost: 30_000,
        reputationHit: 15,
      });
      stamp('bankruptcy compliance (T3)');
    }
  };

  const triggerAG = (tier: number) => {
    if (tier === 1) {
      bus.publish('regulatory:ag_complaint_terminal', {
        day: clock.currentDay,
        tier: 1,
        pressure: 100,
      });
      stamp('AG complaint terminal (T1)');
    } else {
      bus.publish('regulatory:ag_complaint_consent_decree', {
        day: clock.currentDay,
        tier: 3,
        cashCost: 25_000,
        reputationHit: 20,
      });
      stamp('AG consent decree (T3)');
    }
  };

  const triggerIndictment = (tier: number) => {
    if (tier === 1) {
      bus.publish('career:indictment_terminal', {
        day: clock.currentDay,
        tier: 1,
        pressure: 100,
      });
      stamp('indictment terminal (T1)');
    } else {
      bus.publish('career:indictment_legal_defense', {
        day: clock.currentDay,
        tier: 3,
        cashCost: 50_000,
        reputationHit: 25,
      });
      stamp('indictment legal defense (T3)');
    }
  };

  const toggleTelemetry = () => {
    const next = !telemetry.isEnabled();
    telemetry.setEnabled(next);
    setTelemetryOn(next);
    stamp(next ? 'telemetry ON' : 'telemetry OFF');
  };

  const clearTelemetry = () => {
    telemetry.clear();
    setEventCount(telemetry.getEventCount());
    stamp('telemetry buffer cleared');
  };

  const exportTelemetry = async () => {
    const json = telemetry.exportSessionLog();
    const count = telemetry.getEventCount();
    setEventCount(count);
    if (count === 0) { stamp('no telemetry to export'); return; }
    try {
      await Share.share({
        message: json,
        title: `dealership-session-D${clock.currentDay}.json`,
      });
      stamp(`exported ${count} events`);
    } catch {
      stamp('export share dismissed');
    }
  };

  const refreshTelemetryCount = () => setEventCount(telemetry.getEventCount());

  const clearSave = async () => {
    await saveStore.clear();
    stamp('save cleared');
    setOpen(false);
    onSaveCleared();
  };

  const season = clock.currentSeason;
  const day = clock.currentDay;
  const lotCount = inventory.getLotVehicles().length;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: insets.bottom + 8, right: insets.right + 8 },
        ]}
        hitSlop={4}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fabLabel}>DEV</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent presentationStyle="overFullScreen">
        <SafeAreaView style={styles.backdrop}>
          <View style={styles.panel}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Admin Console</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

              {/* TIME */}
              <Section title={`TIME — D${day} | ${season}`}>
                <Row>
                  <Btn label="+1 Day" onPress={() => advanceDays(1)} />
                  <Btn label="+7 Days" onPress={() => advanceDays(7)} />
                  <Btn label="+30 Days" onPress={() => advanceDays(30)} />
                </Row>
              </Section>

              {/* ECONOMY */}
              <Section title={`ECONOMY — $${economy.cash.toLocaleString()}`}>
                <Row>
                  <Btn label="+$10k" onPress={() => injectCash(10_000)} />
                  <Btn label="+$50k" onPress={() => injectCash(50_000)} />
                  <Btn label="+$100k" onPress={() => injectCash(100_000)} />
                  <Btn label="+$500k" onPress={() => injectCash(500_000)} />
                </Row>
              </Section>

              {/* INVENTORY */}
              <Section title={`INVENTORY — ${lotCount} on lot`}>
                <Row>
                  <Btn label="Buy Cheapest Auction Car" onPress={buyFirstAuction} />
                </Row>
              </Section>

              {/* TIER */}
              <Section title="TIER UP">
                <Row>
                  <Btn label="T1 → T2" onPress={() => tierUp(1, 2)} />
                  <Btn label="T2 → T3" onPress={() => tierUp(2, 3)} />
                </Row>
              </Section>

              {/* SUCCESSFUL ENDINGS */}
              <Section title="ENDINGS (SUCCESS)">
                <Row>
                  <Btn label="Retire" onPress={triggerRetire} />
                  <Btn label="Sell Out (PE)" onPress={triggerSellout} />
                  <Btn label="Family Handoff" onPress={triggerFamilyHandoff} />
                </Row>
              </Section>

              {/* FAILURE PATHS */}
              <Section title="FAILURE PATHS">
                <Row>
                  <Btn label="Bankrupt T1" color="#c0392b" onPress={() => triggerBankruptcy(1)} />
                  <Btn label="Bankrupt T2" color="#e67e22" onPress={() => triggerBankruptcy(2)} />
                  <Btn label="Bankrupt T3" color="#e67e22" onPress={() => triggerBankruptcy(3)} />
                </Row>
                <Row>
                  <Btn label="AG T1" color="#c0392b" onPress={() => triggerAG(1)} />
                  <Btn label="AG T3" color="#e67e22" onPress={() => triggerAG(3)} />
                  <Btn label="Indict T1" color="#c0392b" onPress={() => triggerIndictment(1)} />
                  <Btn label="Indict T3" color="#e67e22" onPress={() => triggerIndictment(3)} />
                </Row>
              </Section>

              {/* TELEMETRY */}
              <Section title={`TELEMETRY — ${telemetryOn ? 'ON' : 'OFF'} | ${eventCount} events`}>
                <Row>
                  <Btn
                    label={telemetryOn ? 'Stop Recording' : 'Start Recording'}
                    color={telemetryOn ? '#27ae60' : '#2c3e50'}
                    onPress={toggleTelemetry}
                  />
                  <Btn label="Refresh Count" onPress={refreshTelemetryCount} />
                  <Btn label="Export Session Log" onPress={exportTelemetry} />
                  <Btn label="Clear Buffer" color="#7f8c8d" onPress={clearTelemetry} />
                </Row>
              </Section>

              {/* SAVE */}
              <Section title="SAVE">
                <Row>
                  <Btn label="Clear Save + Restart" color="#7f8c8d" onPress={clearSave} />
                </Row>
              </Section>

              {/* LOG */}
              {log.length > 0 && (
                <Section title="LOG">
                  {log.map((entry, i) => (
                    <Text key={i} style={styles.logEntry}>{entry}</Text>
                  ))}
                </Section>
              )}

            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Btn({ label, onPress, color = '#2c3e50' }: { label: string; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity style={[styles.btn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.btnLabel}>{label}</Text>
    </TouchableOpacity>
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '78%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
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
    fontSize: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#222240',
  },
  sectionTitle: {
    color: '#7f8c8d',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnLabel: {
    color: '#ecf0f1',
    fontSize: 12,
    fontWeight: '600',
  },
  logEntry: {
    color: '#27ae60',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 3,
  },
});
