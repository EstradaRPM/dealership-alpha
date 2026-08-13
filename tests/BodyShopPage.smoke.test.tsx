import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  BodyShopPage,
  type BodyShopPageModel,
  type BodyShopControls,
} from '../src/ui/BodyShopPage';
import { emptyState } from '../src/ui/copy';

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
    expect(getByText(emptyState('body_shop_demand_heat'))).toBeTruthy();
  });

  it('dispatches onClose from the back button', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <BodyShopPage model={MODEL} onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('Back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits controls when none are bound (read-only page)', () => {
    const { queryByTestId } = render(
      <BodyShopPage model={MODEL} onClose={() => {}} />,
    );
    expect(queryByTestId('body-shop-parts-controls')).toBeNull();
    expect(queryByTestId('body-shop-channel-controls')).toBeNull();
  });
});

function makeControls(
  overrides: Partial<BodyShopControls> = {},
): BodyShopControls {
  return {
    model: {
      par: [
        {
          category: 'windows_glass',
          label: 'Windows & Glass',
          reorderPoint: 2,
          target: 6,
          tier: 'standard',
          onHand: 3,
        },
        {
          category: 'paint',
          label: 'Paint & Body',
          reorderPoint: 1,
          target: 4,
          tier: 'economy',
          onHand: 0,
        },
      ],
      tierOptions: [
        { id: 'economy', label: 'Economy' },
        { id: 'standard', label: 'Standard' },
        { id: 'oem_direct', label: 'OEM Direct' },
        { id: 'rush', label: 'Rush' },
      ],
      channelPosture: 0.5,
    },
    onSetReorderPoint: jest.fn(),
    onSetTarget: jest.fn(),
    onSetSupplierTier: jest.fn(),
    onSetChannelPosture: jest.fn(),
    ...overrides,
  };
}

describe('BodyShopPage controls (#318)', () => {
  it('renders the parts + channel control surfaces without crashing', () => {
    const { getByTestId } = render(
      <BodyShopPage model={MODEL} controls={makeControls()} onClose={() => {}} />,
    );
    expect(getByTestId('body-shop-parts-controls')).toBeTruthy();
    expect(getByTestId('body-shop-channel-controls')).toBeTruthy();
    expect(getByTestId('body-shop-par-windows_glass')).toBeTruthy();
    expect(getByTestId('body-shop-channel-posture')).toBeTruthy();
  });

  it('dispatches par-level + supplier-tier changes per collision category', () => {
    const controls = makeControls();
    const { getByLabelText } = render(
      <BodyShopPage model={MODEL} controls={controls} onClose={() => {}} />,
    );
    fireEvent.press(getByLabelText('Increase Windows & Glass reorder point'));
    expect(controls.onSetReorderPoint).toHaveBeenCalledWith('windows_glass', 3);
    fireEvent.press(getByLabelText('Decrease Windows & Glass target stock'));
    expect(controls.onSetTarget).toHaveBeenCalledWith('windows_glass', 5);
  });

  it('dispatches a channel-mix change toward retail', () => {
    const controls = makeControls();
    const { getByLabelText } = render(
      <BodyShopPage model={MODEL} controls={controls} onClose={() => {}} />,
    );
    fireEvent.press(getByLabelText('More retail work'));
    const arg = (controls.onSetChannelPosture as jest.Mock).mock.calls[0][0];
    expect(arg).toBeGreaterThan(0.5);
  });

  it('names the channel axis (Insurance ↔ Retail), never a bare temperature word', () => {
    const { getByText, getByLabelText, queryByText } = render(
      <BodyShopPage model={MODEL} controls={makeControls()} onClose={() => {}} />,
    );
    // The dial names its endpoints; the value word is plain-language.
    expect(getByText('Insurance ◄ 50% ► Retail')).toBeTruthy();
    expect(getByLabelText('Channel mix Balanced 50 percent toward retail')).toBeTruthy();
    // Never a bare temperature word on the channel control.
    expect(queryByText('Hot')).toBeNull();
    expect(queryByText('Warm')).toBeNull();
    expect(queryByText('Cold')).toBeNull();
  });
});
