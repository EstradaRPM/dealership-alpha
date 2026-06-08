import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PersonnelScreen } from '../src/ui/PersonnelScreen';
import type { CandidateListing } from '../src/game/StaffOrg';
import type { StaffWithComposites } from '../src/game/StaffOrg/types';

function makeStaff(id: string, roleId: string): StaffWithComposites {
  const staff = {
    id,
    role_id: roleId,
    trait_ids: ['steady'],
    skills: {
      communication: 55,
      finance_structuring: 65,
      product_presentation: 62,
    },
    resources: { stamina: 100 },
    counters: { experience: 0, deals_closed: 0, days_employed: 1 },
  } as unknown as StaffWithComposites;
  Object.defineProperties(staff, {
    effectiveness: { get: () => 0.7 },
    trustworthiness: { get: () => 0.75 },
  });
  return staff;
}

const FNI_CANDIDATE: CandidateListing = {
  candidateId: 'candidate:f&i-manager:1:0',
  archetypeId: 'paperwork_closer',
  staff: makeStaff('staff:f&i-manager:1:0', 'f&i-manager'),
  hiringCost: 3_000,
};

describe('PersonnelScreen smoke tests', () => {
  it('renders role selection, hires from the selected role, and fires roster staff', () => {
    const onSelectRole = jest.fn();
    const onHire = jest.fn();
    const onFire = jest.fn();
    const { getByText, getByLabelText } = render(
      <PersonnelScreen
        roleOptions={[
          { id: 'salesperson', label: 'Salesperson' },
          { id: 'f&i-manager', label: 'F&I Manager' },
          { id: 'used-car-manager', label: 'Used Car Manager' },
        ]}
        selectedRoleId="f&i-manager"
        candidates={[FNI_CANDIDATE]}
        roster={[makeStaff('staff:salesperson:1:0', 'salesperson')]}
        skillCaps={{
          communication: 100,
          finance_structuring: 100,
          product_presentation: 100,
        }}
        cash={10_000}
        onSelectRole={onSelectRole}
        onHire={onHire}
        onFire={onFire}
        onClose={() => {}}
      />,
    );

    fireEvent.press(getByText('Used Car Manager'));
    expect(onSelectRole).toHaveBeenCalledWith('used-car-manager');

    fireEvent.press(getByText('paperwork closer'));
    fireEvent.press(getByText('Hire for $3,000'));
    expect(onHire).toHaveBeenCalledWith('candidate:f&i-manager:1:0');

    fireEvent.press(getByLabelText('Fire salesperson'));
    expect(onFire).toHaveBeenCalledWith('staff:salesperson:1:0');
  });
});
