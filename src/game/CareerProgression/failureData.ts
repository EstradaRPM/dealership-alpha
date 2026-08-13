import { z } from 'zod';
import { parseData } from '../data';

/**
 * The failure model's numbers (`data/failure-tunables.json`).
 *
 * Validated rather than cast (#394). The file previously loaded as
 * `rawConfig as FailureTunables`, which is the one shortcut `.claude/rules/
 * data-tunables.md` forbids: a mistyped key produced `undefined` inside a
 * `cash < undefined` comparison — always false — and the failure model would
 * simply never fire, silently, with no load-time complaint.
 *
 * The top level is deliberately NOT `.strict()`: the `regulatory` block in the
 * same file belongs to `Reputation/regulatoryData.ts`, and the `_doc`
 * annotations are the file's own record of why its numbers are what they are.
 * Every block this module claims IS strict.
 */
const Tier2Schema = z
  .object({
    debtPrincipal: z.number().nonnegative(),
    weeklyDebtPayment: z.number().positive(),
  })
  .strict();

const Tier3PlusSchema = z
  .object({
    complianceCost: z.number().nonnegative(),
    reputationHit: z.number(),
  })
  .strict();

export const FailureTunablesSchema = z
  .object({
    cashFloor: z.number(),
    /**
     * The WARNING floor (#394) — cash below this is "running low", which is a
     * different question from `cashFloor`, the level sustained insolvency is
     * measured against. Required to sit above the failure floor: a warning that
     * arrived at or below the level that ends the career would arrive with no
     * runway to act on, which is the entire thing the beat exists to give.
     */
    warningCashFloor: z.number(),
    consecutiveDaysToTrigger: z.number().int().positive(),
    tier2: Tier2Schema,
    tier3Plus: Tier3PlusSchema,
  })
  .refine((c) => c.warningCashFloor > c.cashFloor, {
    message: 'warningCashFloor must sit above cashFloor',
  });

export type FailureTunables = z.infer<typeof FailureTunablesSchema>;

const IndictmentTierSchema = z
  .object({ stakePenalty: z.number().nonnegative() })
  .strict();

export const IndictmentTunablesSchema = z
  .object({
    pressureMax: z.number().positive(),
    pressureThreshold: z.number().nonnegative(),
    lemonLawPressure: z.number().nonnegative(),
    auditFailurePressure: z.number().nonnegative(),
    fraudFlagPressure: z.number().nonnegative(),
    tier2: IndictmentTierSchema,
    tier3Plus: z
      .object({
        legalDefenseCost: z.number().nonnegative(),
        reputationHit: z.number(),
      })
      .strict(),
  })
  .strict();

export type IndictmentTunables = z.infer<typeof IndictmentTunablesSchema>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require('../../../data/failure-tunables.json') as unknown;

export function loadFailureTunables(): FailureTunables {
  return parseData(raw, FailureTunablesSchema, 'data/failure-tunables.json');
}

export function loadIndictmentTunables(): IndictmentTunables {
  // The schema validates only the block this loader returns; the rest of the
  // file is validated by its own owner.
  const wrapper = parseData(
    raw,
    z.object({ indictment: IndictmentTunablesSchema }),
    'data/failure-tunables.json#indictment',
  );
  return wrapper.indictment;
}
