import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SettingsScreen } from '../src/ui/SettingsScreen';
import type { WeeklySnapshot } from '../src/game/SaveStore';

const SNAPSHOTS: WeeklySnapshot[] = [
  { day: 14, tier: 2, state: { cash: 62_000 } },
  { day: 7, tier: 1, state: { cash: 54_000 } },
];

describe('SettingsScreen smoke', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the empty snapshot state and close action', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <SettingsScreen snapshots={[]} onRollback={jest.fn()} onClose={onClose} />,
    );

    expect(getByText('SETTINGS')).toBeTruthy();
    expect(
      getByText('No snapshots yet. One is saved at the end of each week.'),
    ).toBeTruthy();

    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirms before dispatching rollback for the selected snapshot', () => {
    const onRollback = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Rollback')?.onPress?.();
    });

    const { getByText } = render(
      <SettingsScreen
        snapshots={SNAPSHOTS}
        onRollback={onRollback}
        onClose={jest.fn()}
      />,
    );

    expect(getByText('Week 2  ·  Day 14')).toBeTruthy();
    expect(getByText('Tier 2')).toBeTruthy();

    fireEvent.press(getByText('Week 1  ·  Day 7'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Rollback Save',
      'Restore to Week 1  ·  Day 7, Tier 1? Progress since then will be lost.',
      expect.any(Array),
    );
    expect(onRollback).toHaveBeenCalledWith(1);
  });
});
