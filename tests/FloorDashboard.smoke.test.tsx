import React from 'react';
import { render } from '@testing-library/react-native';
import {
  FloorDashboard,
  type FloorDashboardModel,
} from '../src/ui/FloorDashboard';

const MODEL: FloorDashboardModel = {
  day: 3,
  tick: 7,
  ticksPerDay: 20,
  cash: 48_250,
  exceptionPending: false,
  ups: 9,
  sold: 2,
  walked: 4,
  pendingWarm: 3,
  gross: 5_400,
  staff: [
    { id: 's1', role: 'Salesperson', department: 'sales' },
    { id: 's2', role: 'Lot Porter', department: 'unassigned' },
  ],
  events: [
    { kind: 'walk', key: 'w0', text: 't2 · a customer walked — no capacity' },
    {
      kind: 'exception',
      key: 'e1',
      customerId: 'floor:3:5:0',
      text: 't5 · sales exception — needs you',
    },
  ],
  inventory: { unitsOnLot: 6, flooredValue: 92_400, avgDaysInInventory: 18.5 },
};

describe('FloorDashboard smoke tests', () => {
  it('renders the HUD + stat grid + secondary panels without crashing', () => {
    expect(() => render(<FloorDashboard model={MODEL} />)).not.toThrow();
  });

  it('renders with a pending forced exception + negative cash', () => {
    expect(() =>
      render(
        <FloorDashboard
          model={{ ...MODEL, exceptionPending: true, cash: -1_200, gross: 0 }}
        />,
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

  it('renders with an exception-press handler wired', () => {
    expect(() =>
      render(
        <FloorDashboard model={MODEL} onExceptionPress={() => undefined} />,
      ),
    ).not.toThrow();
  });
});
