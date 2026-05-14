import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChapterCard } from '../src/ui/NarrativeBeat';

describe('ChapterCard', () => {
  it('renders without crashing when visible', () => {
    const { getByText } = render(
      <ChapterCard
        visible={true}
        toTier={2}
        defaultBusinessName="Estrada Motors"
        onConfirm={jest.fn()}
      />
    );
    expect(getByText('Tier 2 — Paved Lot')).toBeTruthy();
    expect(getByText('Open for Business')).toBeTruthy();
  });

  it('calls onConfirm with trimmed name and selected accent', () => {
    const onConfirm = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <ChapterCard
        visible={true}
        toTier={2}
        defaultBusinessName="Estrada Motors"
        onConfirm={onConfirm}
      />
    );
    fireEvent.changeText(getByDisplayValue('Estrada Motors'), '  Revived Rides  ');
    fireEvent.press(getByText('Open for Business'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Revived Rides' })
    );
  });

  it('shows an error and does not confirm when name is blank', () => {
    const onConfirm = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <ChapterCard
        visible={true}
        toTier={2}
        defaultBusinessName="Estrada Motors"
        onConfirm={onConfirm}
      />
    );
    fireEvent.changeText(getByDisplayValue('Estrada Motors'), '   ');
    fireEvent.press(getByText('Open for Business'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(getByText('Give your business a name.')).toBeTruthy();
  });
});
