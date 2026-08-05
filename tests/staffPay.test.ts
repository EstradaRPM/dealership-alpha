import {
  loadStaffPay,
  StaffPayTableSchema,
  gradeFor,
  dailyWageFor,
  loadStaffSlots,
  MIN_GRADE,
  MAX_GRADE,
} from '../src/game/StaffOrg';
import { loadStaffTaxonomy } from '../src/game/NPC';

const GRADES = [1, 2, 3, 4, 5];

describe('staff-pay — the salary book (#353)', () => {
  it('loads a wage for every role at every grade', () => {
    const table = loadStaffPay();
    const roles = Object.keys(loadStaffTaxonomy().roles);
    expect(roles.length).toBeGreaterThan(0);
    for (const roleId of roles) {
      for (const grade of GRADES) {
        const wage = dailyWageFor(table, roleId, grade);
        expect(typeof wage).toBe('number');
        expect(wage).toBeGreaterThan(0);
      }
    }
  });

  it('names every role the slot table opens a desk for', () => {
    // A role you can be hired into but have no wage for would throw at hire
    // time — the slot table is the roster's shape, so the pay book has to
    // cover it, including the tiers whose roles are not built yet.
    const pay = loadStaffPay();
    for (const roleId of Object.keys(loadStaffSlots())) {
      expect(Object.keys(pay.dailyWageByRole)).toContain(roleId);
    }
  });

  it('carries the hire-fee multiple the signing fee is built from', () => {
    expect(loadStaffPay().hireFeeMultiple).toBeGreaterThan(0);
  });

  it('rejects a table where a higher grade costs less', () => {
    const result = StaffPayTableSchema.safeParse({
      gradeBands: [0.3, 0.45, 0.6, 0.75],
      hireFeeMultiple: 5,
      dailyWageByRole: {
        salesperson: { '1': 150, '2': 230, '3': 340, '4': 120, '5': 780 },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects grade bands that do not strictly increase', () => {
    const result = StaffPayTableSchema.safeParse({
      gradeBands: [0.3, 0.45, 0.45, 0.75],
      hireFeeMultiple: 5,
      dailyWageByRole: { salesperson: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a wage row missing a grade', () => {
    const result = StaffPayTableSchema.safeParse({
      gradeBands: [0.3, 0.45, 0.6, 0.75],
      hireFeeMultiple: 5,
      dailyWageByRole: { salesperson: { '1': 1, '2': 2, '3': 3, '4': 4 } },
    });
    expect(result.success).toBe(false);
  });
});

describe('gradeFor — the banded ability read', () => {
  const bands = [0.32, 0.46, 0.6, 0.76];

  it('spans grade 1 through 5 across the ratio range', () => {
    expect(gradeFor(0, bands)).toBe(1);
    expect(gradeFor(0.35, bands)).toBe(2);
    expect(gradeFor(0.5, bands)).toBe(3);
    expect(gradeFor(0.7, bands)).toBe(4);
    expect(gradeFor(1, bands)).toBe(5);
  });

  it('puts the performance ladder\'s own anchors where the ladder says', () => {
    // `staff-performance-ladder.md:27` — green profile 0.35 ≈ grade 1–2,
    // mature reference 0.75 ≈ grade 3–4. The shipped edges have to honour that
    // or the ladder stops being the calibration anchor it exists to be.
    const shipped = loadStaffPay().gradeBands;
    expect(gradeFor(0.35, shipped)).toBeLessThanOrEqual(2);
    expect(gradeFor(0.75, shipped)).toBeGreaterThanOrEqual(3);
    expect(gradeFor(0.75, shipped)).toBeLessThanOrEqual(4);
  });

  it('never leaves the 1–5 ladder', () => {
    for (const ratio of [-1, 0, 0.33, 0.9, 1, 99]) {
      const grade = gradeFor(ratio, bands);
      expect(grade).toBeGreaterThanOrEqual(MIN_GRADE);
      expect(grade).toBeLessThanOrEqual(MAX_GRADE);
    }
  });

  it('is monotonic in ability', () => {
    let prev = 0;
    for (let ratio = 0; ratio <= 1; ratio += 0.01) {
      const grade = gradeFor(ratio, bands);
      expect(grade).toBeGreaterThanOrEqual(prev);
      prev = grade;
    }
  });
});

describe('dailyWageFor', () => {
  const table = loadStaffPay();

  it('clamps an out-of-range grade into the ladder instead of returning nothing', () => {
    expect(dailyWageFor(table, 'salesperson', 0)).toBe(
      dailyWageFor(table, 'salesperson', 1),
    );
    expect(dailyWageFor(table, 'salesperson', 99)).toBe(
      dailyWageFor(table, 'salesperson', 5),
    );
  });

  it('returns undefined for a role the book does not name', () => {
    expect(dailyWageFor(table, 'chief-vibes-officer', 3)).toBeUndefined();
  });

  it('charges more for a better person in the same job', () => {
    for (const roleId of Object.keys(table.dailyWageByRole)) {
      expect(dailyWageFor(table, roleId, 5)!).toBeGreaterThan(
        dailyWageFor(table, roleId, 1)!,
      );
    }
  });
});
