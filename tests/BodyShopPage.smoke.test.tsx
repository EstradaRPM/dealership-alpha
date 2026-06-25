import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  BodyShopPage,
  type BodyShopPageModel,
} from '../src/ui/BodyShopPage';

const MODEL: BodyShopPageModel = {
  demandHeat: [
    { category: 'windows_glass', label: 'Windows & Glass', band: 'hot', trend: 'rising' },
    { category: 'doors_panels', label: 'Doors & Panels', band: 'warm', trend: 'steady' },
    { category: 'interior_trim', label: 'Interior Trim', band: 'cold', trend: 'falling' },
    { category: 'paint', label: 'Paint & Body', band: 'cold', trend: 'steady' },
  ],
  coverage: [
    { category: 'windows_glass', label: 'Windows & Glass', demand: 5, onHand: 1, onOrder: 1, gap: 3 },
    { category: 'doors_panels', label: 'Doors & Panels', demand: 2, onHand: 4, onOrder: 0, gap: -2 },
    { category: 'interior_trim', label: 'Interior Trim', demand: 0, onHand: 1, onOrder: 0, gap: -1 },
    { category: 'paint', label: 'Paint & Body', demand: 1, onHand: 0, onOrder: 0, gap: 1 },
  ],
  conquest: {
    windowTickets: 18,
    intakePerDay: 2.4,
    intakeTrend: 'rising',
    retailShare: 0.61,
    insuranceShare: 0.39,
    retailTrend: 'rising',
  },
};

describe('BodyShopPage smoke', () => {
  it('renders the three readouts without crashing', () => {
    const { getByTestId, getByText } = render(
      <BodyShopPage model={MODEL} onClose={() => {}} />,
    );
    expect(getByTestId('body-shop-page')).toBeTruthy();
    expect(getByTestId('body-shop-demand-heat')).toBeTruthy();
    expect(getByTestId('body-shop-stock-coverage')).toBeTruthy();
    expect(getByTestId('body-shop-conquest-health')).toBeTruthy();
    expect(getByText('Demand by Job')).toBeTruthy();
    expect(getByText('Parts Coverage')).toBeTruthy();
    expect(getByText('Conquest Health')).toBeTruthy();
  });

  it('labels demand by its axis (plain-language), never a bare temperature word', () => {
    const { getByText, getAllByText, queryByText, getByLabelText } = render(
      <BodyShopPage model={MODEL} onClose={() => {}} />,
    );
    expect(getByText('High demand')).toBeTruthy();
    expect(getByText('Steady demand')).toBeTruthy();
    // Two categories read cold ⇒ two "Low demand" badges.
    expect(getAllByText('Low demand').length).toBe(2);
    // The internal band words are never surfaced as a label.
    expect(queryByText('Hot')).toBeNull();
    expect(queryByText('Warm')).toBeNull();
    expect(queryByText('Cold')).toBeNull();
    expect(getByLabelText('Windows & Glass demand trend rising')).toBeTruthy();
  });

  it('flags a parts shortage vs covered stock', () => {
    const { getByLabelText } = render(
      <BodyShopPage model={MODEL} onClose={() => {}} />,
    );
    expect(getByLabelText('Windows & Glass short 3')).toBeTruthy();
    expect(getByLabelText('Doors & Panels covered')).toBeTruthy();
  });

  it('shows conquest-health figures (volume + channel mix)', () => {
    const { getByText } = render(
      <BodyShopPage model={MODEL} onClose={() => {}} />,
    );
    expect(getByText('Jobs in / day')).toBeTruthy();
    expect(getByText('Retail (customer-pay)')).toBeTruthy();
    expect(getByText('61%')).toBeTruthy(); // retail share
    expect(getByText('Insurance (DRP)')).toBeTruthy();
  });

  it('renders empty states with no traffic', () => {
    const empty: BodyShopPageModel = {
      demandHeat: [],
      coverage: [],
      conquest: {
        windowTickets: 0,
        intakePerDay: 0,
        intakeTrend: 'steady',
        retailShare: 0,
        insuranceShare: 0,
        retailTrend: 'steady',
      },
    };
    const { getByText } = render(
      <BodyShopPage model={empty} onClose={() => {}} />,
    );
    expect(getByText('No collision work yet.')).toBeTruthy();
  });

  it('dispatches onClose from the back button', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <BodyShopPage model={MODEL} onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('Back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
