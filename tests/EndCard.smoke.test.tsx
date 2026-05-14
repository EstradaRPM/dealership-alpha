import React from 'react';
import { render } from '@testing-library/react-native';
import { EndCard } from '../src/ui/EndCard';
import type { EndCardData, EndCardReason } from '../src/game/EndCard';
import type { BackstoryId } from '../src/game/CareerProgression';

const REASONS: EndCardReason[] = [
  'bankruptcy',
  'ag_complaint',
  'indictment',
  'retire',
  'sellout',
  'family_handoff',
];
const BACKSTORIES: BackstoryId[] = ['ex-mechanic', 'ex-banker', 'inheritor'];
const TIERS = [1, 2, 3];

function makeData(reason: EndCardReason, backstoryId: BackstoryId, tierReached: number): EndCardData {
  return {
    playerName: 'Ray Estrada',
    backstoryId,
    careerYear: 2,
    tierReached,
    reason,
    flavorText: 'The lot went dark.',
  };
}

describe('EndCard smoke tests', () => {
  for (const reason of REASONS) {
    for (const backstoryId of BACKSTORIES) {
      for (const tier of TIERS) {
        it(`renders without crashing: ${reason} × ${backstoryId} × tier ${tier}`, () => {
          expect(() =>
            render(
              <EndCard
                visible
                data={makeData(reason, backstoryId, tier)}
                onDismiss={jest.fn()}
              />,
            ),
          ).not.toThrow();
        });
      }
    }
  }
});
