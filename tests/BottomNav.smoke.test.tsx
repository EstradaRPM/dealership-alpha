import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BottomNav } from '../src/ui/BottomNav';
import type { DeptKey } from '../src/game/DepartmentQueue';

const ZERO: Record<DeptKey, number> = {
  sales: 0, service: 0, bdc: 0, office: 0, lot: 0, bodyshop: 0,
};

describe('BottomNav smoke tests', () => {
  it('renders all five tabs with zero badges', () => {
    const { getByText } = render(
      <BottomNav badges={ZERO} onPress={() => {}} />,
    );
    for (const label of ['Sales', 'Service', 'BDC', 'Office', 'Lot']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('every tab is tappable even when its badge is zero (#71)', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <BottomNav badges={ZERO} onPress={onPress} />,
    );
    fireEvent.press(getByText('Sales'));
    fireEvent.press(getByText('Lot'));
    expect(onPress).toHaveBeenNthCalledWith(1, 'sales');
    expect(onPress).toHaveBeenNthCalledWith(2, 'lot');
  });

  it('shows the badge count when items are waiting', () => {
    const { getByText } = render(
      <BottomNav badges={{ ...ZERO, bdc: 3 }} onPress={() => {}} />,
    );
    expect(getByText('3')).toBeTruthy();
  });
});
