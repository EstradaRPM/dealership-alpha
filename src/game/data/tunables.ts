import { z } from 'zod';
import { parseData } from './loadJson';

export const TunablesSchema = z.object({
  schemaVersion: z.literal(1),
  clock: z.object({
    minutesPerTick: z.number().int().positive(),
    ticksPerDay: z.number().int().positive(),
    daysPerMonth: z.number().int().positive(),
  }),
  floorSim: z.object({
    ticksPerDay: z.number().int().positive(),
    baseDailyArrivals: z.number().nonnegative(),
    reputationArrivalCoeff: z.number().nonnegative(),
    marketShareArrivalCoeff: z.number().nonnegative(),
    seasonArrivalMultiplier: z.object({
      spring: z.number().nonnegative(),
      summer: z.number().nonnegative(),
      fall: z.number().nonnegative(),
      winter: z.number().nonnegative(),
    }),
    // Forced-exception channel (#103): whether escalated cases minted into
    // FloorSim's roster are flagged mustHandle (forced for the player).
    exceptionMustHandle: z.boolean(),
  }),
  handPlay: z.object({
    tickCostPerGate: z.number().int().positive(),
    defaultCustomerDifficulty: z.number().min(0).max(1),
    walkQualityFloor: z.number().min(0).max(1),
    // Default for the hand-play spotlight modal (#118): false ⇒ opening the
    // modal auto-pauses the day; true ⇒ the day keeps running live behind it
    // (the #74/#105 felt-pacing comparison path).
    playtestLiveDefault: z.boolean(),
    approachChoices: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          fitModifier: z.number(),
          difficultyModifier: z.number(),
        }),
      )
      .nonempty(),
  }),
  economy: z.object({
    startingCash: z.number().nonnegative(),
    dailyOverheadBase: z.number().nonnegative(),
  }),
  // Pre-open ownership levers (#120, design #107 d11). v1 = "wired only":
  // the hours-of-op lever selects an option and the composition root holds
  // the scaled `ticksPerDay`; actually feeding it into FloorSim is a
  // downstream slice (FloorSim/#99 is locked and reads its own ticksPerDay).
  ownership: z.object({
    hoursOfOp: z.object({
      // Selectable shift lengths. Longer day ⇒ higher ticksPerDay ⇒ more
      // arrivals (and, downstream, more morale hit per #107 d5).
      options: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            ticksPerDay: z.number().int().positive(),
          }),
        )
        .nonempty(),
      defaultId: z.string().min(1),
    }),
  }),
});

export type Tunables = z.infer<typeof TunablesSchema>;

export function loadTunables(): Tunables {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/tunables.json');
  return parseData(raw, TunablesSchema, 'data/tunables.json');
}
