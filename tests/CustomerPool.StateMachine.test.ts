import { createEventBus } from '../src/game/EventBus';
import {
  transition,
  IllegalTransitionError,
  createCustomerPool,
} from '../src/game/CustomerPool';
import type { CustomerStage, CustomerAction } from '../src/game/CustomerPool';
import {
  loadPersonArchetypes,
  loadVisitArchetypes,
  loadTraitTaxonomy,
} from '../src/game/NPC';

// ── Legal transitions ─────────────────────────────────────────────────────────

describe('CustomerStateMachine — legal forward transitions', () => {
  const forwardPath: Array<[CustomerStage, CustomerAction, CustomerStage]> = [
    ['UNGREETED',   'GREET',        'GREETED'     ],
    ['GREETED',     'QUALIFY',      'QUALIFIED'   ],
    ['QUALIFIED',   'DEMO',         'DEMOED'      ],
    ['DEMOED',      'NEGOTIATE',    'NEGOTIATING' ],
    ['NEGOTIATING', 'CLOSE',        'CLOSED'      ],
  ];

  it.each(forwardPath)('%s + %s → %s', (from, action, expected) => {
    expect(transition(from, action)).toBe(expected);
  });
});

describe('CustomerStateMachine — WALK_CUSTOMER is legal from every non-terminal stage', () => {
  const walkable: CustomerStage[] = [
    'UNGREETED', 'GREETED', 'QUALIFIED', 'DEMOED', 'NEGOTIATING',
  ];

  it.each(walkable)('%s + WALK_CUSTOMER → WALK', (from) => {
    expect(transition(from, 'WALK_CUSTOMER')).toBe('WALK');
  });
});

// ── Illegal transitions ───────────────────────────────────────────────────────

describe('CustomerStateMachine — illegal transitions throw IllegalTransitionError', () => {
  const illegal: Array<[CustomerStage, CustomerAction]> = [
    // Out-of-order forward actions
    ['UNGREETED',   'QUALIFY'     ],
    ['UNGREETED',   'DEMO'        ],
    ['UNGREETED',   'NEGOTIATE'   ],
    ['UNGREETED',   'CLOSE'       ],
    ['GREETED',     'GREET'       ],
    ['GREETED',     'DEMO'        ],
    ['GREETED',     'NEGOTIATE'   ],
    ['GREETED',     'CLOSE'       ],
    ['QUALIFIED',   'GREET'       ],
    ['QUALIFIED',   'QUALIFY'     ],
    ['QUALIFIED',   'NEGOTIATE'   ],
    ['QUALIFIED',   'CLOSE'       ],
    ['DEMOED',      'GREET'       ],
    ['DEMOED',      'QUALIFY'     ],
    ['DEMOED',      'DEMO'        ],
    ['DEMOED',      'CLOSE'       ],
    ['NEGOTIATING', 'GREET'       ],
    ['NEGOTIATING', 'QUALIFY'     ],
    ['NEGOTIATING', 'DEMO'        ],
    ['NEGOTIATING', 'NEGOTIATE'   ],
    // Terminal states block everything
    ['CLOSED',      'GREET'       ],
    ['CLOSED',      'QUALIFY'     ],
    ['CLOSED',      'DEMO'        ],
    ['CLOSED',      'NEGOTIATE'   ],
    ['CLOSED',      'CLOSE'       ],
    ['CLOSED',      'WALK_CUSTOMER'],
    ['WALK',        'GREET'       ],
    ['WALK',        'QUALIFY'     ],
    ['WALK',        'DEMO'        ],
    ['WALK',        'NEGOTIATE'   ],
    ['WALK',        'CLOSE'       ],
    ['WALK',        'WALK_CUSTOMER'],
  ];

  it.each(illegal)('%s + %s throws', (from, action) => {
    expect(() => transition(from, action)).toThrow(IllegalTransitionError);
  });

  it('error carries from/action fields', () => {
    try {
      transition('UNGREETED', 'CLOSE');
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalTransitionError);
      expect((e as IllegalTransitionError).from).toBe('UNGREETED');
      expect((e as IllegalTransitionError).action).toBe('CLOSE');
    }
  });
});

// ── The live floor drives the same machine (#363) ─────────────────────────────

describe('CustomerStateMachine — the live floor lands a walk in WALK', () => {
  const npcDeps = {
    masterSeed: 42,
    personArchetypes: loadPersonArchetypes(),
    visitArchetypes: loadVisitArchetypes(),
    traits: loadTraitTaxonomy(),
  };

  function walkedByTheFloor(reason: string, heat?: number) {
    const bus = createEventBus();
    const pool = createCustomerPool({ bus, npcDeps });
    bus.publish('clock:day_started', { day: 1 });
    const [session] = pool.getSessions();
    const resolutions: { outcome: string; heat: number }[] = [];
    bus.subscribe('customer:resolved', (e) =>
      resolutions.push({ outcome: e.outcome, heat: e.heat }),
    );
    bus.publish('staff:auto_resolved', {
      customerId: session.customerId,
      staffId: 'sp-1',
      day: 1,
      outcome: 'no_sale',
      grossImpact: 0,
      reason,
      heat,
    });
    return { pool, id: session.customerId, resolutions };
  }

  it('a no-fit walk still resolves the customer', () => {
    // The lot had nothing for them, so the sales process never ran and there is
    // no warmth to carry — but they were on the floor and they left, which is a
    // resolution. Omitting it is what starved every walk consumer before #363.
    const { pool, id, resolutions } = walkedByTheFloor('no_fit');
    expect(resolutions).toEqual([{ outcome: 'walk', heat: 0 }]);
    expect(pool.getSession(id)?.stage).toBe('WALK');
  });

  it('a worked walk carries the warmth the floor measured', () => {
    const { pool, id, resolutions } = walkedByTheFloor('trust_collapse', 0.35);
    expect(resolutions).toEqual([{ outcome: 'walk', heat: 0.35 }]);
    expect(pool.getSession(id)?.stage).toBe('WALK');
  });
});
