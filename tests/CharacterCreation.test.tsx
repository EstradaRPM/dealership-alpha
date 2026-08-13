import React from 'react';
import { render } from '@testing-library/react-native';
import { CharacterCreation } from '../src/ui/CharacterCreation';
import { loadBackstories } from '../src/game/CareerProgression';
import type { SaveStore } from '../src/game/SaveStore';

/**
 * #390 — the character-creation card states what the pick DOES.
 *
 * Before this slice the card offered three flavor paragraphs and no mechanical
 * claim, which was honest only because the picks did nothing. Now one of them
 * opens $25,000 richer and one reads cars better, so the card has to say so.
 */
const stubSaveStore = () =>
  ({
    load: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  }) as unknown as SaveStore;

describe('character creation states each pick (#390)', () => {
  it('each card states what the pick does', () => {
    const { getByTestId } = render(
      <CharacterCreation saveStore={stubSaveStore()} masterSeed={1} onComplete={jest.fn()} />,
    );
    for (const b of loadBackstories()) {
      // Read off the catalog, not off a string in this test — the card and the
      // lever it describes live in one declaration, and this asserts the card
      // renders THAT.
      expect(getByTestId(`backstory-effect-${b.id}`).props.children).toBe(b.effect);
    }
  });

  it('the effect is a mechanical claim, not a second helping of flavor', () => {
    for (const b of loadBackstories()) {
      expect(b.effect).not.toBe(b.flavor);
      // The two levers with a figure attached name it exactly — this is a
      // moment the player is about to commit a whole career on, which is the
      // "exact when you act" half of the #387 money rule.
      const mod = b.modifier;
      // Derived from the lever, so a retune that leaves the sentence behind
      // fails here rather than lying to the player.
      const dollars = (n: number) =>
        `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
      if (mod.startingCapitalBonus > 0) {
        expect(b.effect).toContain(dollars(mod.startingCapitalBonus));
      }
      if (mod.startingCreditLine > 0) {
        expect(b.effect).toContain(dollars(mod.startingCreditLine));
      }
    }
  });

  it('renders without crashing', () => {
    expect(() =>
      render(
        <CharacterCreation saveStore={stubSaveStore()} masterSeed={1} onComplete={jest.fn()} />,
      ),
    ).not.toThrow();
  });
});
