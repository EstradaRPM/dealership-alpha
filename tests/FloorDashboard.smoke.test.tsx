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
  waiting: 3,
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

  it('renders the live Service card when bound (#309)', () => {
    const { getByTestId, getByText } = render(
      <FloorDashboard
        model={{
          ...MODEL,
          service: {
            intake: 5,
            inProgress: 3,
            waiting: 2,
            avgWaitTicks: 4.2,
            utilization: 0.75,
          },
        }}
      />,
    );
    expect(getByTestId('floor-service-card')).toBeTruthy();
    expect(getByText('SERVICE')).toBeTruthy();
    expect(getByText('75%')).toBeTruthy(); // utilization
  });

  it('omits the Service card when unbound', () => {
    const { queryByTestId } = render(<FloorDashboard model={MODEL} />);
    expect(queryByTestId('floor-service-card')).toBeNull();
  });

  it('renders the live Body-Shop card when bound (#315)', () => {
    const { getByTestId, getByText } = render(
      <FloorDashboard
        model={{
          ...MODEL,
          bodyShop: {
            intake: 4,
            inProgress: 2,
            waiting: 2,
            avgWaitTicks: 6.1,
            utilization: 0.5,
          },
        }}
      />,
    );
    expect(getByTestId('floor-body-shop-card')).toBeTruthy();
    expect(getByText('BODY SHOP')).toBeTruthy();
    expect(getByText('50%')).toBeTruthy(); // utilization
  });

  it('omits the Body-Shop card when unbound (dark below Tier 3)', () => {
    const { queryByTestId } = render(<FloorDashboard model={MODEL} />);
    expect(queryByTestId('floor-body-shop-card')).toBeNull();
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
