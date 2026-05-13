import { createEventBus } from '../src/game/EventBus';
import { createCompetitorMarket } from '../src/game/CompetitorMarket';
import type { CompetitorCatalog } from '../src/game/CompetitorMarket';

const competitors: CompetitorCatalog = [
  { id: 'a', name: 'A', brand: 'corden', rep: 0.7, inventory: 0.6, pricing: 0.5 },
  { id: 'b', name: 'B', brand: 'castillac', rep: 0.6, inventory: 0.5, pricing: 0.7 },
];

describe('CompetitorMarket EventBus wiring', () => {
  it('publishes market:competitive_pressure on each clock:day_started', () => {
    const bus = createEventBus();
    createCompetitorMarket({ bus, competitors });

    const received: { day: number; ids: string[] }[] = [];
    bus.subscribe('market:competitive_pressure', (p) => {
      received.push({ day: p.day, ids: p.competitors.map((c) => c.id) });
    });

    bus.publish('clock:day_started', { day: 1 });
    bus.publish('clock:day_started', { day: 2 });

    expect(received).toEqual([
      { day: 1, ids: ['a', 'b'] },
      { day: 2, ids: ['a', 'b'] },
    ]);
  });

  it('dispose stops further publishes', () => {
    const bus = createEventBus();
    const market = createCompetitorMarket({ bus, competitors });

    const received: number[] = [];
    bus.subscribe('market:competitive_pressure', (p) => received.push(p.day));

    bus.publish('clock:day_started', { day: 1 });
    market.dispose();
    bus.publish('clock:day_started', { day: 2 });

    expect(received).toEqual([1]);
  });

  it('payload carries the same competitor set the market was constructed with', () => {
    const bus = createEventBus();
    createCompetitorMarket({ bus, competitors });

    let payload: { day: number; competitors: ReadonlyArray<unknown> } | null = null;
    bus.subscribe('market:competitive_pressure', (p) => {
      payload = p;
    });

    bus.publish('clock:day_started', { day: 42 });

    expect(payload).not.toBeNull();
    expect(payload!.day).toBe(42);
    expect(payload!.competitors).toHaveLength(competitors.length);
  });
});
