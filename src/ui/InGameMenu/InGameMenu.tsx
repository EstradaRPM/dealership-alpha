import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { SlotMetadata } from '../../game/SaveStore';
import { colors } from '../theme';
import { emptyState } from '../copy';

interface Props {
  slots: readonly SlotMetadata[];
  activeSlotId: string | null;
  status?: string;
  onClose: () => void;
  onSave: () => void;
  onLoadSlot: (slotId: string) => void;
  onReturnToMainMenu: () => void;
  onSettings?: () => void;
  /**
   * Re-arm every consequence hint for this career (#386). A one-shot action,
   * not a toggle: hints retire one at a time as their controls get used, so
   * there is no "off" state to switch back to — only "show them all again".
   */
  onShowHintsAgain?: () => void;
  /**
   * The answer to "What should I do?" (#213) — one sentence, resolved by the
   * app layer against the live store. The menu never words it and never decides
   * whether it applies: while the first-run spine is unfinished this is its next
   * step, and after that it is the best next action, so the entry is always
   * worth opening.
   */
  advice?: string;
}

function formatLastPlayed(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
}

export function InGameMenu({
  slots,
  activeSlotId,
  status,
  onClose,
  onSave,
  onLoadSlot,
  onReturnToMainMenu,
  onSettings,
  onShowHintsAgain,
  advice,
}: Props) {
  const [adviceOpen, setAdviceOpen] = React.useState(false);
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PAUSED</Text>
          <Text style={styles.title}>Game Menu</Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Resume game"
          onPress={onClose}
        >
          <Text style={styles.closeText}>Resume</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.primaryBtn}
          accessibilityRole="button"
          onPress={onSave}
        >
          <Text style={styles.primaryText}>Save Current Game</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          accessibilityRole="button"
          onPress={onReturnToMainMenu}
        >
          <Text style={styles.secondaryText}>Save &amp; Main Menu</Text>
        </TouchableOpacity>

        {onSettings ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            accessibilityRole="button"
            onPress={onSettings}
          >
            <Text style={styles.secondaryText}>Settings</Text>
          </TouchableOpacity>
        ) : null}

        {advice ? (
          <View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              accessibilityRole="button"
              testID="menu-advice"
              onPress={() => setAdviceOpen((open) => !open)}
            >
              <Text style={styles.secondaryText}>What should I do?</Text>
            </TouchableOpacity>
            {adviceOpen ? (
              <Text style={styles.advice} testID="menu-advice-answer">
                {advice}
              </Text>
            ) : null}
          </View>
        ) : null}

        {onShowHintsAgain ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            accessibilityRole="button"
            onPress={onShowHintsAgain}
          >
            <Text style={styles.secondaryText}>Show hints again</Text>
          </TouchableOpacity>
        ) : null}

        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Text style={styles.sectionLabel}>LOAD A SAVE</Text>
        {slots.length === 0 ? (
          <Text style={styles.emptyText}>{emptyState('no_saved_games')}</Text>
        ) : (
          slots.map((slot) => {
            const active = slot.id === activeSlotId;
            return (
              <View
                key={slot.id}
                style={[styles.slotRow, active && styles.activeSlotRow]}
              >
                <View style={styles.slotInfo}>
                  <Text style={styles.slotName}>{slot.name}</Text>
                  <Text style={styles.slotMeta}>
                    Day {slot.day} / T{slot.tier} / {formatLastPlayed(slot.lastPlayed)}
                  </Text>
                </View>
                {active ? (
                  <Text style={styles.currentLabel}>Current</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.loadBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Save current game and load ${slot.name}`}
                    onPress={() => onLoadSlot(slot.id)}
                  >
                    <Text style={styles.loadText}>Save &amp; Load</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceRaised,
  },
  eyebrow: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 3,
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  advice: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  status: {
    color: colors.reward,
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.border,
    letterSpacing: 3,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: colors.borderMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  activeSlotRow: {
    borderColor: colors.primary,
  },
  slotInfo: { flex: 1, gap: 4 },
  slotName: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  slotMeta: {
    fontFamily: 'monospace',
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1,
  },
  currentLabel: {
    fontFamily: 'monospace',
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loadBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.primaryDim,
  },
  loadText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
