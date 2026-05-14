import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import type { CandidateListing } from '../../game/StaffOrg';
import type { StaffWithComposites } from '../../game/StaffOrg/types';

function SkillRow({ label, value, cap }: { label: string; value: number; cap: number }) {
  const ratio = Math.max(0, Math.min(1, value / cap));
  return (
    <View style={styles.skillRow}>
      <Text style={styles.skillLabel}>{label}</Text>
      <View style={styles.skillBarBg}>
        <View style={[styles.skillBarFill, { flex: ratio }]} />
        <View style={{ flex: 1 - ratio }} />
      </View>
      <Text style={styles.skillValue}>{Math.round(value)}</Text>
    </View>
  );
}

function compositeColor(v: number): object {
  if (v >= 0.7) return { color: '#4caf50' };
  if (v >= 0.45) return { color: '#c8a96e' };
  return { color: '#ef5350' };
}

interface DetailModalProps {
  listing: CandidateListing;
  skillCaps: Record<string, number>;
  cash: number;
  onHire: () => void;
  onClose: () => void;
}

function DetailModal({ listing, skillCaps, cash, onHire, onClose }: DetailModalProps) {
  const { staff, hiringCost } = listing;
  const canAfford = cash >= hiringCost;
  const s = staff as StaffWithComposites;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>{listing.archetypeId.replace(/_/g, ' ')}</Text>
          <Text style={styles.modalRole}>{staff.role_id}</Text>

          <View style={styles.compositeRow}>
            <View style={styles.compositeItem}>
              <Text style={styles.compositeLabel}>Effectiveness</Text>
              <Text style={[styles.compositeValue, compositeColor(s.effectiveness)]}>
                {Math.round(s.effectiveness * 100)}%
              </Text>
            </View>
            <View style={styles.compositeItem}>
              <Text style={styles.compositeLabel}>Trustworthiness</Text>
              <Text style={[styles.compositeValue, compositeColor(s.trustworthiness)]}>
                {Math.round(s.trustworthiness * 100)}%
              </Text>
            </View>
          </View>

          {staff.trait_ids.length > 0 && (
            <View style={styles.traitRow}>
              {staff.trait_ids.map((t) => (
                <View key={t} style={styles.traitPill}>
                  <Text style={styles.traitText}>{t.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.skillSection}>
            {Object.entries(staff.skills).map(([id, val]) => (
              <SkillRow
                key={id}
                label={id.replace(/_/g, ' ')}
                value={val}
                cap={skillCaps[id] ?? 100}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.hireBtn, !canAfford && styles.hireBtnDisabled]}
            onPress={canAfford ? onHire : undefined}
            disabled={!canAfford}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAfford }}
          >
            <Text style={[styles.hireBtnText, !canAfford && styles.hireBtnTextDisabled]}>
              {canAfford
                ? `Hire for $${hiringCost.toLocaleString()}`
                : 'Insufficient Funds'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface CandidateRowProps {
  listing: CandidateListing;
  onPress: () => void;
}

function CandidateRow({ listing, onPress }: CandidateRowProps) {
  const s = listing.staff as StaffWithComposites;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{listing.archetypeId.replace(/_/g, ' ')}</Text>
        <Text style={styles.rowSub}>
          {listing.staff.trait_ids.join(' · ') || 'No traits'}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowEff, compositeColor(s.effectiveness)]}>
          {Math.round(s.effectiveness * 100)}% eff
        </Text>
        <Text style={styles.rowCost}>${listing.hiringCost.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

export interface PersonnelScreenProps {
  roleId: string;
  candidates: readonly CandidateListing[];
  skillCaps: Record<string, number>;
  cash: number;
  onHire: (candidateId: string) => void;
  onClose: () => void;
}

export function PersonnelScreen({
  roleId,
  candidates,
  skillCaps,
  cash,
  onHire,
  onClose,
}: PersonnelScreenProps) {
  const [selected, setSelected] = useState<CandidateListing | null>(null);

  const handleHire = () => {
    if (!selected) return;
    onHire(selected.candidateId);
    setSelected(null);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Hire {roleId.replace(/-/g, ' ')}</Text>
          <Text style={styles.cashLabel}>Cash: ${cash.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {candidates.length === 0 ? (
          <Text style={styles.empty}>No candidates available.</Text>
        ) : (
          candidates.map((c) => (
            <CandidateRow key={c.candidateId} listing={c} onPress={() => setSelected(c)} />
          ))
        )}
      </ScrollView>

      {selected && (
        <DetailModal
          listing={selected}
          skillCaps={skillCaps}
          cash={cash}
          onHire={handleHire}
          onClose={() => setSelected(null)}
        />
      )}
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
    textTransform: 'capitalize',
  },
  cashLabel: {
    color: '#4caf50',
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listInner: {
    padding: 16,
  },
  empty: {
    color: '#555',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rowSub: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowEff: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowCost: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  modalClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 8,
  },
  modalCloseText: {
    color: '#666',
    fontSize: 18,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  modalRole: {
    color: '#888',
    fontSize: 13,
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  compositeRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  compositeItem: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  compositeLabel: {
    color: '#666',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  compositeValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  traitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  traitPill: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  traitText: {
    color: '#aaa',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  skillSection: {
    marginBottom: 20,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  skillLabel: {
    color: '#888',
    fontSize: 13,
    width: 130,
    textTransform: 'capitalize',
  },
  skillBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#222',
    borderRadius: 3,
    marginHorizontal: 8,
  },
  skillBarFill: {
    height: 6,
    backgroundColor: '#c8a96e',
    borderRadius: 3,
  },
  skillValue: {
    color: '#aaa',
    fontSize: 12,
    width: 28,
    textAlign: 'right',
  },
  hireBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  hireBtnDisabled: {
    backgroundColor: '#1a1a1a',
  },
  hireBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  hireBtnTextDisabled: {
    color: '#444',
  },
});
