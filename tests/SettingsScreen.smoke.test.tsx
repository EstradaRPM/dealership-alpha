import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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

  // Drives the real dialog rather than a mocked `Alert.alert`. The old form of
  // this test passed while the shipped button did nothing on web, because it
  // asserted that the app *called* an API that is a no-op there.
  it('asks before rolling back, and dispatches the selected snapshot on yes', async () => {
    const onRollback = jest.fn();
    const screen = render(
      <SettingsScreen
        snapshots={SNAPSHOTS}
        onRollback={onRollback}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Week 2  ·  Day 14')).toBeTruthy();
    expect(screen.getByText('Tier 2')).toBeTruthy();

    fireEvent.press(screen.getByText('Week 1  ·  Day 7'));
    await screen.findByText('Rollback Save');
    expect(
      screen.getByText(
        'Restore to Week 1  ·  Day 7, Tier 1? Progress since then will be lost.',
      ),
    ).toBeTruthy();
    expect(onRollback).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Rollback'));
    await waitFor(() => expect(onRollback).toHaveBeenCalledWith(1));
  });

  it('rolls nothing back when the question is declined', async () => {
    const onRollback = jest.fn();
    const screen = render(
      <SettingsScreen
        snapshots={SNAPSHOTS}
        onRollback={onRollback}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('Week 1  ·  Day 7'));
    await screen.findByText('Rollback Save');
    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => expect(screen.queryByText('Rollback Save')).toBeNull());
    expect(onRollback).not.toHaveBeenCalled();
  });
});
