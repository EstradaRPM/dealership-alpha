import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PricingScreen,
  type PricingScreenProps,
} from '../src/ui/PricingScreen';
import type { IntelPrecision } from '../src/game/MarketEconomy';

// Sharp = a UCM on staff (tight bands, full confidence); coarse = price by gut
// (wide bands, capped confidence). Mirrors data/intel-precision.json (#284).
const SHARP: IntelPrecision = {
  level: 'sharp',
  heatGranularity: 'fine',
  suggestionBandPct: 0.04,
  daysRangePct: 0.15,
  confidenceScale: 1,
};
const COARSE: IntelPrecision = {
  level: 'coarse',
  heatGranularity: 'coarse',
  suggestionBandPct: 0.12,
  daysRangePct: 0.5,
  confidenceScale: 0.6,
};

const BASE: PricingScreenProps = {
  vehicle: {
    id: 'v1',
    year: 2019,
    make: 'Toyota',
    model: 'Camry',
    trim: 'LE',
    bookValue: 18000,
    marketPrice: 22000,
    vehicleCost: 17000,
    initialAskingPrice: 22000,
    daysInInventory: 12,
    carryingCostToDate: 240,
    dailyCarryingCost: 20,
    aged: false,
    agedThresholdDays: 45,
  },
  comps: [
    { id: 'a', name: 'Budget Bros', pricePoint: 'budget', price: 20500 },
    { id: 'b', name: 'Fair Deal', pricePoint: 'standard', price: 22000 },
  ],
  suggestion: {
    price: 22000,
    source: 'ucm',
    pricingSkill: 72,
    strategyLabel: 'Market',
  },
  precision: SHARP,
  predictDays: () => ({ expectedDays: 30, confidence: 0.6 }),
  classifyPosition: () => 'at-market',
  enabled: true,
  onCommit: jest.fn(),
  onClose: jest.fn(),
};

describe('PricingScreen smoke tests', () => {
  it('renders all panels without crashing', () => {
    const { getByText, getByTestId } = render(<PricingScreen {...BASE} />);
    expect(getByTestId('pricing-screen')).toBeTruthy();
    expect(getByText('At market')).toBeTruthy();
    expect(getByText('Predicted days to sell')).toBeTruthy();
    expect(getByText('Used-Car Manager')).toBeTruthy();
    expect(getByText(/Budget Bros/)).toBeTruthy();
  });

  it('applying the staff suggestion commits the suggested price', () => {
    const onCommit = jest.fn();
    const { getByText } = render(
      <PricingScreen {...BASE} onCommit={onCommit} />,
    );
    fireEvent.press(getByText('Apply'));
    expect(onCommit).toHaveBeenCalledWith(22000);
  });

  it('the stepper commits a stepped-down price', () => {
    const onCommit = jest.fn();
    const { getByLabelText } = render(
      <PricingScreen {...BASE} onCommit={onCommit} />,
    );
    fireEvent.press(getByLabelText('Lower asking price'));
    expect(onCommit).toHaveBeenCalledWith(21950);
  });

  it('renders the aging warning for an aged unit', () => {
    const aged = {
      ...BASE,
      vehicle: { ...BASE.vehicle, aged: true, daysInInventory: 60 },
    };
    const { getByText } = render(<PricingScreen {...aged} />);
    expect(getByText(/Aged — 60d on lot/)).toBeTruthy();
  });

  it('shows the heuristic rationale when no UCM is on staff', () => {
    const noUcm = {
      ...BASE,
      suggestion: { ...BASE.suggestion, source: 'heuristic' as const, pricingSkill: undefined },
    };
    const { getByText } = render(<PricingScreen {...noUcm} />);
    expect(getByText(/Hire a Used-Car Manager/)).toBeTruthy();
  });

  it('coarse intel (no UCM) widens the days range and caps confidence; sharp tightens both (#284)', () => {
    const coarse = render(<PricingScreen {...BASE} precision={COARSE} />);
    // expectedDays 30 ± 50% ⇒ a broad 15–45 spread; confidence 0.6 × 0.6 cap.
    expect(coarse.getByText('15 – 45')).toBeTruthy();
    expect(coarse.getByText('36% confidence')).toBeTruthy();

    const sharp = render(<PricingScreen {...BASE} precision={SHARP} />);
    // ± 15% ⇒ a tight 26–35; full confidence (× 1.0).
    expect(sharp.getByText('26 – 35')).toBeTruthy();
    expect(sharp.getByText('60% confidence')).toBeTruthy();
  });

  it('the suggested-price band widens under coarse intel and tightens under sharp (#284)', () => {
    // $22,000 ± 12% (coarse) ⇒ a wide band; rounded to the $50 step.
    const coarse = render(<PricingScreen {...BASE} precision={COARSE} />);
    expect(coarse.getByText('$19,350 – $24,650')).toBeTruthy();
    // ± 4% (sharp) ⇒ a tight band the player can actually act on.
    const sharp = render(<PricingScreen {...BASE} precision={SHARP} />);
    expect(sharp.getByText('$21,100 – $22,900')).toBeTruthy();
  });

  it('is read-only when disabled (apply does nothing)', () => {
    const onCommit = jest.fn();
    const { getByText } = render(
      <PricingScreen {...BASE} enabled={false} onCommit={onCommit} />,
    );
    fireEvent.press(getByText('Apply'));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
