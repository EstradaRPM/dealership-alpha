import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  RecoveryBeatCard,
  RecoveryBanner,
  buildRecoveryBeat,
  type RecoveryBannerModel,
} from '../src/ui/NarrativeBeat';

describe('RecoveryBeatCard (#326)', () => {
  it('renders the beat cause / cost / path and a non-terminal "Setback" framing', () => {
    const beat = buildRecoveryBeat({
      kind: 'bankruptcy_contraction',
      fromTier: 2,
      debtPrincipal: 50000,
    });
    const { getByText } = render(
      <RecoveryBeatCard visible beat={beat} onConfirm={() => {}} />,
    );
    // Framed as a survivable setback, not GAME OVER.
    expect(getByText('Setback')).toBeTruthy();
    expect(getByText(beat.cause)).toBeTruthy();
    expect(getByText(beat.cost)).toBeTruthy();
    expect(getByText(beat.path)).toBeTruthy();
  });

  it('drains on confirm ("Keep going")', () => {
    const onConfirm = jest.fn();
    const beat = buildRecoveryBeat({ kind: 'ag_complaint_consent_decree', tier: 3 });
    const { getByText } = render(
      <RecoveryBeatCard visible beat={beat} onConfirm={onConfirm} />,
    );
    fireEvent.press(getByText('Keep going'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('RecoveryBanner (#326)', () => {
  it('renders nothing when no recovery state is active', () => {
    const { queryByTestId } = render(<RecoveryBanner banners={[]} />);
    expect(queryByTestId('recovery-banner')).toBeNull();
  });

  it('renders the active recovery rows', () => {
    const banners: RecoveryBannerModel[] = [
      { kind: 'debt-overhang', headline: 'Recovering from insolvency', detail: '$48,000 debt overhang — paying down weekly.' },
      { kind: 'license-suspension', headline: 'License suspended', detail: '9 days remaining — sales resume when it lifts.' },
    ];
    const { getByTestId, getByText } = render(<RecoveryBanner banners={banners} />);
    expect(getByTestId('recovery-banner')).toBeTruthy();
    expect(getByText('Recovering from insolvency')).toBeTruthy();
    expect(getByText('License suspended')).toBeTruthy();
  });
});
