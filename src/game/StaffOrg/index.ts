export { createStaffOrg, StaffOrgError } from './StaffOrg';
export type {
  StaffOrg,
  StaffOrgDeps,
  StaffOrgSnapshot,
  ConditionAssessInput,
  PromotionOption,
  RoleSlots,
} from './StaffOrg';
export { loadStaffSlots, slotTotalFor, StaffSlotTableSchema, MAX_TIER } from './staffSlots';
export type { StaffSlotTable } from './staffSlots';
export type { CandidateListing, StaffWithComposites } from './types';
export { loadStaffOrgConfig } from './staffOrgData';
export type { StaffOrgConfig, ConditionReadConfig } from './staffOrgData';
export {
  computeConditionRead,
  deriveConditionReadSeed,
  CONDITION_READING_SKILL_ID,
  CONDITION_READ_NAMESPACE,
} from './conditionRead';
export type { ConditionRead, ConditionReadInputs } from './conditionRead';
