import React from 'react';
import { render } from '@testing-library/react-native';
import {
  OwnershipLevers,
  FniPeakMeter,
  type FniPeakBar,
  type OwnershipLeversProps,
} from '../src/ui/OwnershipLevers';

/**
 * #370 — the posture peak meter's surface half.
 *
 * The model is tested in `FniPeakModel.test.ts`; this asserts the two things a
 * surface can get wrong on its own — that it changes nothing by being looked
 * at, and that it says what its bars measure in language a layperson reads
 * right the first time.
 */

const BARS: readonly FniPeakBar[] = [
  {
    id: 'more-per-deal',
    label: 'More per deal',
    reservePerDeal: 777,
    stickRate: 0.891,
    expectedGrossPerDeal: 2445,
    satisfactionCostPerDeal: -0.47,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    reservePerDeal: 641,
    stickRate: 1,
    expectedGrossPerDeal: 2641,
    satisfactionCostPerDeal: 0,
  },
  {
    id: 'more-deals',
    label: 'More deals',
    reservePerDeal: 404,
    stickRate: 1,
    expectedGrossPerDeal: 2404,
    satisfactionCostPerDeal: 0,
  },
];

const BASE_LEVERS: OwnershipLeversProps = {
  enabled: true,
  hoursOptions: [{ id: 'standard', label: '10 hrs', ticksPerDay: 180 }],
  hoursOfOpId: 'standard',
  onSelectHours: jest.fn(),
  tradePolicyOptions: [
    { id: 'market', label: 'Market', blurb: 'Appraise at honest book.' },
  ],
  tradePolicyId: 'market',
  onSelectTradePolicy: jest.fn(),
  fniPostureOptions: BARS.map((b) => ({
    id: b.id,
    label: b.label,
    blurb: `${b.label} blurb.`,
  })),
  fniPostureId: 'balanced',
  onSelectFniPosture: jest.fn(),
  fniDeskStaffed: true,
};

describe('#370 the F&I posture peak meter', () => {
  it('the meter is a pure read', () => {
    // Nothing on this surface is a control: it fires no callback, it takes no
    // press, and rendering it a second time produces the same tree. The dial
    // above it is the input; the meter is what the input is worth.
    const spies = {
      onSelectHours: jest.fn(),
      onSelectTradePolicy: jest.fn(),
      onSelectFniPosture: jest.fn(),
    };
    const screen = render(
      <OwnershipLevers
        {...BASE_LEVERS}
        {...spies}
        fniPeak={{
          postures: BARS,
          selectedId: 'balanced',
          peakId: 'balanced',
          dealsRead: 12,
        }}
      />,
    );

    expect(screen.getByTestId('fni-peak-meter')).toBeTruthy();
    const before = screen.getByTestId('fni-peak-callout').props.children;

    screen.rerender(
      <OwnershipLevers
        {...BASE_LEVERS}
        {...spies}
        fniPeak={{
          postures: BARS,
          selectedId: 'balanced',
          peakId: 'balanced',
          dealsRead: 12,
        }}
      />,
    );

    expect(screen.getByTestId('fni-peak-callout').props.children).toEqual(before);
    expect(spies.onSelectHours).not.toHaveBeenCalled();
    expect(spies.onSelectTradePolicy).not.toHaveBeenCalled();
    expect(spies.onSelectFniPosture).not.toHaveBeenCalled();

    // The meter adds no pressable of its own — Prep's controls are still only
    // the policy chips (#346 keeps navigation out of Prep, and a read-out that
    // grew a button would be an input the grill did not sanction).
    const chips =
      BASE_LEVERS.hoursOptions.length +
      BASE_LEVERS.tradePolicyOptions.length +
      BASE_LEVERS.fniPostureOptions.length;
    expect(screen.getAllByRole('button')).toHaveLength(chips);
  });

  it('the bars are labelled by what they measure', () => {
    const screen = render(
      <FniPeakMeter
        postures={BARS}
        selectedId="more-per-deal"
        peakId="balanced"
        dealsRead={12}
      />,
    );

    // Each bar names its own axis in plain language and states its value, so a
    // layperson reads the trade-off without a legend: profit UP, contracts the
    // bank buys DOWN.
    expect(screen.getByTestId('fni-peak-reserve-label').props.children.join('')).toMatch(
      /Finance profit per contract — \$777/,
    );
    expect(screen.getByTestId('fni-peak-stick-label').props.children.join('')).toMatch(
      /Contracts the bank buys — 89%/,
    );
    expect(screen.getByTestId('fni-peak-total-label').props.children.join('')).toMatch(
      /Total gross per financed customer/,
    );

    // The crest is named, not pointed at — the optimum is not the maximum, so
    // an arrow would lie (grill Q4/Q9).
    expect(screen.getByTestId('fni-peak-callout').props.children).toMatch(
      /Balanced earns the most right now/,
    );

    // The second tooth is stated rather than smuggled into the money: the
    // aggressive posture also costs satisfaction, and the total does not price
    // that in (#368).
    expect(screen.getByTestId('fni-peak-satisfaction')).toBeTruthy();

    // No temperature words anywhere on the surface — the standing copy rule.
    const words = [
      screen.getByTestId('fni-peak-reserve-label'),
      screen.getByTestId('fni-peak-stick-label'),
      screen.getByTestId('fni-peak-total-label'),
      screen.getByTestId('fni-peak-callout'),
      screen.getByTestId('fni-peak-satisfaction'),
    ]
      .map((n) =>
        Array.isArray(n.props.children)
          ? n.props.children.join('')
          : String(n.props.children),
      )
      .join(' ');
    expect(words).not.toMatch(/\b(warm|hot|cool|cold|lukewarm)\b/i);
  });

  it('says it has nothing to read before the store finances anything', () => {
    // A blank meter is indistinguishable from a broken one, and a peak named
    // off an empty book would be a number the store never earned.
    const screen = render(
      <FniPeakMeter
        postures={BARS}
        selectedId="balanced"
        peakId={null}
        dealsRead={0}
      />,
    );
    expect(screen.getByTestId('fni-peak-empty')).toBeTruthy();
    expect(screen.queryByTestId('fni-peak-callout')).toBeNull();
    expect(screen.getByText(/haven't financed a car yet/i)).toBeTruthy();
  });
});
