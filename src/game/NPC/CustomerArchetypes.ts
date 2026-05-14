import { parseData } from '../data';
import {
  PersonArchetypeCatalogSchema,
  type PersonArchetype,
  type PersonArchetypeCatalog,
} from './schemas/person-archetype';
import {
  VisitArchetypeCatalogSchema,
  type VisitArchetype,
  type VisitArchetypeCatalog,
} from './schemas/visit-archetype';

export type { PersonArchetype, PersonArchetypeCatalog };
export type { VisitArchetype, VisitArchetypeCatalog };

export function loadPersonArchetypes(): PersonArchetypeCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/person-archetypes.json');
  return parseData(raw, PersonArchetypeCatalogSchema, 'data/person-archetypes.json');
}

export function loadVisitArchetypes(): VisitArchetypeCatalog {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/visit-archetypes.json');
  return parseData(raw, VisitArchetypeCatalogSchema, 'data/visit-archetypes.json');
}
