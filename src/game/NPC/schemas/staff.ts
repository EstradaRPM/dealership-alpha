import { z } from 'zod';

export const STAFF_TIERS = ['worker', 'customer-facing', 'manager', 'gm'] as const;
export const StaffTierSchema = z.enum(STAFF_TIERS);
export type StaffTier = z.infer<typeof StaffTierSchema>;

export const STAFF_DEPARTMENTS = ['sales', 'service', 'body'] as const;
export const StaffDepartmentSchema = z.enum(STAFF_DEPARTMENTS);
export type StaffDepartment = z.infer<typeof StaffDepartmentSchema>;

export const StaffSkillSchema = z
  .object({
    tier: StaffTierSchema,
    growth_rate: z.number().positive(),
    cap: z.number().min(0).max(100),
    composite_mapping: z.record(z.string().min(1), z.number()).optional(),
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
  })
  .strict();

export type StaffResources = z.infer<typeof StaffResourcesSchema>;
export type StaffCounters = z.infer<typeof StaffCountersSchema>;
export type Staff = z.infer<typeof StaffSchema>;
