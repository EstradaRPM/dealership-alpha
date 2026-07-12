import { buildReveal } from '../src/ui/Reveal';
import type { DayFunnel } from '../src/game/CapacityManager';
import { loadTunables } from '../src/game/data';

const BUSY_THRESHOLD = loadTunables().reveal.busyWalkedInThreshold;

function funnel(overrides: Partial<DayFunnel> = {}): DayFunnel {
  return {
    potentialTraffic: 10,
    walkedIn: 8,
    gated: 0,
    staffEngaged: 6,
    sold: 4,
    leakCause: 'none',
    ...overrides,
  };
}

describe('#319 buildReveal — pure Reveal read-model', () => {
  it('frames a zero-traffic day plainly, with no reactions to score', () => {
    const model = buildReveal(funnel({ potentialTraffic: 0, walkedIn: 0 }), 0, {
      strong: 0,
      matched: 0,
    });
    expect(model.scoreline).toBe('No traffic — nothing closed today.');
    expect(model.reactions).toHaveLength(1);
    expect(model.reactions[0]).toMatchObject({ id: 'match-summary', tone: 'neutral' });
    expect(model.reactions[0].text).toMatch(/No sales closed today/);
  });

  it('reads "Busy day" once walked-in clears the tunable threshold', () => {
    const model = buildReveal(
      funnel({ potentialTraffic: 20, walkedIn: BUSY_THRESHOLD }),
      14_200,
      { strong: 6, matched: 8 },
    );
    expect(model.scoreline).toBe(
      'Busy day — you had what the crowd wanted: 6 of 8 stuck.',
    );
    expect(model.reactions[0].tone).toBe('positive');
    expect(model.reactions[0].text).toMatch(/6 of 8 stuck/);
    expect(model.reactions[0].text).toMatch(/\$14,200/);
  });

  it('reads "Slow day" under the threshold and stars a losing verdict when the match rate is weak', () => {
    const model = buildReveal(
      funnel({ potentialTraffic: 10, walkedIn: BUSY_THRESHOLD - 1 }),
      1_500,
      { strong: 1, matched: 4 },
    );
    expect(model.scoreline).toBe(
      "Slow day — the lot didn't fit the crowd: 1 of 4 stuck.",
    );
    expect(model.reactions[0].tone).toBe('negative');
  });

  it('never uses temperature words', () => {
    const model = buildReveal(funnel(), 5_000, { strong: 2, matched: 4 });
    const copy = `${model.scoreline} ${model.reactions.map((r) => r.text).join(' ')}`;
    expect(copy.toLowerCase()).not.toMatch(/\b(warm|hot|cool|cold)\b/);
  });

  it('renders a negative gross day without throwing and formats the sign', () => {
    const model = buildReveal(funnel({ potentialTraffic: 0, walkedIn: 0, sold: 0 }), -1_200, {
      strong: 0,
      matched: 0,
    });
    expect(model.reactions[0].text).toMatch(/-\$1,200/);
  });

  it('exactly one reaction ships at S1 — the match summary', () => {
    const model = buildReveal(funnel(), 9_000, { strong: 3, matched: 5 });
    expect(model.reactions.map((r) => r.id)).toEqual(['match-summary']);
  });
});
