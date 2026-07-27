import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlaytestFlag } from '../src/ui/PlaytestFlag';
import { createPlaytestLog, attachPlaytestCapture } from '../src/game/PlaytestLog';
import { createInMemoryDriver, createInMemoryDriverFactory } from '../src/game/SaveStore';
import { createAppServices } from '../src/app/services';
import { createEventBus } from '../src/game/EventBus';

// #332 — the #74 playtest recorder. These guard the two ways the tool can be
// silently useless: the flag FAB not actually reaching the log, and the capture
// or the log itself not being wired into app composition (in which case the
// player records a whole session into nothing).

const METRICS = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderFlag(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);
}

describe('PlaytestFlag — the one-tap capture path (#332)', () => {
  it('records a note into the live log through the FAB', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    const ctx = { day: 3, phase: 'FLOOR_OPEN', cash: 40000, tier: 1 };

    const { getByTestId } = renderFlag(
      <PlaytestFlag
        count={0}
        onOpen={() => {}}
        onSave={(note) => log.flag(note, ctx)}
      />,
    );

    fireEvent.press(getByTestId('playtest-flag-fab'));
    fireEvent.changeText(getByTestId('playtest-flag-note'), 'day 3 dragged badly');
    fireEvent.press(getByTestId('playtest-flag-save'));

    expect(log.count()).toBe(1);
    expect(log.entries()[0]).toMatchObject({
      kind: 'flag',
      note: 'day 3 dragged badly',
      ctx,
    });
  });

  it('stamps context when the FAB is tapped, not when the note is saved', () => {
    // The whole reason the context is captured on open: a player reacts at
    // moment X and finishes typing at moment Y, and X is the useful one.
    const log = createPlaytestLog(createInMemoryDriver());
    let liveDay = 3;
    let stamped = { day: 0, phase: '', cash: 0, tier: 0 };

    const { getByTestId } = renderFlag(
      <PlaytestFlag
        count={0}
        onOpen={() => { stamped = { day: liveDay, phase: 'FLOOR_OPEN', cash: 1, tier: 1 }; }}
        onSave={(note) => log.flag(note, stamped)}
      />,
    );

    fireEvent.press(getByTestId('playtest-flag-fab'));
    liveDay = 4; // the day rolls over while the sheet is open
    fireEvent.press(getByTestId('playtest-flag-save'));

    expect(log.entries()[0]).toMatchObject({ ctx: { day: 3 } });
  });

  it('saves a bare flag with no note typed', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    const { getByTestId } = renderFlag(
      <PlaytestFlag
        count={0}
        onOpen={() => {}}
        onSave={(note) => log.flag(note, { day: 1, phase: 'MANAGERIAL', cash: 0, tier: 1 })}
      />,
    );

    fireEvent.press(getByTestId('playtest-flag-fab'));
    fireEvent.press(getByTestId('playtest-flag-save'));

    expect(log.count()).toBe(1);
    expect(log.entries()[0]).toMatchObject({ note: '' });
  });

  it('cancel records nothing', () => {
    const log = createPlaytestLog(createInMemoryDriver());
    const { getByTestId, getByText } = renderFlag(
      <PlaytestFlag
        count={0}
        onOpen={() => {}}
        onSave={(note) => log.flag(note, { day: 1, phase: 'MANAGERIAL', cash: 0, tier: 1 })}
      />,
    );

    fireEvent.press(getByTestId('playtest-flag-fab'));
    fireEvent.changeText(getByTestId('playtest-flag-note'), 'never mind');
    fireEvent.press(getByText('Cancel'));

    expect(log.count()).toBe(0);
  });

  it('shows the running entry count on the FAB so it reads as recording', () => {
    const { getByTestId } = renderFlag(
      <PlaytestFlag count={7} onOpen={() => {}} onSave={() => {}} />,
    );
    expect(getByTestId('playtest-flag-fab')).toHaveTextContent('⚑ 7');
  });
});

describe('PlaytestLog — app composition (#332)', () => {
  it('createAppServices exposes a hydrated playtest log on its own driver cell', async () => {
    const factory = createInMemoryDriverFactory();
    const services = createAppServices(factory);

    expect(services.playtestLog).toBeDefined();
    services.playtestLog.flag('composed', { day: 1, phase: 'MANAGERIAL', cash: 0, tier: 1 });
    await services.playtestLog.flush();

    // Its own cell — nothing the world save writes can collide with it, which
    // is what lets the log outlive a Reset Save.
    const raw = await factory('playtest-log').read();
    expect(raw).toContain('composed');
  });

  it('survives a save wipe — the log is not slot-scoped', async () => {
    const factory = createInMemoryDriverFactory();
    const services = createAppServices(factory);
    await services.slotStore.createSlot('round 1');

    services.playtestLog.flag('day 1 note', { day: 1, phase: 'MANAGERIAL', cash: 0, tier: 1 });
    await services.playtestLog.flush();
    await services.saveStore.clear();

    const reopened = createAppServices(factory);
    await reopened.playtestLog.hydrate();
    expect(reopened.playtestLog.count()).toBe(1);
  });

  it('capture survives a cold restart and keeps appending to the same log', async () => {
    const factory = createInMemoryDriverFactory();
    const first = createAppServices(factory);
    const bus1 = createEventBus();
    attachPlaytestCapture(bus1, first.playtestLog, () => 1);
    bus1.publish('staff:auto_resolved', {
      customerId: 'c1', staffId: 's1', day: 1, outcome: 'no_sale', grossImpact: 0, reason: 'no_fit',
    });
    await first.playtestLog.flush();

    const second = createAppServices(factory);
    await second.playtestLog.hydrate();
    const bus2 = createEventBus();
    attachPlaytestCapture(bus2, second.playtestLog, () => 2);
    bus2.publish('staff:auto_resolved', {
      customerId: 'c2', staffId: 's1', day: 2, outcome: 'no_sale', grossImpact: 0, reason: 'no_close',
    });

    expect(second.playtestLog.counts().walk).toBe(2);
    expect(second.playtestLog.entries().map((e) => e.seq)).toEqual([0, 1]);
  });

  it('AppOverlays wires the capture, the FAB and the console read-out', () => {
    // Anti-orphan guard: the module can be perfectly correct and still record
    // nothing if the composition site drops it.
    const src = fs.readFileSync(
      path.join(__dirname, '../src/app/screens/AppOverlays.tsx'),
      'utf8',
    );
    expect(src).toContain('attachPlaytestCapture(bus, playtestLog');
    expect(src).toContain('<PlaytestFlag');
    expect(src).toContain('playtestLog={playtestLog}');

    const root = fs.readFileSync(path.join(__dirname, '../src/app/AppRoot.tsx'), 'utf8');
    expect(root).toContain('playtestLog={services.playtestLog}');

    const console_ = fs.readFileSync(
      path.join(__dirname, '../src/ui/AdminConsole/AdminConsole.tsx'),
      'utf8',
    );
    expect(console_).toContain('PLAYTEST LOG');
    expect(console_).toContain('exportMarkdown(');
  });
});
