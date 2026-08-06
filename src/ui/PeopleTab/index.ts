/**
 * The People surface barrel (#325). Public UI surface: the People tab and its
 * manager status card, plus the read-model types the composition root builds.
 */
export { PeopleTab } from './PeopleTab';
export type {
  PeopleTabProps,
  PeopleRosterMember,
  PeopleCandidate,
  PeopleHiringModel,
  PeopleRoleOption,
  PeoplePromotionOption,
  PeopleSkillRead,
  PeopleSlotRow,
  PeopleRaiseAsk,
} from './PeopleTab';
export { DEPARTMENT_META, DEPARTMENT_ORDER } from './departments';
export type { PeopleDepartmentId, PeopleDepartmentMeta } from './departments';
export { ManagerStatusCard } from './ManagerStatusCard';
export type {
  ManagerStatusModel,
  UcmCapabilityFact,
  UcmAxis,
  DeptManagerFact,
  DeptFunctionFact,
  DeptManagerKey,
} from './managerStatus';
