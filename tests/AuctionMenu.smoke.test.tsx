import React from 'react';
import { render } from '@testing-library/react-native';
import { AuctionMenu } from '../src/ui/AuctionMenu';
import type { AuctionListing, LotVehicle } from '../src/game/Inventory';

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

  it('shows retail range estimate and source label on each row', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[mockListing]}
        lotVehicles={[]}
        cash={50000}
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
