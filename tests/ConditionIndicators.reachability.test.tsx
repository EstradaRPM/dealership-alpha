import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { loadRegulatoryTunables } from '../src/game/Reputation';
import { FloorDashboard } from '../src/ui/FloorDashboard';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { FloorDashboardModel } from '../src/ui/FloorDashboard';

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

describe('#205 condition indicators - reachable through the live pipeline', () => {
  it('renders live StaffMorale and regulatory pressure through the floor mode', () => {
    const bus = createEventBus();
    const world = createWorld({
      bus,
      masterSeed: 205,
      characterProfile: PROFILE,
    });
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    expect(candidate).toBeDefined();
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    bus.publish('staff:auto_resolved', {
      customerId: 'c1',
      staffId,
      day: 1,
      outcome: 'closed',
      grossImpact: 2500,
    });
    bus.publish('capacity:missed_opportunity', {
      day: 1,
      customerId: 'm1',
      label: 'missed buyer',
    });

    const floor = world.dayLoop.nextDay();
    const loopState = world.dayLoop.state();
    const regulatoryTunables = loadRegulatoryTunables();
    const regulatoryPressure = {
      pressure: world.regulatoryMeter.pressure,
      max: regulatoryTunables.pressureMax,
    };
    const floorModel: FloorDashboardModel = {
      day: loopState.day,
      tick: floor.currentTick,
      ticksPerDay: floor.ticksPerDay,
      openHour: 9,
      closeHour: 19,
      cash: world.economy.cash,
      exceptionPending: false,
      ups: 0,
      sold: 0,
      pendingWarm: 0,
      gross: 0,
      regulatoryPressure,
      staff: world.staffOrg.currentRoster.map((s) => ({
        id: s.id,
        role: 'Salesperson',
        department: 'sales',
        morale: world.staffMorale.getMorale(s.id),
      })),
      events: [],
      inventory: { unitsOnLot: 0, flooredValue: 0, avgDaysInInventory: 0 },
    };

    const { getByLabelText, getByText } = render(
      <FloorDashboard model={floorModel} />,
    );

    expect(
      getByText(`MORALE ${Math.round(world.staffMorale.getMorale(staffId))}`),
    ).toBeTruthy();
    expect(
      getByLabelText(
        `Regulatory pressure ${Math.round(world.regulatoryMeter.pressure)} ` +
          `of ${regulatoryTunables.pressureMax}`,
      ),
    ).toBeTruthy();
  });

  it('App.tsx wires both indicators from the live world into the floor mode', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');

    expect(src).toMatch(/pressure: world\.regulatoryMeter\.pressure/);
    expect(src).toMatch(/max: REGULATORY_TUNABLES\.pressureMax/);
    expect(src).toMatch(/morale: world\.staffMorale\.getMorale\(s\.id\)/);
    // The floor read-model (which carries regulatoryPressure + morale) reaches
    // the live full-screen floor MODE.
    expect(src).toMatch(/<FloorDashboard\s+model=\{floorModel\}/);
  });
});
