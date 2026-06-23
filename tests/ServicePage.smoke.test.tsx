import React from 'react';
import { render } from '@testing-library/react-native';
import { ServicePage, type ServicePageModel } from '../src/ui/ServicePage';

const MODEL: ServicePageModel = {
  demandHeat: [
    { category: 'oil_filters', label: 'Oil & Filters', band: 'hot', trend: 'rising' },
    { category: 'tires_brakes', label: 'Tires & Brakes', band: 'warm', trend: 'steady' },
    { category: 'drivetrain', label: 'Drivetrain', band: 'cold', trend: 'falling' },
    { category: 'electronics', label: 'Electronics', band: 'cold', trend: 'steady' },
  ],
  coverage: [
    { category: 'oil_filters', label: 'Oil & Filters', demand: 6, onHand: 2, onOrder: 1, gap: 3 },
    { category: 'tires_brakes', label: 'Tires & Brakes', demand: 2, onHand: 4, onOrder: 0, gap: -2 },
    { category: 'drivetrain', label: 'Drivetrain', demand: 0, onHand: 1, onOrder: 0, gap: -1 },
    { category: 'electronics', label: 'Electronics', demand: 1, onHand: 0, onOrder: 0, gap: 1 },
  ],
  baseHealth: {
    size: 12,
    avgLoyalty: 0.74,
    avgCsi: 0.68,
    atRiskCount: 2,
    returnsPerDay: 1.5,
    returnTrend: 'rising',
    defectionsPerDay: 0.2,
    churnTrend: 'falling',
  },
};

describe('ServicePage smoke', () => {
  it('renders the three readouts without crashing', () => {
    const { getByTestId, getByText } = render(
      <ServicePage model={MODEL} onClose={() => {}} />,
    );
    expect(getByTestId('service-page')).toBeTruthy();
    expect(getByTestId('service-demand-heat')).toBeTruthy();
    expect(getByTestId('service-stock-coverage')).toBeTruthy();
    expect(getByTestId('service-base-health')).toBeTruthy();
    // Section headers present.
    expect(getByText('Demand by Job')).toBeTruthy();
    expect(getByText('Parts Coverage')).toBeTruthy();
    expect(getByText('Customer Base')).toBeTruthy();
  });

  it('labels demand by its axis (plain-language), never a bare temperature word', () => {
    const { getByText, getAllByText, queryByText, getByLabelText } = render(
      <ServicePage model={MODEL} onClose={() => {}} />,
    );
    expect(getByText('High demand')).toBeTruthy();
    expect(getByText('Steady demand')).toBeTruthy();
    // Two categories read cold ⇒ two "Low demand" badges.
    expect(getAllByText('Low demand').length).toBe(2);
    // The internal band words are never surfaced as a label.
    expect(queryByText('Hot')).toBeNull();
    expect(queryByText('Warm')).toBeNull();
    expect(queryByText('Cold')).toBeNull();
    expect(getByLabelText('Oil & Filters demand trend rising')).toBeTruthy();
  });

  it('flags a parts shortage vs covered stock', () => {
    const { getByLabelText } = render(<ServicePage model={MODEL} onClose={() => {}} />);
    expect(getByLabelText('Oil & Filters short 3')).toBeTruthy();
    expect(getByLabelText('Tires & Brakes covered')).toBeTruthy();
  });

  it('shows base-health figures', () => {
    const { getByText } = render(<ServicePage model={MODEL} onClose={() => {}} />);
    expect(getByText('Owners in base')).toBeTruthy();
    expect(getByText('74%')).toBeTruthy(); // avg loyalty
    expect(getByText('At-risk owners')).toBeTruthy();
  });
});
