import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LotRoom, type LotRoomProps } from '../src/ui/LotRoom';

// #362 (A2 R2) — the release valve on the inventory card. Wholesaling is the
// one action that realizes a loss ON PURPOSE, so the card must state the price
// of the decision before it commits: what the buyer pays, what the unit has
// cost, and the hit. A valve you can't see the price of isn't a decision.

const AGED: LotRoomProps['vehicles'][number] = {
  id: 'v2',
  year: 2016,
  make: 'Ford',
  model: 'F-150',
  trim: 'XLT',
  suggestedRetail: 21_000,
  askingPrice: 21_500,
  daysInInventory: 74,
  carryingCostToDate: 1_480,
  dailyCarryingCost: 20,
  aged: true,
  wholesale: {
    vehicleId: 'v2',
    bookValue: 18_000,
    proceeds: 15_300,
    costBasis: 18_400,
    gain: -3_100,
  },
};

const BASE: LotRoomProps = {
  vehicles: [AGED],
  occupancy: { occupied: 1, built: 6, spacesOpen: 5, atCapacity: false },
  onSetAskingPrice: jest.fn(),
  onOpenPricing: jest.fn(),
  pricingStrategyOptions: [
    { id: 'market', label: 'Market', blurb: 'List at market.' },
  ],
  pricingStrategyId: 'market',
  onSelectPricingStrategy: jest.fn(),
  autoPricingActive: false,
  onOpenAuction: jest.fn(),
  onWholesale: jest.fn(),
  onClose: jest.fn(),
};

const textOf = (el: { props: { children: unknown } }) => String(el.props.children);

describe('#362 Lot room — the wholesale release valve', () => {
  it('the wholesale confirmation states proceeds and the loss taken', () => {
    const { getByTestId, queryByTestId } = render(<LotRoom {...BASE} />);

    // One tap does not dump a car. The confirmation is the surface that has to
    // carry the numbers, and it isn't there until asked for.
    expect(queryByTestId('lot-wholesale-confirm')).toBeNull();
    fireEvent.press(getByTestId('lot-wholesale-button-v2'));

    expect(getByTestId('lot-wholesale-confirm')).toBeTruthy();
    expect(textOf(getByTestId('lot-wholesale-proceeds'))).toBe('$15,300');
    // Named as a loss, not a signed number — "-$3,100" makes the player do the
    // reading. The whole point of the confirmation is that it does it for them.
    expect(textOf(getByTestId('lot-wholesale-result'))).toBe('$3,100 loss');
  });

  it('states the offer on the unit itself, before the confirmation opens', () => {
    const { getByText } = render(<LotRoom {...BASE} />);
    expect(getByText('Wholesale $15,300')).toBeTruthy();
  });

  it('commits only on confirm, and names the unit it commits', () => {
    const onWholesale = jest.fn();
    const { getByTestId } = render(
      <LotRoom {...BASE} onWholesale={onWholesale} />,
    );

    fireEvent.press(getByTestId('lot-wholesale-button-v2'));
    fireEvent.press(getByTestId('lot-wholesale-commit'));
    expect(onWholesale).toHaveBeenCalledWith('v2');
  });

  it('keeping the unit closes the confirmation and moves nothing', () => {
    const onWholesale = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <LotRoom {...BASE} onWholesale={onWholesale} />,
    );

    fireEvent.press(getByTestId('lot-wholesale-button-v2'));
    fireEvent.press(getByTestId('lot-wholesale-cancel'));
    expect(queryByTestId('lot-wholesale-confirm')).toBeNull();
    expect(onWholesale).not.toHaveBeenCalled();
  });

  it('says "gain" when the unit is worth more than you have in it', () => {
    const { getByTestId } = render(
      <LotRoom
        {...BASE}
        vehicles={[
          {
            ...AGED,
            wholesale: { ...AGED.wholesale, proceeds: 19_000, gain: 600 },
          },
        ]}
      />,
    );

    fireEvent.press(getByTestId('lot-wholesale-button-v2'));
    expect(textOf(getByTestId('lot-wholesale-result'))).toBe('$600 gain');
  });
});
