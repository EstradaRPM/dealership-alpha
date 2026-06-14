import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  FloorDashboard,
  type FloorDashboardModel,
} from '../src/ui/FloorDashboard';

const MODEL: FloorDashboardModel = {
  day: 3,
  tick: 7,
  ticksPerDay: 20,
  openHour: 9,
  closeHour: 19,
  cash: 48_250,
  ups: 9,
  sold: 2,
  pendingWarm: 3,
  gross: 5_400,
  staff: [
    { id: 's1', role: 'Salesperson', department: 'sales' },
    { id: 's2', role: 'Lot Porter', department: 'unassigned' },
  ],
  events: [{ kind: 'walk', key: 'w0', text: 't2 · lot opened' }],
  inventory: { unitsOnLot: 6, flooredValue: 92_400, avgDaysInInventory: 18.5 },
};

describe('FloorDashboard smoke tests', () => {
  it('renders the HUD + stat grid + secondary panels without crashing', () => {
    expect(() => render(<FloorDashboard model={MODEL} />)).not.toThrow();
  });

  it('renders with negative cash', () => {
    expect(() =>
      render(
        <FloorDashboard model={{ ...MODEL, cash: -1_200, gross: 0 }} />,
      ),
    ).not.toThrow();
  });

  it('renders empty staff / event-log / inventory states', () => {
    expect(() =>
      render(
        <FloorDashboard
          model={{
            ...MODEL,
            staff: [],
            events: [],
            inventory: {
              unitsOnLot: 0,
              flooredValue: 0,
              avgDaysInInventory: 0,
            },
          }}
        />,
      ),
    ).not.toThrow();
  });

  it('renders the inventory-buyer match toast (#199)', () => {
    const { getByText } = render(
      <FloorDashboard
        model={{
          ...MODEL,
          events: [
            { kind: 'match', key: 'm0', text: 'Easy sale — you had what they wanted.' },
          ],
        }}
      />,
    );
    expect(getByText('Easy sale — you had what they wanted.')).toBeTruthy();
  });

  it('renders the live-clock control bar (#121), running and paused', () => {
    const controls = {
      speed: 2,
      speeds: [1, 2, 4] as const,
      paused: false,
      onSetSpeed: () => undefined,
      onTogglePause: () => undefined,
      onSkipToClose: () => undefined,
    };
    expect(() =>
      render(<FloorDashboard model={MODEL} controls={controls} />),
    ).not.toThrow();
    expect(() =>
      render(
        <FloorDashboard
          model={MODEL}
          controls={{ ...controls, paused: true }}
        />,
      ),
    ).not.toThrow();
  });

  it('surfaces the game menu command on the live floor HUD', () => {
    const onOpenGameMenu = jest.fn();
    const { getByLabelText } = render(
      <FloorDashboard model={MODEL} onOpenGameMenu={onOpenGameMenu} />,
    );

    fireEvent.press(getByLabelText('Open game menu'));
    expect(onOpenGameMenu).toHaveBeenCalledTimes(1);
  });

  it('renders morale chips and regulatory pressure when bound', () => {
    const { getByLabelText, getByText } = render(
      <FloorDashboard
        model={{
          ...MODEL,
          regulatoryPressure: { pressure: 24, max: 100 },
          staff: [
            { id: 's1', role: 'Salesperson', department: 'sales', morale: 72 },
          ],
        }}
      />,
    );

    expect(getByText('MORALE 72')).toBeTruthy();
    expect(getByLabelText('Regulatory pressure 24 of 100')).toBeTruthy();
  });
});
