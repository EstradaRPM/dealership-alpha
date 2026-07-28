import {
  DAY_DONE_STEP_ID,
  deriveGuideState,
  loadPlaytestScript,
  pendingProbes,
  exportMarkdown,
  type PlaytestEntry,
  type PlaytestScript,
} from '../src/game/PlaytestLog';

// ── Fixtures ────────────────────────────────────────────────────────────────

const fixture: PlaytestScript = {
  round: 'test round',
  knownDark: ['finance tab is a placeholder'],
  days: [
    {
      id: 'd1',
      session: 'A',
      sessionLabel: 'Session A',
      title: 'Day 1 — watch it',
      brief: 'run it at 1x',
      steps: [
        { id: 's1', text: 'play at 1x' },
        { id: 's2', text: 'read the Reveal' },
      ],
      probes: [
        { id: 'p1', when: 'day_close', prompt: 'how long did it feel?', quick: ['long'] },
        { id: 'p2', when: 'day_open', prompt: 'know what to do?', quick: ['yes'] },
      ],
    },
    {
      id: 'd2',
      session: 'A',
      sessionLabel: 'Session A',
      title: 'Day 2 — buy something',
      brief: 'go to the auction',
      steps: [{ id: 's1', text: 'visit auction' }],
      probes: [],
    },
  ],
};

let seq = 0;
function step(
  dayId: string,
  stepId: string,
  done = true,
): PlaytestEntry {
  return {
    kind: 'step',
    seq: seq++,
    at: '2026-07-28T10:00:00.000Z',
    ctx: { day: 1, phase: 'MANAGERIAL', cash: 50_000, tier: 1 },
    dayId,
    stepId,
    label: stepId,
    done,
  };
}

function answer(dayId: string, probeId: string, response: string): PlaytestEntry {
  return {
    kind: 'answer',
    seq: seq++,
    at: '2026-07-28T18:00:00.000Z',
    ctx: { day: 1, phase: 'MANAGERIAL', cash: 50_000, tier: 1 },
    dayId,
    probeId,
    prompt: `prompt for ${probeId}`,
    response,
  };
}

beforeEach(() => {
  seq = 0;
});

// ── The shipped script ──────────────────────────────────────────────────────

describe('the round-1 script', () => {
  const script = loadPlaytestScript();

  it('flattens both sessions into one linear list of day nodes', () => {
    expect(script.days.length).toBeGreaterThan(0);
    expect(new Set(script.days.map((d) => d.session))).toEqual(new Set(['A', 'B']));
    // Session A must come first — B starts a whole new career.
    const firstB = script.days.findIndex((d) => d.session === 'B');
    const lastA = script.days.map((d) => d.session).lastIndexOf('A');
    expect(lastA).toBeLessThan(firstB);
  });

  it('gives every day, step and probe a unique id', () => {
    const dayIds = script.days.map((d) => d.id);
    expect(new Set(dayIds).size).toBe(dayIds.length);

    const probeIds = script.days.flatMap((d) => d.probes.map((p) => p.id));
    expect(new Set(probeIds).size).toBe(probeIds.length);

    for (const day of script.days) {
      const stepIds = day.steps.map((s) => s.id);
      expect(new Set(stepIds).size).toBe(stepIds.length);
      // The day-done marker is reserved — a script step may never claim it.
      expect(stepIds).not.toContain(DAY_DONE_STEP_ID);
      expect(day.steps.length).toBeGreaterThan(0);
    }
  });

  it('offers one-tap answers on every probe', () => {
    for (const day of script.days) {
      for (const probe of day.probes) {
        expect(probe.quick.length).toBeGreaterThan(0);
        expect(probe.prompt.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── The cursor ──────────────────────────────────────────────────────────────

describe('deriveGuideState', () => {
  it('starts on the first day with nothing recorded', () => {
    const state = deriveGuideState(fixture, []);
    expect(state.day?.id).toBe('d1');
    expect(state.dayIndex).toBe(1);
    expect(state.dayCount).toBe(2);
    expect(state.stepsComplete).toBe(0);
    expect(state.stepsTotal).toBe(2);
    expect(state.complete).toBe(false);
  });

  it('counts ticked steps without advancing the cursor', () => {
    const state = deriveGuideState(fixture, [step('d1', 's1')]);
    expect(state.day?.id).toBe('d1');
    expect(state.stepsComplete).toBe(1);
  });

  it('advances only on the day-done marker', () => {
    const state = deriveGuideState(fixture, [
      step('d1', 's1'),
      step('d1', DAY_DONE_STEP_ID),
    ]);
    expect(state.day?.id).toBe('d2');
    expect(state.dayIndex).toBe(2);
  });

  it('takes the last write per step, so a mis-tap is corrected by tapping again', () => {
    const state = deriveGuideState(fixture, [
      step('d1', 's1', true),
      step('d1', 's1', false),
    ]);
    expect(state.stepsComplete).toBe(0);
  });

  it('takes the last write per probe answer', () => {
    const state = deriveGuideState(fixture, [
      answer('d1', 'p1', 'long'),
      answer('d1', 'p1', 'about right'),
    ]);
    expect(state.answers.p1).toBe('about right');
  });

  it('orders by seq, not array position', () => {
    const first = step('d1', 's1', true);
    const second = step('d1', 's1', false);
    const state = deriveGuideState(fixture, [second, first]);
    expect(state.stepsComplete).toBe(0);
  });

  it('reports the round complete once every day is marked done', () => {
    const state = deriveGuideState(fixture, [
      step('d1', DAY_DONE_STEP_ID),
      step('d2', DAY_DONE_STEP_ID),
    ]);
    expect(state.complete).toBe(true);
    expect(state.day).toBeNull();
    expect(state.dayIndex).toBe(2);
  });

  it('is unaffected by the in-game day, so a reset save or a second career keeps its place', () => {
    // Session B is a fresh Tier 2 career whose clock restarts at day 1; the
    // cursor is the script, not the clock.
    const entries = [step('d1', DAY_DONE_STEP_ID)];
    expect(deriveGuideState(fixture, entries).day?.id).toBe('d2');
  });
});

describe('pendingProbes', () => {
  it('returns only the current day\'s unanswered probes for that moment', () => {
    const state = deriveGuideState(fixture, []);
    expect(pendingProbes(state, 'day_close').map((p) => p.id)).toEqual(['p1']);
    expect(pendingProbes(state, 'day_open').map((p) => p.id)).toEqual(['p2']);
  });

  it('drops a probe once answered', () => {
    const state = deriveGuideState(fixture, [answer('d1', 'p1', 'long')]);
    expect(pendingProbes(state, 'day_close')).toEqual([]);
  });

  it('treats an empty response as unanswered', () => {
    const state = deriveGuideState(fixture, [answer('d1', 'p1', '')]);
    expect(pendingProbes(state, 'day_close').map((p) => p.id)).toEqual(['p1']);
  });

  it('returns nothing once the round is complete', () => {
    const state = deriveGuideState(fixture, [
      step('d1', DAY_DONE_STEP_ID),
      step('d2', DAY_DONE_STEP_ID),
    ]);
    expect(pendingProbes(state, 'day_close')).toEqual([]);
  });
});

// ── The trace in the export ─────────────────────────────────────────────────

describe('exportMarkdown script trace', () => {
  const meta = { day: 3, tier: 1, exportedAt: '2026-07-28T20:00:00.000Z' };

  it('says so plainly when the guide was never opened', () => {
    const md = exportMarkdown([], meta, fixture);
    expect(md).toContain('## Script trace');
    expect(md).toContain('the guide was never opened');
  });

  it('renders skipped steps as unticked — an unfollowed instruction is signal', () => {
    const md = exportMarkdown(
      [step('d1', 's1'), step('d1', DAY_DONE_STEP_ID)],
      meta,
      fixture,
    );
    expect(md).toContain('- [x] play at 1x');
    expect(md).toContain('- [ ] read the Reveal');
  });

  it('flags a day the player never marked done', () => {
    const md = exportMarkdown([step('d1', 's1')], meta, fixture);
    expect(md).toContain('not marked done');
  });

  it('carries probe answers, and names the ones left unanswered', () => {
    const md = exportMarkdown(
      [step('d1', DAY_DONE_STEP_ID), answer('d1', 'p1', 'too long')],
      meta,
      fixture,
    );
    expect(md).toContain('**too long**');
    expect(md).toContain('(unanswered)');
  });

  it('omits days the player never reached', () => {
    const md = exportMarkdown([step('d1', 's1')], meta, fixture);
    expect(md).not.toContain('Day 2 — buy something');
  });

  it('still carries the flags, deals and walk-off sections', () => {
    const md = exportMarkdown([step('d1', 's1')], meta, fixture);
    expect(md).toContain('## Flags');
    expect(md).toContain('## Finance mix');
    expect(md).toContain('## Walk-offs');
  });
});
