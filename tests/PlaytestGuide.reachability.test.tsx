import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlaytestGuide } from '../src/ui/PlaytestGuide';
import {
  createPlaytestLog,
  deriveGuideState,
  loadPlaytestScript,
  DAY_DONE_STEP_ID,
} from '../src/game/PlaytestLog';
import { createInMemoryDriver } from '../src/game/SaveStore';

// #333 — the guided script card. These guard the two ways a *guided* handoff
// can silently fail: the card not writing what the player did back into the log
// (so the export can't show the round was actually followed), and the boundary
// presentation not being wired at the composition site (so it degrades back
// into a doc you have to remember to open).

const METRICS = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const ctx = { day: 1, phase: 'MANAGERIAL', cash: 50_000, tier: 1 };

function renderGuide(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);
}

/** A guide bound to a real log, the way AppOverlays binds it. */
function mount(log = createPlaytestLog(createInMemoryDriver())) {
  const script = loadPlaytestScript();
  let state = deriveGuideState(script, log.entries());
  const day = state.day!;

  const view = renderGuide(
    <PlaytestGuide
      state={state}
      knownDark={script.knownDark}
      open
      focus="day_open"
      onOpenChange={() => {}}
      onToggleStep={(step, done) =>
        log.recordStep({ ctx, dayId: day.id, stepId: step.id, label: step.text, done })
      }
      onAnswer={(probe, response) =>
        log.recordAnswer({
          ctx,
          dayId: day.id,
          probeId: probe.id,
          prompt: probe.prompt,
          response,
        })
      }
      onDayDone={() =>
        log.recordStep({
          ctx,
          dayId: day.id,
          stepId: DAY_DONE_STEP_ID,
          label: day.title,
          done: true,
        })
      }
    />,
  );
  return { ...view, log, script, day, state };
}

describe('PlaytestGuide — the guided card writes back to the log (#333)', () => {
  it('ticking a step records it against the current script day', () => {
    const { getByTestId, log, day } = mount();
    const step = day.steps[0];

    fireEvent.press(getByTestId(`playtest-guide-step-${step.id}`));

    expect(log.counts().step).toBe(1);
    expect(log.entries()[0]).toMatchObject({
      kind: 'step',
      dayId: day.id,
      stepId: step.id,
      label: step.text,
      done: true,
    });
  });

  it('a quick chip records the probe answer in one tap', () => {
    const { getByTestId, log, day } = mount();
    const probe = day.probes[0];
    const quick = probe.quick[0];

    fireEvent.press(getByTestId(`playtest-guide-quick-${probe.id}-${quick}`));

    expect(log.counts().answer).toBe(1);
    expect(log.entries()[0]).toMatchObject({
      kind: 'answer',
      probeId: probe.id,
      prompt: probe.prompt,
      response: quick,
    });
  });

  it('free text on a probe commits on blur', () => {
    const { getByTestId, log, day } = mount();
    const probe = day.probes[0];

    const input = getByTestId(`playtest-guide-note-${probe.id}`);
    fireEvent.changeText(input, 'it dragged in the middle');
    fireEvent(input, 'blur');

    expect(log.entries()[0]).toMatchObject({ response: 'it dragged in the middle' });
  });

  it('"Day done" advances the cursor to the next scripted day', () => {
    const { getByTestId, log, script, day } = mount();

    fireEvent.press(getByTestId('playtest-guide-day-done'));

    const next = deriveGuideState(script, log.entries());
    expect(next.day?.id).not.toBe(day.id);
    expect(next.dayIndex).toBe(2);
  });

  it('shows how far through the round the player is', () => {
    const { getByTestId, state } = mount();
    // day position and steps ticked, both on the FAB — it reads as a checklist
    // in progress rather than a button that might do something.
    expect(getByTestId('playtest-guide-fab')).toHaveTextContent(
      `▤ 1/${state.dayCount} · 0/${state.stepsTotal}`,
    );
  });

  it('ends on a round-complete card that names the two keyboard steps', () => {
    const script = loadPlaytestScript();
    const done = script.days.map((d, i) => ({
      kind: 'step' as const,
      seq: i,
      at: '2026-07-28T10:00:00.000Z',
      ctx,
      dayId: d.id,
      stepId: DAY_DONE_STEP_ID,
      label: d.title,
      done: true,
    }));

    const { getByText } = renderGuide(
      <PlaytestGuide
        state={deriveGuideState(script, done)}
        knownDark={script.knownDark}
        open
        focus="day_open"
        onOpenChange={() => {}}
        onToggleStep={() => {}}
        onAnswer={() => {}}
        onDayDone={() => {}}
      />,
    );

    expect(getByText('Round complete')).toBeTruthy();
    expect(getByText(/PLAYTEST LOG/)).toBeTruthy();
    expect(getByText(/observation sheet/)).toBeTruthy();
  });

  it('carries the known-dark list, so a placeholder tab is never reported as a bug', () => {
    const { getByText, script } = mount();
    expect(getByText(`· ${script.knownDark[0]}`)).toBeTruthy();
  });
});

describe('PlaytestGuide — boundary presentation is wired (#333)', () => {
  it('AppOverlays presents the card at both scripted boundaries and queues behind beats', () => {
    // Anti-orphan guard: without these the guide degrades into a doc the player
    // has to remember to open — which is exactly what #333 exists to fix.
    const src = fs.readFileSync(
      path.join(__dirname, '../src/app/screens/AppOverlays.tsx'),
      'utf8',
    );
    expect(src).toContain('<PlaytestGuide');
    // The two moments a scripted instruction is actionable.
    expect(src).toContain("bus.subscribe('clock:managerial_prep'");
    expect(src).toContain("bus.subscribe('floor:day_complete'");
    // …and it must never stack on a beat the player is already reading.
    expect(src).toContain('guideBlocked');
    for (const beat of [
      'recapModalOpen',
      'monthClose != null',
      'chapterQueue.length > 0',
      'recoveryQueue.length > 0',
      'endCard != null',
    ]) {
      expect(src).toContain(beat);
    }
  });
});
