import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  ServicePage,
  type ServicePageModel,
  type ServiceControls,
} from '../src/ui/ServicePage';

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

  it('omits controls when none are bound (read-only page)', () => {
    const { queryByTestId } = render(
      <ServicePage model={MODEL} onClose={() => {}} />,
    );
    expect(queryByTestId('service-parts-controls')).toBeNull();
    expect(queryByTestId('service-pricing-controls')).toBeNull();
    expect(queryByTestId('service-marketing-controls')).toBeNull();
  });
});

function makeControls(overrides: Partial<ServiceControls> = {}): ServiceControls {
  return {
    model: {
      par: [
        {
          category: 'oil_filters',
          label: 'Oil & Filters',
          reorderPoint: 3,
          target: 8,
          tier: 'standard',
          onHand: 5,
        },
        {
          category: 'tires_brakes',
          label: 'Tires & Brakes',
          reorderPoint: 2,
          target: 6,
          tier: 'economy',
          onHand: 1,
        },
      ],
      tierOptions: [
        { id: 'economy', label: 'Economy' },
        { id: 'standard', label: 'Standard' },
        { id: 'oem_direct', label: 'OEM Direct' },
        { id: 'rush', label: 'Rush' },
      ],
      pricingPosture: 0.5,
      retentionOptions: [
        { id: 'none', label: 'None' },
        { id: 'reminders', label: 'Service reminders', blurb: 'Nudge owners.' },
      ],
      retentionId: 'none',
      conquestOptions: [
        { id: 'none', label: 'None' },
        { id: 'tires_brakes', label: 'Tires & Brakes' },
      ],
      conquestCategory: 'none',
    },
    onSetReorderPoint: jest.fn(),
    onSetTarget: jest.fn(),
    onSetSupplierTier: jest.fn(),
    onSetPricingPosture: jest.fn(),
    onSetRetention: jest.fn(),
    onSetConquest: jest.fn(),
    ...overrides,
  };
}

describe('ServicePage controls (#309)', () => {
  it('renders the par / pricing / marketing control surfaces without crashing', () => {
    const { getByTestId } = render(
      <ServicePage model={MODEL} controls={makeControls()} onClose={() => {}} />,
    );
    expect(getByTestId('service-parts-controls')).toBeTruthy();
    expect(getByTestId('service-pricing-controls')).toBeTruthy();
    expect(getByTestId('service-marketing-controls')).toBeTruthy();
    expect(getByTestId('service-par-oil_filters')).toBeTruthy();
  });

  it('dispatches par-level + supplier-tier changes per category', () => {
    const controls = makeControls();
    const { getByLabelText } = render(
      <ServicePage model={MODEL} controls={controls} onClose={() => {}} />,
    );
    fireEvent.press(getByLabelText('Increase Oil & Filters reorder point'));
    expect(controls.onSetReorderPoint).toHaveBeenCalledWith('oil_filters', 4);
    fireEvent.press(getByLabelText('Decrease Oil & Filters target stock'));
    expect(controls.onSetTarget).toHaveBeenCalledWith('oil_filters', 7);
  });

  it('dispatches a pricing-posture change toward premium', () => {
    const controls = makeControls();
    const { getByLabelText } = render(
      <ServicePage model={MODEL} controls={controls} onClose={() => {}} />,
    );
    fireEvent.press(getByLabelText('More premium pricing'));
    const arg = (controls.onSetPricingPosture as jest.Mock).mock.calls[0][0];
    expect(arg).toBeGreaterThan(0.5);
  });

  it('dispatches retention + conquest marketing selections', () => {
    const controls = makeControls();
    const { getByLabelText } = render(
      <ServicePage model={MODEL} controls={controls} onClose={() => {}} />,
    );
    fireEvent.press(getByLabelText('Service reminders'));
    expect(controls.onSetRetention).toHaveBeenCalledWith('reminders');
    // Conquest target chip shares the "Tires & Brakes" label; press the one in
    // the marketing surface.
    fireEvent.press(getByLabelText('Tires & Brakes'));
    expect(controls.onSetConquest).toHaveBeenCalledWith('tires_brakes');
  });
});
