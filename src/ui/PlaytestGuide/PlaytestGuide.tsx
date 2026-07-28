import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  PlaytestGuideState,
  PlaytestProbe,
  PlaytestScriptStep,
  ProbeWhen,
} from '../../game/PlaytestLog';
import { colors } from '../theme';

export interface PlaytestGuideProps {
  state: PlaytestGuideState;
  knownDark: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleStep: (step: PlaytestScriptStep, done: boolean) => void;
  onAnswer: (probe: PlaytestProbe, response: string) => void;
  /** Marks the day node done — this is what advances the guide's cursor. */
  onDayDone: () => void;
  /** Which half of the card the presenting moment is about. `day_close` opens
   *  scrolled past the steps, because by then they're history. */
  focus: ProbeWhen;
}

/**
 * The guided playtest card (#333).
 *
 * The flag FAB records what the player noticed; this records what the *script*
 * asked them to do. It is presented at the two moments the script's instructions
 * are actionable — the managerial window ("before opening, hire a second
 * salesperson") and after the Reveal ("did the day visibly change?") — which is
 * the difference between a script you have to remember to consult and a handoff
 * that walks you through the round.
 *
 * Pure presentation: it never touches the log, the world or the bus.
 */
export function PlaytestGuide({
  state,
  knownDark,
  open,
  onOpenChange,
  onToggleStep,
  onAnswer,
  onDayDone,
  focus,
}: PlaytestGuideProps) {
  const insets = useSafeAreaInsets();
  const { day } = state;

  const fabLabel = state.complete
    ? 'SCRIPT ✓'
    : `${state.dayIndex}/${state.dayCount} · ${state.stepsComplete}/${state.stepsTotal}`;

  return (
    <>
      <TouchableOpacity
        testID="playtest-guide-fab"
        accessibilityRole="button"
        accessibilityLabel="Open the playtest script"
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 120, right: insets.right + 8 },
        ]}
        hitSlop={8}
        onPress={() => onOpenChange(true)}
      >
        <Text style={styles.fabLabel}>▤ {fabLabel}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => onOpenChange(false)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {day == null ? (
              <RoundComplete onClose={() => onOpenChange(false)} />
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.headerText}>
                    <Text style={styles.session}>{day.sessionLabel}</Text>
                    <Text style={styles.title}>{day.title}</Text>
                  </View>
                  <Text style={styles.progress}>
                    {state.dayIndex}/{state.dayCount}
                  </Text>
                </View>

                <ScrollView
                  style={styles.body}
                  contentContainerStyle={styles.bodyContent}
                >
                  <Text style={styles.brief}>{day.brief}</Text>

                  {focus === 'day_close' && (
                    <Text style={styles.moment}>
                      The day is over — answer these while it's fresh.
                    </Text>
                  )}

                  <Text style={styles.sectionLabel}>DO THIS</Text>
                  {day.steps.map((step) => {
                    const done = state.stepsDone[`${day.id}:${step.id}`] === true;
                    return (
                      <TouchableOpacity
                        key={step.id}
                        testID={`playtest-guide-step-${step.id}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done }}
                        style={styles.stepRow}
                        onPress={() => onToggleStep(step, !done)}
                      >
                        <Text style={[styles.checkbox, done && styles.checkboxOn]}>
                          {done ? '✓' : ''}
                        </Text>
                        <Text style={[styles.stepText, done && styles.stepTextDone]}>
                          {step.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {day.probes.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>WATCH FOR</Text>
                      {day.probes.map((probe) => (
                        <ProbeRow
                          key={probe.id}
                          probe={probe}
                          answer={state.answers[probe.id] ?? ''}
                          onAnswer={(r) => onAnswer(probe, r)}
                        />
                      ))}
                    </>
                  )}

                  <Text style={styles.sectionLabel}>ALREADY KNOWN — DON'T REPORT</Text>
                  {knownDark.map((note) => (
                    <Text key={note} style={styles.darkNote}>
                      · {note}
                    </Text>
                  ))}
                </ScrollView>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.laterBtn]}
                    onPress={() => onOpenChange(false)}
                  >
                    <Text style={styles.laterLabel}>Back to the game</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="playtest-guide-day-done"
                    style={[styles.btn, styles.doneBtn]}
                    onPress={onDayDone}
                  >
                    <Text style={styles.doneLabel}>Day done →</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function RoundComplete({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.completeBox}>
      <Text style={styles.title}>Round complete</Text>
      <Text style={styles.brief}>
        Every scripted day is marked done. Two things left, both at a keyboard:
      </Text>
      <Text style={styles.stepText}>
        1. DEV → PLAYTEST LOG → Export, and send that markdown.
      </Text>
      <Text style={styles.stepText}>
        2. Answer the 12-question observation sheet in
        docs/planning/playtest-round-1.md §6.
      </Text>
      <TouchableOpacity style={[styles.btn, styles.doneBtn]} onPress={onClose}>
        <Text style={styles.doneLabel}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProbeRow({
  probe,
  answer,
  onAnswer,
}: {
  probe: PlaytestProbe;
  answer: string;
  onAnswer: (response: string) => void;
}) {
  // Free text is drafted locally and committed on blur; a quick chip commits
  // immediately. An answered probe still shows its chips so it can be changed.
  const [draft, setDraft] = useState(answer);

  return (
    <View style={styles.probe}>
      <Text style={styles.probePrompt}>{probe.prompt}</Text>
      <View style={styles.quickRow}>
        {probe.quick.map((q) => {
          const selected = answer === q;
          return (
            <TouchableOpacity
              key={q}
              testID={`playtest-guide-quick-${probe.id}-${q}`}
              style={[styles.quickChip, selected && styles.quickChipOn]}
              onPress={() => {
                setDraft(q);
                onAnswer(q);
              }}
            >
              <Text
                style={[styles.quickChipLabel, selected && styles.quickChipLabelOn]}
              >
                {q}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        testID={`playtest-guide-note-${probe.id}`}
        style={styles.probeInput}
        value={draft}
        onChangeText={setDraft}
        onBlur={() => {
          if (draft.trim() !== answer) onAnswer(draft);
        }}
        placeholder="…or say it in your own words"
        placeholderTextColor={colors.borderMuted}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    backgroundColor: 'rgba(60,110,150,0.85)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 999,
  },
  fabLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '88%',
  },
  completeBox: {
    gap: 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  session: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  progress: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  body: {
    marginTop: 12,
  },
  bodyContent: {
    paddingBottom: 12,
  },
  brief: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  moment: {
    color: colors.positive,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  checkboxOn: {
    backgroundColor: colors.positive,
    borderColor: colors.positive,
  },
  stepText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  stepTextDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  probe: {
    marginBottom: 16,
  },
  probePrompt: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickChipOn: {
    backgroundColor: colors.positive,
    borderColor: colors.positive,
  },
  quickChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  quickChipLabelOn: {
    color: '#fff',
    fontWeight: '700',
  },
  probeInput: {
    backgroundColor: colors.base,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 40,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  darkNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  laterBtn: {
    backgroundColor: colors.surfaceRaised,
  },
  laterLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: colors.positive,
  },
  doneLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
