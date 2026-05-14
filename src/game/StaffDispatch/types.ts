export const EXCEPTION_FLAGS = [
  'vip_customer',
  'high_dollar_deal',
  'irate_customer',
  'lemon_law_threat',
  'audit_trigger',
] as const;

export type ExceptionFlag = (typeof EXCEPTION_FLAGS)[number];
