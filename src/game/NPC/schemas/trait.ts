import { z } from 'zod';

export const APPLIES_TO_VALUES = ['customer', 'staff', 'competitor'] as const;
export const AppliesToSchema = z.enum(APPLIES_TO_VALUES);
export type AppliesTo = z.infer<typeof AppliesToSchema>;

export const EFFECT_KEYS = [
  'spaced_weight.economy',
  'spaced_weight.luxury',
  'spaced_weight.truck',
  'trust_build_rate',
  'price_sensitivity',
  'patience',
  // How this customer pays (#153). `payment.cash_probability` shifts the visit
  // archetype's base cash leaning; `payment.must_finance` is categorical — any
  // positive total means the customer will not pay cash whatever the roll says
  // or their means allow. Two keys rather than one dominating negative,
  // because "leans toward cash" and "wants the tradeline" are different facts
  // about a person, not two sizes of the same one.
  'payment.cash_probability',
  'payment.must_finance',
  'closing_skill',
  'desking_skill',
  'competitor.csi',
  'competitor.inventory_size',
  'competitor.pricing',
  'competitor.reputation_drift',
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
