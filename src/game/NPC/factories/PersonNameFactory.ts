import { createRng, deriveSeed } from '../../Rng';
import { parseData } from '../../data';
import {
  PersonNameCatalogSchema,
  type PersonNameCatalog,
} from '../schemas/person-name';

export const PERSON_NAME_NAMESPACE = 'npc.person.name';

export function loadPersonNameCatalog(): PersonNameCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../../data/person-names.json');
  return parseData(raw, PersonNameCatalogSchema, 'data/person-names.json');
}

// The name pool is a static catalog, not a per-world tunable — every world
// draws from the same lists — so it loads once rather than threading an
// optional dep through `createStaff` / `rehydrateStaff` / `promoteStaff`. An
// optional dep would mean a *nameless* person on whichever path forgot it, and
// the whole point of #347 is that the people you hire, raise, and lose have
// names on every path.
let cached: PersonNameCatalog | undefined;

/**
 * The name of the person with this entity id (#347).
 *
 * **Derived, never stored** — the same reasoning as the per-hire skill cap
 * (#294): `(masterSeed, entityId)` fully determines the name, so a name costs
 * no field on `Staff`, no `.strict()` schema change, and **no save migration**.
 * A roster rehydrated from a JSON save re-derives the identical name because
 * `StaffOrg.restore` hands `rehydrateStaff` the same `masterSeed`.
 */
export function rollPersonName(
  masterSeed: number,
  entityId: string,
  catalog: PersonNameCatalog = (cached ??= loadPersonNameCatalog()),
): string {
  const rng = createRng(
    deriveSeed(masterSeed, PERSON_NAME_NAMESPACE, { entityId }),
  );
  const first = catalog.first[Math.floor(rng() * catalog.first.length)];
  const last = catalog.last[Math.floor(rng() * catalog.last.length)];
  return `${first} ${last}`;
}
