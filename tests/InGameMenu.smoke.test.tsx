import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { InGameMenu } from '../src/ui/InGameMenu';
import type { SlotMetadata } from '../src/game/SaveStore';

const SLOTS: SlotMetadata[] = [
  {
    id: 'slot-a',
    name: 'Ray Estrada',
    day: 4,
    tier: 1,
    lastPlayed: '2026-06-08T12:00:00.000Z',
  },
  {
    id: 'slot-b',
    name: 'Second Store',
    day: 12,
    tier: 2,
    lastPlayed: '2026-06-07T12:00:00.000Z',
  },
];

describe('InGameMenu smoke tests', () => {
  it('renders save, load, settings, resume, and main-menu actions', () => {
    const onClose = jest.fn();
    const onSave = jest.fn();
    const onLoadSlot = jest.fn();
    const onReturnToMainMenu = jest.fn();
    const onSettings = jest.fn();
    const onKPIDashboard = jest.fn();

    const { getByText, getByLabelText } = render(
      <InGameMenu
        slots={SLOTS}
        activeSlotId="slot-a"
        status="Saved."
        onClose={onClose}
        onSave={onSave}
        onLoadSlot={onLoadSlot}
        onReturnToMainMenu={onReturnToMainMenu}
        onSettings={onSettings}
        onKPIDashboard={onKPIDashboard}
      />,
    );

    expect(getByText('Game Menu')).toBeTruthy();
    expect(getByText('Saved.')).toBeTruthy();
    expect(getByText('Ray Estrada')).toBeTruthy();
    expect(getByText('Current')).toBeTruthy();

    fireEvent.press(getByLabelText('Resume game'));
    fireEvent.press(getByText('Save Current Game'));
    fireEvent.press(getByText('Save & Main Menu'));
    fireEvent.press(getByText('Settings'));
    fireEvent.press(getByText('KPI Dashboard'));
    fireEvent.press(getByLabelText('Save current game and load Second Store'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onReturnToMainMenu).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onKPIDashboard).toHaveBeenCalledTimes(1);
    expect(onLoadSlot).toHaveBeenCalledWith('slot-b');
  });
});
