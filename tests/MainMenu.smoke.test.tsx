import React from 'react';
import { render } from '@testing-library/react-native';
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
          onSettings={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
