import React from 'react';
import { render } from '@testing-library/react-native';
import { HomeView } from '../src/ui/HomeView';
import type { TimeOfDay, Weather } from '../src/ui/HomeView';
import type { CharacterProfile } from '../src/game/CareerProgression';
import { ActivityMarquee } from '../src/ui/HomeView/ActivityMarquee';
import type { MarqueeEvent } from '../src/ui/HomeView/ActivityMarquee';

const freshCareer: CharacterProfile = {
  name: 'Test Player',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.1,
    startingCreditLine: 20000,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

describe('HomeView', () => {
  it('renders without crashing given a fresh-career state fixture', () => {
    const { getByText } = render(<HomeView profile={freshCareer} />);
    expect(getByText('Test Player\'s Lot')).toBeTruthy();
    expect(getByText('Tier 1 — Gravel Yard')).toBeTruthy();
  });

  it('renders all five departments with badge=0', () => {
    const { getByText } = render(<HomeView profile={freshCareer} />);
    expect(getByText('Sales')).toBeTruthy();
    expect(getByText('Service')).toBeTruthy();
    expect(getByText('BDC')).toBeTruthy();
    expect(getByText('Office')).toBeTruthy();
    expect(getByText('Lot')).toBeTruthy();
  });
});

const TIME_OF_DAY_VALUES: TimeOfDay[] = ['morning', 'midday', 'dusk', 'night'];
const WEATHER_VALUES: Weather[] = ['clear', 'rain', 'snow'];

describe('HomeView tint combinations', () => {
  for (const timeOfDay of TIME_OF_DAY_VALUES) {
    for (const weather of WEATHER_VALUES) {
      it(`renders without crashing: ${timeOfDay} / ${weather}`, () => {
        expect(() =>
          render(<HomeView profile={freshCareer} timeOfDay={timeOfDay} weather={weather} />)
        ).not.toThrow();
      });
    }
  }
});

describe('HomeView pulse dots', () => {
  it('renders without crashing when badges are zero (no dots)', () => {
    const badges = { sales: 0, service: 0, bdc: 0, office: 0, lot: 0 };
    expect(() =>
      render(<HomeView profile={freshCareer} badges={badges} />)
    ).not.toThrow();
  });

  it('renders without crashing when all departments have activity', () => {
    const badges = { sales: 3, service: 1, bdc: 2, office: 1, lot: 4 };
    expect(() =>
      render(<HomeView profile={freshCareer} badges={badges} />)
    ).not.toThrow();
  });
});

const fixtureEvents: MarqueeEvent[] = [
  { id: '1', text: 'Deal closed — $3,200 gross' },
  { id: '2', text: 'Customer walked' },
  { id: '3', text: 'Sunset Auto poached a customer' },
];

describe('ActivityMarquee', () => {
  it('renders without crashing with a fixture event stream', () => {
    expect(() =>
      render(<ActivityMarquee initialEvents={fixtureEvents} />)
    ).not.toThrow();
  });

  it('renders event text', () => {
    const { getByText } = render(<ActivityMarquee initialEvents={fixtureEvents} />);
    expect(getByText(/Deal closed/)).toBeTruthy();
    expect(getByText(/Customer walked/)).toBeTruthy();
    expect(getByText(/Sunset Auto poached/)).toBeTruthy();
  });

  it('renders nothing when event list is empty', () => {
    const { toJSON } = render(<ActivityMarquee initialEvents={[]} />);
    expect(toJSON()).toBeNull();
  });
});
