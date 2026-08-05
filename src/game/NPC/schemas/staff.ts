import { z } from 'zod';

export const STAFF_TIERS = ['worker', 'customer-facing', 'manager', 'gm'] as const;
export const StaffTierSchema = z.enum(STAFF_TIERS);
export type StaffTier = z.infer<typeof StaffTierSchema>;

export const STAFF_DEPARTMENTS = ['sales', 'service', 'body'] as const;
export const StaffDepartmentSchema = z.enum(STAFF_DEPARTMENTS);
export type StaffDepartment = z.infer<typeof StaffDepartmentSchema>;

// Channel-desk M7 (#294) — Model B derived skill growth. A manager's effective
// skill = base (rolled at hire) + growth(counter), clamped to a per-hire cap.
// `growth_counter` names which dormant `StaffCounters` field drives growth on
// this axis (`deals_closed` → desking/negotiation, `days_employed` → general
// read); omit it and the axis is static. `cap_headroom` is the per-hire growth
// ceiling distribution: cap = min(skill cap, base + max(0, gaussian(mu, sigma)))
// rolled deterministically from the staff id, so a cheap hire plateaus below the
// top capabilities (preserving the hire-vs-grow decision). Magnitudes are
// placeholders — calibration is deferred to S14 (#286).
export const SkillCapHeadroomSchema = z
  .object({ mu: z.number().nonnegative(), sigma: z.number().nonnegative() })
  .strict();

export const StaffSkillSchema = z
  .object({
    // Plain-language name for the axis, as the player reads it on a staff card
    // (#347). Required, so a skill added to the data can never reach a surface
    // as a de-slugged id — "t_o_closing" rendered as "t o closing" is what the
    // drive-through audit found on the roster.
    label: z.string().min(1),
    tier: StaffTierSchema,
    growth_rate: z.number().positive(),
    cap: z.number().min(0).max(100),
    composite_mapping: z.record(z.string().min(1), z.number()).optional(),
    growth_counter: z
      .enum(['experience', 'deals_closed', 'days_employed'])
      .optional(),
    cap_headroom: SkillCapHeadroomSchema.optional(),
  })
  .strict();

export const StaffSkillCatalogSchema = z.record(z.string().min(1), StaffSkillSchema);

export const StaffRoleSchema = z
  .object({
    tier: StaffTierSchema,
    department: StaffDepartmentSchema.nullable(),
    grants_skills: z.array(z.string().min(1)),
    promotes_to: z.array(z.string().min(1)),
    promotion_gates: z.record(z.string().min(1), z.number()),
    hireTier: z.number().int().min(1).optional(),
  })
  .strict();

export const StaffRoleCatalogSchema = z.record(z.string().min(1), StaffRoleSchema);

export type StaffSkill = z.infer<typeof StaffSkillSchema>;
export type StaffSkillCatalog = z.infer<typeof StaffSkillCatalogSchema>;
export type StaffRole = z.infer<typeof StaffRoleSchema>;
export type StaffRoleCatalog = z.infer<typeof StaffRoleCatalogSchema>;

export const StaffResourcesSchema = z
  .object({
    stamina: z.number(),
    morale: z.number().optional(),
  })
  .strict();

export const StaffCountersSchema = z
  .object({
    experience: z.number(),
    deals_closed: z.number(),
    days_employed: z.number(),
  })
  .strict();

export const StaffSchema = z
  .object({
    id: z.string().min(1),
    role_id: z.string().min(1),
    trait_ids: z.array(z.string().min(1)),
    skills: z.record(z.string().min(1), z.number().min(0).max(100)),
    resources: StaffResourcesSchema,
    counters: StaffCountersSchema,
    // The grade this person is PAID at (#353, C1 internal call 2) — stamped by
    // StaffOrg when they are hired and moved only when a raise is accepted.
    // Current grade is derived from grown skills and climbs on its own;
    // `currentGrade > paidGrade` IS the raise trigger, so the whole mechanic
    // costs one number and no state machine. Deliberately NOT set by the
    // factories: a candidate on the board is not on anyone's payroll, and this
    // is the only field on `Staff` that means "employed here".
    //
    // Optional because saves predating the wage book lack it (StaffOrg.restore
    // materializes it from the member's current derived grade) and because the
    // candidate pool carries `Staff` records that have never been hired.
    paidGrade: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export type StaffResources = z.infer<typeof StaffResourcesSchema>;
export type StaffCounters = z.infer<typeof StaffCountersSchema>;
export type Staff = z.infer<typeof StaffSchema>;
