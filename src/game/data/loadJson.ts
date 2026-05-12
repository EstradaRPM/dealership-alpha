import type { ZodType } from 'zod';

export class DataValidationError extends Error {
  constructor(label: string, issues: string) {
    super(`Invalid data file (${label}): ${issues}`);
    this.name = 'DataValidationError';
  }
}

export function parseData<T>(raw: unknown, schema: ZodType<T>, label: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new DataValidationError(label, issues);
  }
  return result.data;
}
