import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AuctionMenu } from '../src/ui/AuctionMenu';
import type {
  AuctionListing,
  LotOccupancy,
  LotVehicle,
} from '../src/game/Inventory';

// #361: the lane spends spaces as well as cash. Room to buy is the default for
// every pre-existing case; the cap gets its own describe below.
const OPEN_LOT: LotOccupancy = {
  occupied: 4,
  built: 12,
  spacesOpen: 8,
  atCapacity: false,
};
const FULL_LOT: LotOccupancy = {
  occupied: 12,
  built: 12,
  spacesOpen: 0,
  atCapacity: true,
};

const mockListing: AuctionListing = {
  id: 'auction-day1-0-vanda_sedan',
  templateId: 'vanda_sedan',
  brand: 'vanda',
  year: 2020,
  make: 'Honda',
  model: 'Civic',
  trim: 'LX',
  mileage: 45000,
  condition: 'average',
  conditionReport: 'Normal wear for mileage. Minor cosmetic blemishes. Ready to recon.',
  askingPrice: 12000,
  reconCost: 1200,
  category: 'sedan',
  sourceId: 'manheim_digital',
  inspectionStatus: 'none',
};

const mockLotVehicle: LotVehicle = {
  id: 'auction-day1-0-toraya_sedan',
  templateId: 'toraya_sedan',
  brand: 'toraya',
  year: 2019,
  make: 'Toyota',
  model: 'Camry',
  trim: 'LE',
  mileage: 60000,
  condition: 'clean',
  conditionReport: 'No major defects.',
  purchasePrice: 14500,
  reconCost: 500,
  category: 'sedan',
  arrivalDay: 1,
  frontlineDay: 1,
  daysInInventory: 3,
  carryingCostToDate: 60,
  dailyCarryingCost: 20,
  aged: false,
  suggestedRetail: 15000,
  askingPrice: 15000,
  reconStatus: 'complete',
  reconEstimate: 500,
  reconRealizedCost: 500,
  reconDaysRemaining: 0,
  reconDaysTotal: 3,
  reconBucket: 'within',
};

describe('AuctionMenu — smoke', () => {
  it('renders without crashing with listings and lot vehicles', () => {
    expect(() =>
      render(
        <AuctionMenu
          listings={[mockListing]}
          lotVehicles={[mockLotVehicle]}
          cash={50000}
          lotOccupancy={OPEN_LOT}
          onBuy={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('shows listing make, model, and asking price', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[mockListing]}
        lotVehicles={[]}
        cash={50000}
        lotOccupancy={OPEN_LOT}
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('2020 Honda Civic')).toBeTruthy();
    expect(getByText('$12,000')).toBeTruthy();
  });

  it('shows retail range estimate and source label on each row', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[mockListing]}
        lotVehicles={[]}
        cash={50000}
        lotOccupancy={OPEN_LOT}
        valuationFor={() => ({ bookValue: 11000, marketPrice: 13500 })}
        sourceLabelFor={(id) => (id === 'manheim_digital' ? 'Manheim Digital' : id)}
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('$11,000–$13,500')).toBeTruthy();
    expect(getByText('Manheim Digital')).toBeTruthy();
  });

  it('shows lot vehicle with DII and recon cost', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[]}
        lotVehicles={[mockLotVehicle]}
        cash={50000}
        lotOccupancy={OPEN_LOT}
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('2019 Toyota Camry')).toBeTruthy();
    expect(getByText('3d on lot')).toBeTruthy();
    expect(getByText('Recon: $500')).toBeTruthy();
  });

  it('shows empty state when no listings', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[]}
        lotVehicles={[]}
        cash={50000}
        lotOccupancy={OPEN_LOT}
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('No vehicles available today.')).toBeTruthy();
  });

  it('shows cash balance in header', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[]}
        lotVehicles={[]}
        cash={27500}
        lotOccupancy={OPEN_LOT}
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('Cash: $27,500')).toBeTruthy();
  });
});

// #361 (A2 R2): the lot cap governs BUYING. Lot size has been CSV tier truth
// since the beginning and nothing enforced it, so "match your inventory to
// demand" had no squeeze in it. At the cap the lane still reads — you can study
// what you cannot buy — but bidding is closed, because the engine would refuse
// the buy and a button that throws is not an offer.
describe('#361 AuctionMenu — the lot cap', () => {
  it('states occupied of built spaces', () => {
    const { getByTestId } = render(
      <AuctionMenu
        listings={[mockListing]}
        lotVehicles={[]}
        cash={50000}
        lotOccupancy={OPEN_LOT}
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByTestId('auction-lot-occupancy').props.children.join('')).toBe(
      'Lot: 4 of 12 spaces',
    );
  });

  it('closes bidding and says no spaces are open at the cap', () => {
    const onBuy = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <AuctionMenu
        listings={[mockListing]}
        lotVehicles={[]}
        cash={50000}
        lotOccupancy={FULL_LOT}
        onBuy={onBuy}
        onClose={jest.fn()}
      />,
    );

    expect(getByTestId('auction-bidding-closed')).toBeTruthy();

    // The board still reads, and the unit still opens — what is closed is the
    // bid itself.
    fireEvent.press(getByText('2020 Honda Civic'));
    const buy = getByText('No Spaces Open');
    fireEvent.press(buy);
    expect(onBuy).not.toHaveBeenCalled();

    // Not a cash refusal — the player has the money and it must not say so.
    expect(queryByTestId('Insufficient Funds')).toBeNull();
  });

  it('reopens bidding once a space is open', () => {
    const onBuy = jest.fn();
    const { getByText, queryByTestId } = render(
      <AuctionMenu
        listings={[mockListing]}
        lotVehicles={[]}
        cash={50000}
        lotOccupancy={{ occupied: 11, built: 12, spacesOpen: 1, atCapacity: false }}
        onBuy={onBuy}
        onClose={jest.fn()}
      />,
    );
    expect(queryByTestId('auction-bidding-closed')).toBeNull();
    fireEvent.press(getByText('2020 Honda Civic'));
    fireEvent.press(getByText('Buy for $12,000'));
    expect(onBuy).toHaveBeenCalledWith(mockListing.id);
  });
});
