import type { AppliesTo, EffectKey, EffectVector, Trait, TraitSet } from './schemas/trait';

export type { AppliesTo, EffectKey, EffectVector, Trait, TraitSet };

export class TraitAppliesError extends Error {
  constructor(entityType: AppliesTo, allowed: readonly AppliesTo[]) {
    super(
      `Trait does not apply to entity type "${entityType}" (allowed: ${allowed.join(', ')})`,
    );
    this.name = 'TraitAppliesError';
  }
}

export function resolveEffects(
  traits: readonly Trait[],
  baseline: EffectVector,
  entityType: AppliesTo,
): EffectVector {
  const out: EffectVector = { ...baseline };
  for (const trait of traits) {
    if (!trait.applies_to.includes(entityType)) {
      throw new TraitAppliesError(entityType, trait.applies_to);
    }
    for (const [key, delta] of Object.entries(trait.effects) as [EffectKey, number][]) {
      out[key] = (out[key] ?? 0) + delta;
    }
  }
  return out;
}
