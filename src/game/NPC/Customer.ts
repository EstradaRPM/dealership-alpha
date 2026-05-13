import type {
  SPACEDVector,
  PSQTCVector,
  Person,
  PersonCounters,
  VisitResources,
  SalesVisit,
  ServiceVisit,
  BodyVisit,
  Visit,
} from './schemas/customer';

export type {
  SPACEDVector,
  PSQTCVector,
  Person,
  PersonCounters,
  VisitResources,
  SalesVisit,
  ServiceVisit,
  BodyVisit,
  Visit,
};

type SPACEDKey = keyof SPACEDVector;
type PSQTCKey = keyof PSQTCVector;

export function hotButtons(visit: SalesVisit, topN: number): SPACEDKey[];
export function hotButtons(visit: ServiceVisit | BodyVisit, topN: number): PSQTCKey[];
export function hotButtons(
  visit: Visit,
  topN: number,
): SPACEDKey[] | PSQTCKey[] {
  const entries = Object.entries(visit.preferences) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, topN).map(([k]) => k) as SPACEDKey[] | PSQTCKey[];
}
