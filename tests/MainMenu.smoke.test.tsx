import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MainMenu } from '../src/ui/MainMenu';
import {
  createMultiSlotSaveStore,
  createInMemoryDriverFactory,
} from '../src/game/SaveStore';

function makeStore() {
  return createMultiSlotSaveStore(createInMemoryDriverFactory());
}

describe('MainMenu smoke tests', () => {
  it('renders the main menu without crashing', () => {
    expect(() =>
      render(
        <MainMenu
          saveStore={makeStore()}
          onNewGame={jest.fn()}
          onLoadGame={jest.fn()}
          onContinue={jest.fn()}
          onSettings={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('renders with an existing slot without crashing', async () => {
    const store = makeStore();
    await store.createSlot('Ray Estrada');
    expect(() =>
      render(
        <MainMenu
          saveStore={store}
          onNewGame={jest.fn()}
          onLoadGame={jest.fn()}
          onContinue={jest.fn()}
          onSettings={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('hides Continue when there are no slots, shows it once one exists', async () => {
    const empty = render(
      <MainMenu
        saveStore={makeStore()}
        onNewGame={jest.fn()}
        onLoadGame={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    expect(empty.queryByText('Continue')).toBeNull();

    const store = makeStore();
    await store.createSlot('Ray Estrada');
    const filled = render(
      <MainMenu
        saveStore={store}
        onNewGame={jest.fn()}
        onLoadGame={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    await waitFor(() => expect(filled.getByText('Continue')).toBeTruthy());
  });

  it('shows Settings when the live menu supplies the handler', () => {
    const onSettings = jest.fn();
    const screen = render(
      <MainMenu
        saveStore={makeStore()}
        onNewGame={jest.fn()}
        onLoadGame={jest.fn()}
        onContinue={jest.fn()}
        onSettings={onSettings}
      />,
    );

    fireEvent.press(screen.getByText('Settings'));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('Continue resumes the most-recently-played slot', async () => {
    // Monotonic clock so the two slots get strictly-ordered lastPlayed stamps.
    let tick = 0;
    const store = createMultiSlotSaveStore(createInMemoryDriverFactory(), {
      now: () => `2026-06-05T00:00:0${tick++}.000Z`,
    });
    const older = await store.createSlot('First');
    await store.save({}, { day: 3, tier: 1 });
    const newer = await store.createSlot('Second');
    await store.selectSlot(newer.id);
    await store.save({}, { day: 1, tier: 1 });

    const onContinue = jest.fn();
    const screen = render(
      <MainMenu
        saveStore={store}
        onNewGame={jest.fn()}
        onLoadGame={jest.fn()}
        onContinue={onContinue}
      />,
    );
    await waitFor(() => expect(screen.getByText('Continue')).toBeTruthy());
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(newer.id));
    expect(onContinue).not.toHaveBeenCalledWith(older.id);
  });

  it('Load lists a slot and dispatches onLoadGame on tap', async () => {
    const store = makeStore();
    const slot = await store.createSlot('Ray Estrada');
    await store.save({}, { day: 7, tier: 2 });

    const onLoadGame = jest.fn();
    const screen = render(
      <MainMenu
        saveStore={store}
        onNewGame={jest.fn()}
        onLoadGame={onLoadGame}
        onContinue={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText('Load'));
    const card = await screen.findByText('Ray Estrada');
    // Day + tier metadata is surfaced on the slot card (#195 AC).
    expect(screen.getByText(/Day 7/)).toBeTruthy();
    expect(screen.getByText(/T2/)).toBeTruthy();
    fireEvent.press(card);
    await waitFor(() => expect(onLoadGame).toHaveBeenCalledWith(slot.id));
  });

  it('New Game creates a slot and dispatches onNewGame', async () => {
    const store = makeStore();
    const onNewGame = jest.fn();
    const screen = render(
      <MainMenu
        saveStore={store}
        onNewGame={onNewGame}
        onLoadGame={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText('New Game'));
    fireEvent.changeText(screen.getByPlaceholderText('Name this save'), 'Fresh');
    fireEvent.press(screen.getByText(/Create/));
    await waitFor(() => expect(onNewGame).toHaveBeenCalledTimes(1));
    expect((await store.listSlots()).map((s) => s.name)).toContain('Fresh');
  });
});
