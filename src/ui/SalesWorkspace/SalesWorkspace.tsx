import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import type { CustomerSession, CustomerAction } from '../../game/CustomerPool';
import type { DealEngine, ClosedDealResult } from '../../game/DealEngine';
import type { LotVehicle } from '../../game/Inventory';

type Tab = 'show-vehicle' | 'negotiate' | 'structure' | 'walk';

const TERMINAL_STAGES = new Set(['CLOSED', 'WALK']);

interface TabProps {
  session: CustomerSession;
  onDispatch: (action: CustomerAction) => void;
}

function ShowVehicleTab({ session, onDispatch }: TabProps) {
  const { stage } = session;
  if (TERMINAL_STAGES.has(stage)) {
    return (
      <Text style={styles.status}>
        {stage === 'CLOSED' ? 'Deal closed.' : 'Customer walked.'}
      </Text>
    );
  }
  if (stage === 'DEMOED' || stage === 'NEGOTIATING') {
    return <Text style={styles.status}>Vehicle has been shown.</Text>;
  }
  const actions: Array<{ label: string; action: CustomerAction; active: boolean }> = [
    { label: 'Greet Customer',  action: 'GREET',   active: stage === 'UNGREETED' },
    { label: 'Qualify Needs',   action: 'QUALIFY',  active: stage === 'GREETED'   },
    { label: 'Show Vehicle',    action: 'DEMO',     active: stage === 'QUALIFIED' },
  ];
  return (
    <View>
      {actions.map(({ label, action, active }) => (
        <TouchableOpacity
          key={action}
          style={[styles.actionBtn, !active && styles.actionBtnDisabled]}
          onPress={() => active && onDispatch(action)}
          disabled={!active}
          accessibilityRole="button"
          accessibilityState={{ disabled: !active }}
        >
          <Text style={[styles.actionBtnText, !active && styles.actionBtnTextDisabled]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface NegotiateTabProps {
  session: CustomerSession;
  onDispatch: (action: CustomerAction) => void;
  lotVehicles: readonly LotVehicle[];
  onCloseDeal: (vehicleId: string, agreedPrice: number) => ClosedDealResult;
}

function DealJacket({ deal }: { deal: ClosedDealResult }) {
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const grossColor = deal.frontGross >= 0 ? styles.grossPositive : styles.grossNegative;

  return (
    <View style={styles.dealJacket}>
      <Text style={styles.dealJacketTitle}>Deal Closed</Text>
      <Text style={styles.dealJacketVehicle}>
        {deal.year} {deal.make} {deal.model}
      </Text>

      <View style={styles.dealJacketRow}>
        <Text style={styles.dealJacketLabel}>Agreed Price</Text>
        <Text style={styles.dealJacketValue}>{fmt(deal.agreedPrice)}</Text>
      </View>
      <View style={styles.dealJacketRow}>
        <Text style={styles.dealJacketLabel}>Vehicle Cost</Text>
        <Text style={styles.dealJacketValue}>({fmt(deal.purchasePrice)})</Text>
      </View>
      <View style={styles.dealJacketRow}>
        <Text style={styles.dealJacketLabel}>Recon</Text>
        <Text style={styles.dealJacketValue}>({fmt(deal.reconCost)})</Text>
      </View>
      <View style={[styles.dealJacketRow, styles.dealJacketDivider]}>
        <Text style={styles.dealJacketGrossLabel}>Front Gross</Text>
        <Text style={[styles.dealJacketGrossValue, grossColor]}>{fmt(deal.frontGross)}</Text>
      </View>
      <View style={styles.dealJacketRow}>
        <Text style={styles.dealJacketLabel}>Back Gross</Text>
        <Text style={styles.dealJacketValue}>{fmt(deal.backGross)}</Text>
      </View>
    </View>
  );
}

function NegotiateTab({ session, onDispatch, lotVehicles, onCloseDeal }: NegotiateTabProps) {
  const { stage } = session;
  const [agreedPriceText, setAgreedPriceText] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [closedDeal, setClosedDeal] = useState<ClosedDealResult | null>(null);

  if (stage === 'WALK') {
    return <Text style={styles.status}>Customer walked.</Text>;
  }

  if (stage === 'CLOSED') {
    if (closedDeal) return <DealJacket deal={closedDeal} />;
    return <Text style={styles.status}>Deal closed.</Text>;
  }

  if (!['DEMOED', 'NEGOTIATING'].includes(stage)) {
    return <Text style={styles.status}>Show the vehicle first before negotiating.</Text>;
  }

  if (stage === 'DEMOED') {
    return (
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onDispatch('NEGOTIATE')}
        accessibilityRole="button"
      >
        <Text style={styles.actionBtnText}>Open Negotiation</Text>
      </TouchableOpacity>
    );
  }

  // NEGOTIATING
  const agreedPrice = parseFloat(agreedPriceText) || 0;
  const canClose = agreedPrice > 0 && selectedVehicleId !== null;

  return (
    <View>
      <Text style={styles.structureLabel}>Agreed Price</Text>
      <TextInput
        style={styles.structureInput}
        value={agreedPriceText}
        onChangeText={setAgreedPriceText}
        placeholder="0"
        placeholderTextColor="#444"
        keyboardType="numeric"
      />

      <Text style={styles.structureLabel}>Select Vehicle</Text>
      {lotVehicles.length === 0 ? (
        <Text style={styles.status}>No vehicles on lot.</Text>
      ) : (
        lotVehicles.map((v) => {
          const isSelected = v.id === selectedVehicleId;
          return (
            <TouchableOpacity
              key={v.id}
              style={[styles.vehicleOption, isSelected && styles.vehicleOptionSelected]}
              onPress={() => setSelectedVehicleId(v.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={styles.vehicleOptionTitle}>
                {v.year} {v.make} {v.model}
              </Text>
              <Text style={styles.vehicleOptionSub}>
                Cost: ${v.purchasePrice.toLocaleString()} · Recon: ${v.reconCost.toLocaleString()}
              </Text>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity
        style={[styles.actionBtn, styles.closeDealBtn, !canClose && styles.actionBtnDisabled]}
        onPress={() => {
          if (!canClose || !selectedVehicleId) return;
          const result = onCloseDeal(selectedVehicleId, agreedPrice);
          setClosedDeal(result);
        }}
        disabled={!canClose}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canClose }}
      >
        <Text style={[styles.actionBtnText, !canClose && styles.actionBtnTextDisabled]}>
          Close Deal
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function WalkTab({ session, onDispatch }: TabProps) {
  const { stage } = session;
  if (TERMINAL_STAGES.has(stage)) {
    return (
      <Text style={styles.status}>
        {stage === 'CLOSED' ? 'Deal closed — no walk.' : 'Customer has already walked.'}
      </Text>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.actionBtn, styles.actionBtnWalk]}
      onPress={() => onDispatch('WALK_CUSTOMER')}
      accessibilityRole="button"
    >
      <Text style={styles.actionBtnText}>Let Customer Walk</Text>
    </TouchableOpacity>
  );
}

const TERM_OPTIONS = [24, 36, 48, 60, 72] as const;
type TermMonths = (typeof TERM_OPTIONS)[number];

interface StructurePaymentTabProps {
  session: CustomerSession;
  dealEngine: DealEngine;
}

function StructurePaymentTab({ session, dealEngine }: StructurePaymentTabProps) {
  const creditScore = session.bundle.person.credit;
  const tier = dealEngine.classifyCredit(creditScore);

  const [priceText, setPriceText] = useState('');
  const [downText, setDownText] = useState('');
  const [term, setTerm] = useState<TermMonths>(60);

  const price = parseFloat(priceText) || 0;
  const down = parseFloat(downText) || 0;
  const result = dealEngine.structure({ price, down, termMonths: term, tier });

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtPmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View>
      <View style={styles.structureTierRow}>
        <Text style={styles.structureLabel}>Credit Tier</Text>
        <Text style={styles.structureTierBadge}>{tier}</Text>
        <Text style={styles.structureApr}>  {(result.apr * 100).toFixed(1)}% APR</Text>
      </View>

      <Text style={styles.structureLabel}>Vehicle Price</Text>
      <TextInput
        style={styles.structureInput}
        value={priceText}
        onChangeText={setPriceText}
        placeholder="0"
        placeholderTextColor="#444"
        keyboardType="numeric"
      />

      <Text style={styles.structureLabel}>Down Payment</Text>
      <TextInput
        style={styles.structureInput}
        value={downText}
        onChangeText={setDownText}
        placeholder="0"
        placeholderTextColor="#444"
        keyboardType="numeric"
      />

      <Text style={styles.structureLabel}>Term</Text>
      <View style={styles.termRow}>
        {TERM_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.termBtn, term === t && styles.termBtnActive]}
            onPress={() => setTerm(t)}
          >
            <Text style={[styles.termBtnText, term === t && styles.termBtnTextActive]}>
              {t}mo
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.structureResultRow}>
        <Text style={styles.structureResultLabel}>Principal</Text>
        <Text style={styles.structureResultValue}>{fmt(result.principal)}</Text>
      </View>
      <View style={styles.structureResultRow}>
        <Text style={styles.structureMonthlyLabel}>Monthly Payment</Text>
        <Text style={styles.structureMonthlyValue}>{fmtPmt(result.monthlyPayment)}</Text>
      </View>
    </View>
  );
}

interface Props {
  session: CustomerSession;
  onDispatch: (action: CustomerAction) => void;
  onClose: () => void;
  dealEngine: DealEngine;
  lotVehicles: readonly LotVehicle[];
}

export function SalesWorkspace({ session, onDispatch, onClose, dealEngine, lotVehicles }: Props) {
  const [tab, setTab] = useState<Tab>('show-vehicle');

  const tabDefs: Array<{ id: Tab; label: string }> = [
    { id: 'show-vehicle', label: 'Show Vehicle' },
    { id: 'negotiate',    label: 'Negotiate'    },
    { id: 'structure',    label: 'Structure'    },
    { id: 'walk',         label: 'Walk'         },
  ];

  const handleCloseDeal = (vehicleId: string, agreedPrice: number): ClosedDealResult => {
    return dealEngine.closeDeal({ customerId: session.customerId, vehicleId, agreedPrice });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{session.archetypeLabel}</Text>
          <Text style={styles.stage}>{session.stage}</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabDefs.map(({ id, label }) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {tab === 'show-vehicle' && <ShowVehicleTab session={session} onDispatch={onDispatch} />}
        {tab === 'negotiate'    && (
          <NegotiateTab
            session={session}
            onDispatch={onDispatch}
            lotVehicles={lotVehicles}
            onCloseDeal={handleCloseDeal}
          />
        )}
        {tab === 'structure'    && <StructurePaymentTab session={session} dealEngine={dealEngine} />}
        {tab === 'walk'         && <WalkTab         session={session} onDispatch={onDispatch} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    marginRight: 12,
  },
  backText: {
    color: '#aaa',
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  stage: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4a9eff',
  },
  tabLabel: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#4a9eff',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
  },
  status: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 20,
  },
  actionBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: '#1a1a1a',
  },
  actionBtnWalk: {
    backgroundColor: '#5f1e1e',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBtnTextDisabled: {
    color: '#444',
  },
  structureTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  structureLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  structureTierBadge: {
    color: '#4a9eff',
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 8,
  },
  structureApr: {
    color: '#888',
    fontSize: 14,
    marginLeft: 4,
  },
  structureInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  termRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  termBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  termBtnActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#4a9eff',
  },
  termBtnText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  termBtnTextActive: {
    color: '#4a9eff',
  },
  structureResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  structureResultLabel: {
    color: '#888',
    fontSize: 14,
  },
  structureResultValue: {
    color: '#ccc',
    fontSize: 14,
  },
  structureMonthlyLabel: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  structureMonthlyValue: {
    color: '#4a9eff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeDealBtn: {
    marginTop: 20,
    backgroundColor: '#1e5f1e',
  },
  vehicleOption: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  vehicleOptionSelected: {
    borderColor: '#4a9eff',
    backgroundColor: '#0d1f33',
  },
  vehicleOptionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  vehicleOptionSub: {
    color: '#666',
    fontSize: 12,
    marginTop: 3,
  },
  dealJacket: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 20,
    marginTop: 8,
  },
  dealJacketTitle: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dealJacketVehicle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  dealJacketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  dealJacketDivider: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
    borderBottomColor: '#222',
  },
  dealJacketLabel: {
    color: '#888',
    fontSize: 14,
  },
  dealJacketValue: {
    color: '#ccc',
    fontSize: 14,
  },
  dealJacketGrossLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dealJacketGrossValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  grossPositive: {
    color: '#4caf50',
  },
  grossNegative: {
    color: '#ef5350',
  },
});
