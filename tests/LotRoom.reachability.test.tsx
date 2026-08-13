import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LotRoom, type LotRoomProps } from '../src/ui/LotRoom';
import { readAppCompositionSource } from './helpers/appComposition';
import { emptyState } from '../src/ui/copy';

// #346 — the locked IA §4 gives the Lot the whole stock pipeline as ONE room:
// stock list · pricing · sourcing (the auction lives here). Before this slice
// the Lot dock button opened the generic empty-queue screen while cars sat on
// the lot one tab away, and the pipeline was scattered across Operations Prep.

const BASE: LotRoomProps = {
  vehicles: [
    {
      id: 'v1',
      year: 2019,
      make: 'Toyota',
      model: 'Camry',
      trim: 'LE',
      suggestedRetail: 15000,
      askingPrice: 15400,
      daysInInventory: 12,
      carryingCostToDate: 240,
      dailyCarryingCost: 20,
      aged: false,
      wholesale: {
        vehicleId: 'v1',
        bookValue: 12_000,
        proceeds: 10_200,
        costBasis: 11_400,
        gain: -1_200,
      },
    },
    {
      id: 'v2',
      year: 2016,
      make: 'Ford',
      model: 'F-150',
      trim: 'XLT',
      suggestedRetail: 21000,
      askingPrice: 21500,
      daysInInventory: 74,
      carryingCostToDate: 1480,
      dailyCarryingCost: 20,
      aged: true,
      wholesale: {
        vehicleId: 'v2',
        bookValue: 18_000,
        proceeds: 15_300,
        costBasis: 18_400,
        gain: -3_100,
      },
    },
  ],
  // #361: the room states the engine's occupancy, never a count of the list —
  // a unit in prep occupies a space and the list is not where that rule lives.
  occupancy: { occupied: 2, built: 12, spacesOpen: 10, atCapacity: false },
  onSetAskingPrice: jest.fn(),
  onOpenPricing: jest.fn(),
  pricingStrategyOptions: [
    { id: 'aggressive', label: 'Aggressive', blurb: 'List above market.' },
    { id: 'market', label: 'Market', blurb: 'List at market.' },
    { id: 'value', label: 'Value', blurb: 'List below market.' },
  ],
  pricingStrategyId: 'market',
  onSelectPricingStrategy: jest.fn(),
  autoPricingActive: false,
  onOpenAuction: jest.fn(),
  onWholesale: jest.fn(),
  onClose: jest.fn(),
};

describe('#346 Lot room — one room, the whole stock pipeline', () => {
  it('renders the stock list, the per-unit pricing entry, and the auction entry together', () => {
    const { getByTestId, getByLabelText } = render(<LotRoom {...BASE} />);

    expect(getByTestId('lot-stock-list')).toBeTruthy();
    expect(getByTestId('lot-stock-row-v1')).toBeTruthy();
    expect(getByTestId('lot-stock-row-v2')).toBeTruthy();
    // Per-unit pricing: the row itself is the entry, and the asking price is
    // editable inline.
    expect(getByLabelText('Open pricing for 2019 Toyota Camry')).toBeTruthy();
    expect(getByLabelText('Asking price for v1')).toBeTruthy();
    // Sourcing.
    expect(getByTestId('lot-sourcing')).toBeTruthy();
    expect(getByTestId('lot-auction-button')).toBeTruthy();
  });

  it('opens the auction from the Lot room', () => {
    const onOpenAuction = jest.fn();
    const { getByTestId } = render(
      <LotRoom {...BASE} onOpenAuction={onOpenAuction} />,
    );

    fireEvent.press(getByTestId('lot-auction-button'));
    expect(onOpenAuction).toHaveBeenCalledTimes(1);
  });

  it('opens the per-unit pricing screen for the tapped unit', () => {
    const onOpenPricing = jest.fn();
    const { getByLabelText } = render(
      <LotRoom {...BASE} onOpenPricing={onOpenPricing} />,
    );

    fireEvent.press(getByLabelText('Open pricing for 2016 Ford F-150'));
    expect(onOpenPricing).toHaveBeenCalledWith('v2');
  });

  it('commits an edited asking price', () => {
    const onSetAskingPrice = jest.fn();
    const { getByLabelText } = render(
      <LotRoom {...BASE} onSetAskingPrice={onSetAskingPrice} />,
    );

    const input = getByLabelText('Asking price for v1');
    fireEvent.changeText(input, '14250');
    fireEvent(input, 'blur');
    expect(onSetAskingPrice).toHaveBeenCalledWith('v1', 14250);
  });

  it('carries the pricing strategy — it moved out of Prep with the price rows', () => {
    const onSelectPricingStrategy = jest.fn();
    const { getByTestId, getByText } = render(
      <LotRoom {...BASE} onSelectPricingStrategy={onSelectPricingStrategy} />,
    );

    expect(getByTestId('lot-pricing-strategy')).toBeTruthy();
    expect(getByText('List at market.')).toBeTruthy();
    fireEvent.press(getByText('Aggressive'));
    expect(onSelectPricingStrategy).toHaveBeenCalledWith('aggressive');
    expect(getByTestId('auto-pricing-status').props.children).toMatch(
      /Suggestion only/,
    );
  });

  it('says what an empty lot means instead of showing an empty queue', () => {
    const { getByText, getByTestId } = render(
      <LotRoom {...BASE} vehicles={[]} />,
    );

    expect(getByText(/Buy something at the auction/)).toBeTruthy();
    // Sourcing is still right there — the answer to an empty lot.
    expect(getByTestId('lot-auction-button')).toBeTruthy();
  });
});

// #361 (A2 R2): lot size has been CSV tier truth since the beginning and
// nothing enforced it. The room is where the player reads the squeeze.
describe('#361 Lot room — occupied of built spaces', () => {
  const lineOf = (el: { props: { children: unknown } }) =>
    String(el.props.children);

  it('states occupied of built spaces', () => {
    const { getByTestId } = render(<LotRoom {...BASE} />);
    expect(lineOf(getByTestId('lot-occupancy'))).toBe(
      '2 of 12 spaces taken · 10 open',
    );
  });

  it('says no spaces are open at the cap, and says it again where buying starts', () => {
    const { getByTestId, getByText } = render(
      <LotRoom
        {...BASE}
        occupancy={{ occupied: 12, built: 12, spacesOpen: 0, atCapacity: true }}
      />,
    );
    expect(lineOf(getByTestId('lot-occupancy'))).toBe(
      '12 of 12 spaces taken · no spaces open',
    );
    expect(getByText(emptyState('lot_no_spaces'))).toBeTruthy();
  });

  it('says the lot is over, not merely full — a trade always lands', () => {
    const { getByTestId } = render(
      <LotRoom
        {...BASE}
        occupancy={{ occupied: 13, built: 12, spacesOpen: 0, atCapacity: true }}
      />,
    );
    expect(lineOf(getByTestId('lot-occupancy'))).toBe(
      '13 of 12 spaces taken · over by 1 — buying is frozen until you sell one',
    );
  });
});

describe('#346 Lot room — mounted in the live app', () => {
  it('is a real route the Lot dock tile opens, not the generic queue screen', () => {
    const src = readAppCompositionSource();

    expect(src).toContain("if (dept === 'lot') return tabs.navigate('lot')");
    expect(src).toContain('<LotRoomContainer');
  });

  it('assembles the room off live world state and owns the writes', () => {
    const src = readAppCompositionSource();

    expect(src).toContain('world.inventory.setAskingPrice(vehicleId, price)');
    expect(src).toMatch(/onOpenAuction=\{\(\) => tabs\.navigate\('auction'\)\}/);
    expect(src).toMatch(/onOpenPricing=\{\(vehicleId\) =>\s*tabs\.navigate\('pricing', \{ vehicleId \}\)\}/);
  });

  // #361: both surfaces state the ENGINE's occupancy. If either ever counted
  // its own list instead, a unit in prep would silently stop taking a space.
  it('takes lot occupancy from the engine on the room and the auction alike', () => {
    const src = readAppCompositionSource();

    expect(src).toContain('occupancy={world.inventory.getLotOccupancy()}');
    expect(src).toContain('lotOccupancy={world.inventory.getLotOccupancy()}');
  });

  // #362: the valve is only a valve if it is on the live card. Both halves are
  // asserted — the quote the room states and the write the confirm fires —
  // because a surface that shows a wholesale price but cannot take it is
  // exactly the "built but never surfaced" failure this file exists to catch.
  it('quotes the wholesale off the engine and wholesales the confirmed unit', () => {
    const src = readAppCompositionSource();

    expect(src).toContain('world.inventory.getWholesaleQuote(v.id)');
    expect(src).toContain('world.inventory.wholesaleVehicle(vehicleId)');
  });
});

describe('#346 hiring left Prep — and #347 landed it on People for good', () => {
  it('Prep builds no hiring or auction link at all', () => {
    const src = readAppCompositionSource();

    // The two navigation links the locked IA bans in Prep.
    expect(src).not.toContain("onOpenAuction: () => tabs.navigate('auction')");
    expect(src).not.toContain('rosterCount: world.staffOrg.currentRoster.length');
    // #347: the stop-gap People→personnel push is gone too — hiring resolves
    // inside the People tab, so no surface anywhere pushes that route.
    expect(src).not.toContain("navigate('personnel')");
  });
});
