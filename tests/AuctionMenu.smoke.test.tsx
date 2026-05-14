import React from 'react';
import { render } from '@testing-library/react-native';
import { AuctionMenu } from '../src/ui/AuctionMenu';
import type { AuctionListing, LotVehicle } from '../src/game/Inventory';

const mockListing: AuctionListing = {
  id: 'auction-day1-0-honda_civic',
  templateId: 'honda_civic',
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
};

const mockLotVehicle: LotVehicle = {
  id: 'auction-day1-0-toyota_camry',
  templateId: 'toyota_camry',
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
  daysInInventory: 3,
};

describe('AuctionMenu — smoke', () => {
  it('renders without crashing with listings and lot vehicles', () => {
    expect(() =>
      render(
        <AuctionMenu
          listings={[mockListing]}
          lotVehicles={[mockLotVehicle]}
          cash={50000}
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
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('2020 Honda Civic')).toBeTruthy();
    expect(getByText('$12,000')).toBeTruthy();
  });

  it('shows lot vehicle with DII and recon cost', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[]}
        lotVehicles={[mockLotVehicle]}
        cash={50000}
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
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('Cash: $27,500')).toBeTruthy();
  });
});
