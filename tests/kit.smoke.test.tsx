import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  Surface,
  Card,
  Button,
  Badge,
  Pill,
  ProgressBar,
  Meter,
  GaugeArc,
  StatCard,
  SectionHeader,
} from '../src/ui/kit';
import { ThemeProvider, defaultTheme, type Theme } from '../src/ui/theme';
import { DayRecap, type DayRecapModel } from '../src/ui/DayRecap';

// Every kit component is presentation-only and must render against the theme,
// both inside a provider and standalone (context default = defaultTheme).
describe('#225 base-component kit — smoke', () => {
  it('renders every kit component without crashing (no provider → default theme)', () => {
    expect(() =>
      render(
        <Surface>
          <SectionHeader title="Section" accessory={<Badge label="NEW" tone="info" />} />
          <Card variant="inset">
            <StatCard label="Units" value={3} delta="+2" trend="up" />
            <ProgressBar value={0.6} />
            <Meter label="Morale" value={0.72} readout="72%" tone="positive" />
            <Pill label="AGING" tone="danger" />
            <Button label="Start Day" onPress={() => {}} />
            <Button label="Cancel" variant="ghost" disabled />
          </Card>
        </Surface>,
      ),
    ).not.toThrow();
  });

  it.each(['raised', 'inset', 'flat'] as const)('Surface variant=%s renders', (variant) => {
    expect(() => render(<Surface variant={variant} />)).not.toThrow();
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('Button variant=%s renders', (variant) => {
    expect(() => render(<Button label="Go" variant={variant} />)).not.toThrow();
  });

  it.each(['neutral', 'info', 'positive', 'reward', 'danger'] as const)(
    'Badge tone=%s renders',
    (tone) => {
      expect(() => render(<Badge label="TAG" tone={tone} />)).not.toThrow();
    },
  );

  it('clamps ProgressBar values outside [0,1]', () => {
    expect(() => render(<ProgressBar value={-5} />)).not.toThrow();
    expect(() => render(<ProgressBar value={5} />)).not.toThrow();
  });

  it('renders GaugeArc with a provider', () => {
    expect(() =>
      render(
        <ThemeProvider theme={defaultTheme}>
          <GaugeArc value={0.87} tone="reward" readout="87" readoutSuffix="/ 100" caption="Very Good" />
        </ThemeProvider>,
      ),
    ).not.toThrow();
  });

  it('renders GaugeArc with no provider (default theme) and degrades at 0 and 100', () => {
    expect(() => render(<GaugeArc value={0} tone="reward" readout="0" caption="Poor" />)).not.toThrow();
    expect(() => render(<GaugeArc value={1} tone="reward" readout="100" caption="Excellent" />)).not.toThrow();
  });

  it.each(['primary', 'positive', 'reward', 'danger'] as const)(
    'GaugeArc tone=%s renders',
    (tone) => {
      expect(() => render(<GaugeArc value={0.5} tone={tone} />)).not.toThrow();
    },
  );
});

// The re-skinnability requirement: swapping the theme object at the root must
// re-skin the proven surface with zero component edits.
describe('#225 theme is injectable — swap re-skins with no component edits', () => {
  const MODEL: DayRecapModel = {
    day: 4,
    potentialTraffic: 18,
    walkedIn: 12,
    staffEngaged: 8,
    sold: 3,
    gross: 7_650,
    leakCause: 'closing',
    strongMatches: 2,
    matchedSales: 3,
  };

  const MAGENTA = '#ff00ff';
  const altTheme: Theme = {
    ...defaultTheme,
    colors: { ...defaultTheme.colors, reward: MAGENTA },
  };

  function tallyColor(theme: Theme): unknown {
    const { getByText } = render(
      <ThemeProvider theme={theme}>
        <DayRecap model={MODEL} />
      </ThemeProvider>,
    );
    const node = getByText(/sales were strong matches/);
    return StyleSheet.flatten(node.props.style).color;
  }

  it('the same DayRecap renders the default reward color under the default theme', () => {
    expect(tallyColor(defaultTheme)).toBe(defaultTheme.colors.reward);
  });

  it('swapping the theme object alone re-skins that exact node', () => {
    expect(tallyColor(altTheme)).toBe(MAGENTA);
  });
});

// Anti-orphan: the kit is no use if its theme isn't actually live in the app.
// The proven surfaces (DayRecap, the AppShell tabs) must render under a root
// ThemeProvider in App.tsx, not just in isolated tests.
describe('#225 the theme is mounted in the live App.tsx flow', () => {
  it('App.tsx imports ThemeProvider and wraps the render tree in it', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
    expect(src).toMatch(/import \{ ThemeProvider \} from '\.\/src\/ui\/theme'/);
    expect(src).toMatch(/<ThemeProvider>/);
    expect(src).toMatch(/<\/ThemeProvider>/);
  });
});
