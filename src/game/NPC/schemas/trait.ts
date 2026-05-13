import { z } from 'zod';

export const APPLIES_TO_VALUES = ['customer', 'staff'] as const;
export const AppliesToSchema = z.enum(APPLIES_TO_VALUES);
export type AppliesTo = z.infer<typeof AppliesToSchema>;

export const EFFECT_KEYS = [
  'spaced_weight.economy',
  'spaced_weight.luxury',
  'spaced_weight.truck',
  'trust_build_rate',
  'price_sensitivity',
  'patience',
  'closing_skill',
  'desking_skill',
] as const;
export const EffectKeySchema = z.enum(EFFECT_KEYS);
export type EffectKey = z.infer<typeof EffectKeySchema>;

const EffectsSchema = z
  .object(
    Object.fromEntries(EFFECT_KEYS.map((k) => [k, z.number().optional()])) as Record<
      EffectKey,
      z.ZodOptional<z.ZodNumber>
    >,
  )
  .strict();

export const TraitSchema = z.object({
  applies_to: z.array(AppliesToSchema).nonempty(),
  effects: EffectsSchema,
});

export const TraitSetSchema = z.record(z.string().min(1), TraitSchema);

export type Trait = z.infer<typeof TraitSchema>;
export type TraitSet = z.infer<typeof TraitSetSchema>;
export type EffectVector = Partial<Record<EffectKey, number>>;
