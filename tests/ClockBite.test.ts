import { runBite, type HaltReasonId } from '../src/game/ClockBite';

/** A fake clock: counts the days the runner drove, halting on a scripted day. */
function driver(haltOn?: { day: number; reason: HaltReasonId }) {
  const ran: number[] = [];
  return {
    ran,
    deps: {
      advanceOneDay: () => ran.push(ran.length + 1),
      checkHalt: () =>
        haltOn && ran.length === haltOn.day ? haltOn.reason : null,
    },
  };
}

// #381 — the runner. It drives the identical per-day path the player already
// drives by hand; a bite is a "how many times", not a different day.
describe('runBite (#381)', () => {
  it('a quiet week runs seven days and stops', () => {
    const d = driver();
    const run = runBite('week', d.deps);
    expect(run.daysRequested).toBe(7);
    expect(run.daysRun).toBe(7);
    expect(run.halt).toBeNull();
    expect(d.ran.length).toBe(7);
  });

  it('an escalation ends the bite where it happened', () => {
    const d = driver({ day: 3, reason: 'escalation' });
    const run = runBite('week', d.deps);
    // The halting day still counts — it happened.
    expect(run.daysRun).toBe(3);
    expect(d.ran.length).toBe(3);
    expect(run.halt?.id).toBe('escalation');
    expect(run.halt?.sentence).toBe('A deal came to your desk, so the run stopped there.');
  });

  it('insolvency and a gate verdict each stop the run', () => {
    const broke = driver({ day: 2, reason: 'insolvent' });
    const brokeRun = runBite('week', broke.deps);
    expect(brokeRun.daysRun).toBe(2);
    expect(brokeRun.halt?.id).toBe('insolvent');
    expect(brokeRun.halt?.sentence).toContain('ran out of money');

    const graded = driver({ day: 5, reason: 'gate_verdict' });
    const gradedRun = runBite('month', graded.deps);
    expect(gradedRun.daysRequested).toBe(30);
    expect(gradedRun.daysRun).toBe(5);
    expect(gradedRun.halt?.id).toBe('gate_verdict');
    expect(gradedRun.halt?.sentence).toContain('graded');
  });

  it('a halted bite leaves no queued remainder', () => {
    const halted = driver({ day: 2, reason: 'escalation' });
    runBite('week', halted.deps);
    expect(halted.ran.length).toBe(2);
    // The module holds no state between calls: the next run is a fresh bet
    // from wherever the clock now sits, never the four days it "owed".
    const fresh = driver();
    const second = runBite('week', fresh.deps);
    expect(second.daysRun).toBe(7);
    expect(second.halt).toBeNull();
  });

  it('the day bite is one day', () => {
    const d = driver();
    const run = runBite('day', d.deps);
    expect(run.daysRequested).toBe(1);
    expect(run.daysRun).toBe(1);
  });

  it('halting on the last day is not an early stop by day count', () => {
    const d = driver({ day: 7, reason: 'gate_verdict' });
    const run = runBite('week', d.deps);
    expect(run.daysRun).toBe(7);
    expect(run.halt?.id).toBe('gate_verdict');
  });
});
