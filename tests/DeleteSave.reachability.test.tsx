import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MainMenu } from '../src/ui/MainMenu';
import {
  createMultiSlotSaveStore,
  createInMemoryDriverFactory,
} from '../src/game/SaveStore';

/**
 * Anti-orphan proof for deleting a save (2026-08-11).
 *
 * `MultiSlotSaveStore.deleteSlot` has existed since #195 and the menu has had a
 * Delete button since then too — but the confirmation it opened was
 * `Alert.alert`, which is a no-op on react-native-web. On the web target the
 * button was dead: pressing it did nothing, and there is no way to reach
 * browser storage from inside the game to clear a save by hand. These drive the
 * whole path through the live component, so "the mechanic exists" and "a player
 * can use it" cannot drift apart again.
 */
function makeStore() {
  return createMultiSlotSaveStore(createInMemoryDriverFactory());
}

function menu(store: ReturnType<typeof makeStore>) {
  return render(
    <MainMenu
      saveStore={store}
      onNewGame={jest.fn()}
      onLoadGame={jest.fn()}
      onContinue={jest.fn()}
    />,
  );
}

describe('deleting a save from the live menu', () => {
  it('Delete rides the LOAD list, not only the New Game one', async () => {
    const store = makeStore();
    await store.createSlot('Ray Estrada');

    const screen = menu(store);
    fireEvent.press(screen.getByText('Load'));
    await screen.findByText('Ray Estrada');
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('confirming removes the slot from the store and from the list', async () => {
    const store = makeStore();
    const slot = await store.createSlot('Ray Estrada');
    await store.save({}, { day: 12, tier: 2 });

    const screen = menu(store);
    fireEvent.press(screen.getByText('Load'));
    await screen.findByText('Ray Estrada');

    fireEvent.press(screen.getByText('Delete'));
    // The question is on screen — this is the half that was invisible on web.
    const confirm = await screen.findByText('Delete Save');
    expect(confirm).toBeTruthy();
    expect(screen.getByText(/Ray Estrada.*Day 12/)).toBeTruthy();

    // While the dialog is up, the list behind it is inaccessible (the sheet is
    // `accessibilityViewIsModal`), so this uniquely resolves to the dialog's
    // acting button rather than the row label that opened it.
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(async () => expect(await store.listSlots()).toEqual([]));
    await waitFor(() => expect(screen.queryByText('Ray Estrada')).toBeNull());
    // Deleting the active slot clears the selection rather than leaving a
    // pointer at a blob that is gone.
    expect(await store.getActiveSlotId()).toBeNull();
    expect(slot.id).toBe('slot-1');
  });

  it('cancelling leaves the save alone', async () => {
    const store = makeStore();
    await store.createSlot('Ray Estrada');

    const screen = menu(store);
    fireEvent.press(screen.getByText('Load'));
    await screen.findByText('Ray Estrada');

    fireEvent.press(screen.getByText('Delete'));
    await screen.findByText('Delete Save');
    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => expect(screen.queryByText('Delete Save')).toBeNull());
    expect((await store.listSlots()).map((s) => s.name)).toEqual(['Ray Estrada']);
  });

  it('a freed slot can be filled again — the cap is not permanently spent', async () => {
    const store = makeStore();
    await store.createSlot('One');
    await store.createSlot('Two');
    await store.createSlot('Three');

    const screen = menu(store);
    fireEvent.press(screen.getByText('New Game'));
    await screen.findByText('One');
    // At the cap the name field is withheld; the way forward is a delete.
    expect(screen.queryByPlaceholderText('Name this save')).toBeNull();

    fireEvent.press(screen.getAllByText('Delete')[0] as never);
    await screen.findByText('Delete Save');
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Name this save')).toBeTruthy(),
    );
    expect((await store.listSlots()).map((s) => s.name)).toEqual(['Two', 'Three']);
  });
});
