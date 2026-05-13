import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { CustomerSession, CustomerAction } from '../../game/CustomerPool';

type Tab = 'show-vehicle' | 'negotiate' | 'walk';

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

function NegotiateTab({ session, onDispatch }: TabProps) {
  const { stage } = session;
  if (TERMINAL_STAGES.has(stage)) {
    return (
      <Text style={styles.status}>
        {stage === 'CLOSED' ? 'Deal closed.' : 'Customer walked.'}
      </Text>
    );
  }
  if (!['DEMOED', 'NEGOTIATING'].includes(stage)) {
    return <Text style={styles.status}>Show the vehicle first before negotiating.</Text>;
  }
  return (
    <View>
      <TouchableOpacity
        style={[styles.actionBtn, stage !== 'DEMOED' && styles.actionBtnDisabled]}
        onPress={() => stage === 'DEMOED' && onDispatch('NEGOTIATE')}
        disabled={stage !== 'DEMOED'}
        accessibilityRole="button"
        accessibilityState={{ disabled: stage !== 'DEMOED' }}
      >
        <Text style={[styles.actionBtnText, stage !== 'DEMOED' && styles.actionBtnTextDisabled]}>
          Open Negotiation
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, stage !== 'NEGOTIATING' && styles.actionBtnDisabled]}
        onPress={() => stage === 'NEGOTIATING' && onDispatch('CLOSE')}
        disabled={stage !== 'NEGOTIATING'}
        accessibilityRole="button"
        accessibilityState={{ disabled: stage !== 'NEGOTIATING' }}
      >
        <Text
          style={[styles.actionBtnText, stage !== 'NEGOTIATING' && styles.actionBtnTextDisabled]}
        >
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

interface Props {
  session: CustomerSession;
  onDispatch: (action: CustomerAction) => void;
  onClose: () => void;
}

export function SalesWorkspace({ session, onDispatch, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('show-vehicle');

  const tabDefs: Array<{ id: Tab; label: string }> = [
    { id: 'show-vehicle', label: 'Show Vehicle' },
    { id: 'negotiate',    label: 'Negotiate'    },
    { id: 'walk',         label: 'Walk'         },
  ];

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
        {tab === 'negotiate'    && <NegotiateTab   session={session} onDispatch={onDispatch} />}
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
});
