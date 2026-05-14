import rawFlavors from '../../../data/end-card-flavor.json';
import type { BackstoryId } from '../CareerProgression';
import type { EndCardReason } from './types';

interface FlavorEntry {
  reason: EndCardReason;
  backstoryId: BackstoryId;
  text: string;
}

interface FlavorFile {
  schemaVersion: number;
  flavors: FlavorEntry[];
}

const data = rawFlavors as FlavorFile;

export function getFlavorText(reason: EndCardReason, backstoryId: BackstoryId): string {
  const entry = data.flavors.find(
    (f) => f.reason === reason && f.backstoryId === backstoryId,
  );
  return entry?.text ?? 'The lot went dark. No forwarding address.';
}
