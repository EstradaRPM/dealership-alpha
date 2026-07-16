import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import type {
  CandidateListing,
  StaffWithComposites,
  PromotionOption,
} from '../../game/StaffOrg';
import { colors } from '../theme';

export interface PersonnelRoleOption {
  id: string;
  label: string;
}

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
  if (v >= 0.7) return { color: colors.positive };
  if (v >= 0.45) return { color: colors.primary };
  return { color: colors.danger };
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

interface StaffRowProps {
  staff: StaffWithComposites;
  promotions: readonly PromotionOption[];
  onPromote: (toRoleId: string) => void;
  onFire: () => void;
}

function StaffRow({ staff, promotions, onPromote, onFire }: StaffRowProps) {
  const roleLabel = staff.role_id.replace(/-/g, ' ');
  return (
    <View style={styles.staffRow}>
      <View style={styles.staffRowTop}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{roleLabel}</Text>
          <Text style={styles.rowSub}>
            {Math.round(staff.effectiveness * 100)}% eff /{' '}
            {Math.round(staff.trustworthiness * 100)}% trust
          </Text>
        </View>
        <TouchableOpacity
          style={styles.fireBtn}
          accessibilityRole="button"
          accessibilityLabel={`Fire ${roleLabel}`}
          onPress={onFire}
        >
          <Text style={styles.fireBtnText}>Fire</Text>
        </TouchableOpacity>
      </View>
      {promotions.length > 0 && (
        <View style={styles.promoteRow}>
          {promotions.map((p) => {
            const targetLabel = p.toRoleId.replace(/-/g, ' ');
            return (
              <TouchableOpacity
                key={p.toRoleId}
                style={styles.promoteBtn}
                accessibilityRole="button"
                accessibilityLabel={`Promote ${roleLabel} to ${targetLabel}`}
                onPress={() => onPromote(p.toRoleId)}
              >
                <Text style={styles.promoteBtnText}>↑ {targetLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export interface PersonnelScreenProps {
  roleOptions: readonly PersonnelRoleOption[];
  selectedRoleId: string;
  candidates: readonly CandidateListing[];
  roster: readonly StaffWithComposites[];
  /** staffId → legal promotion targets for that roster member (#324). */
  promotionsByStaffId: Record<string, readonly PromotionOption[]>;
  skillCaps: Record<string, number>;
  cash: number;
  onSelectRole: (roleId: string) => void;
  onHire: (candidateId: string) => void;
  onPromote: (staffId: string, toRoleId: string) => void;
  onFire: (staffId: string) => void;
  onClose: () => void;
}

export function PersonnelScreen({
  roleOptions,
  selectedRoleId,
  candidates,
  roster,
  promotionsByStaffId,
  skillCaps,
  cash,
  onSelectRole,
  onHire,
  onPromote,
  onFire,
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
          <Text style={styles.title}>Personnel</Text>
          <Text style={styles.cashLabel}>Cash: ${cash.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {roster.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Roster</Text>
            {roster.map((staff) => (
              <StaffRow
                key={staff.id}
                staff={staff}
                promotions={promotionsByStaffId[staff.id] ?? []}
                onPromote={(toRoleId) => onPromote(staff.id, toRoleId)}
                onFire={() => onFire(staff.id)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Hire</Text>
          <View style={styles.rolePicker}>
            {roleOptions.map((role) => {
              const selected = role.id === selectedRoleId;
              return (
                <TouchableOpacity
                  key={role.id}
                  style={[styles.roleBtn, selected && styles.roleBtnSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectRole(role.id)}
                >
                  <Text
                    style={[
                      styles.roleBtnText,
                      selected && styles.roleBtnTextSelected,
                    ]}
                  >
                    {role.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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
    backgroundColor: colors.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: 12,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cashLabel: {
    color: colors.positive,
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listInner: {
    padding: 16,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  rolePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBtn: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  roleBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  roleBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  roleBtnTextSelected: {
    color: colors.textPrimary,
  },
  empty: {
    color: colors.borderMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  staffRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    padding: 14,
    marginBottom: 10,
  },
  staffRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  promoteBtn: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.positive,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  promoteBtnText: {
    color: colors.positive,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rowSub: {
    color: colors.borderMuted,
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  fireBtn: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fireBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
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
    color: colors.borderMuted,
    fontSize: 18,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  modalRole: {
    color: colors.textMuted,
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
    backgroundColor: colors.base,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  compositeLabel: {
    color: colors.borderMuted,
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
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  traitText: {
    color: colors.textSecondary,
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
    borderBottomColor: colors.surfaceRaised,
  },
  skillLabel: {
    color: colors.textMuted,
    fontSize: 13,
    width: 130,
    textTransform: 'capitalize',
  },
  skillBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 3,
    marginHorizontal: 8,
  },
  skillBarFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  skillValue: {
    color: colors.textSecondary,
    fontSize: 12,
    width: 28,
    textAlign: 'right',
  },
  hireBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  hireBtnDisabled: {
    backgroundColor: colors.surface,
  },
  hireBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  hireBtnTextDisabled: {
    color: colors.border,
  },
});
