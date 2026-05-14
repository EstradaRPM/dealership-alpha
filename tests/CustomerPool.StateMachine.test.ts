import { transition, IllegalTransitionError } from '../src/game/CustomerPool';
import type { CustomerStage, CustomerAction } from '../src/game/CustomerPool';

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
