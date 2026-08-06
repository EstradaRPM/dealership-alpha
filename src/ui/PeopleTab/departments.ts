import type { IconName, IconBadgeTone } from '../kit';

/**
 * Which part of the store a person works in — the axis the People tab groups
 * everything by. Mirrors `department` on the staff-role catalog, plus `store`
 * for the roles the catalog leaves unassigned (the lot porter, the GM): they
 * work for the whole store, not for one department, and a null bucket the
 * player can't name is worse than a named one.
 */
export type PeopleDepartmentId = 'sales' | 'service' | 'body' | 'store';

export interface PeopleDepartmentMeta {
  /** Panel title, matching the department names used everywhere else. */
  readonly label: string;
  /** Same glyph the Operations dock gives this department (#346). */
  readonly icon: IconName;
  readonly tone: IconBadgeTone;
  /** What the people in here are FOR — one line, plain language. */
  readonly blurb: string;
}

/**
 * Display copy for each department, owned by the view — the same split as
 * `ManagerStatusCard`'s capability copy. The read models carry ids; the words,
 * glyphs and accents are presentation and live here.
 *
 * Order is the order the panels stack in, and it is the store's own order of
 * operations: you sell a car, you service it, you repair it, and the store-wide
 * jobs sit under all three.
 */
export const DEPARTMENT_META: Record<PeopleDepartmentId, PeopleDepartmentMeta> = {
  sales: {
    label: 'Sales',
    icon: 'handshake',
    tone: 'primary',
    blurb: 'The floor — who talks to buyers and desks the deals.',
  },
  service: {
    label: 'Service',
    icon: 'construct',
    tone: 'positive',
    blurb: 'The shop — who writes repair orders and turns the wrenches.',
  },
  body: {
    label: 'Body Shop',
    icon: 'brush',
    tone: 'accent',
    blurb: 'Collision — who writes estimates and does the panel work.',
  },
  store: {
    label: 'Store-Wide',
    icon: 'storefront',
    tone: 'muted',
    blurb: 'Jobs that answer to the whole store, not one department.',
  },
};

/** Panel stacking order. Every department id appears exactly once. */
export const DEPARTMENT_ORDER: readonly PeopleDepartmentId[] = [
  'sales',
  'service',
  'body',
  'store',
];
