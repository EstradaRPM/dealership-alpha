import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';
import { readAppCompositionSource } from './helpers/appComposition';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Drives the whole app, including a floor day to close; the default 5s is tight
// under CI contention.
jest.setTimeout(30_000);

/**
 * #348 — locked IA §3: sub-screens render INSIDE the shell. Before this slice
 * every pushed screen (department queues, the auction, pricing, Service, the
 * Body Shop) unmounted the 5-tab shell and rendered full-screen with a lone
 * "‹ Back" — opening a room replaced the entire app chrome.
 *
 * The carve-outs the IA keeps are asserted here too: the live floor is still a
 * full-screen MODE, and the day recap / trade / discount spotlights are still
 * modals layered over the shell rather than routes.
 */

type Screen = ReturnType<typeof render>;

async function startNewCareer(screen: Screen) {
  await waitFor(() => expect(screen.getByText('DEALERSHIP')).toBeTruthy());
  fireEvent.press(screen.getByText('New Game'));
  fireEvent.changeText(
    screen.getByPlaceholderText('Name this save'),
    'Nav Save',
  );
  fireEvent.press(screen.getByText('Create & Continue'));

  await waitFor(() => expect(screen.getByText('Who are you?')).toBeTruthy());
  fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray Estrada');
  fireEvent.press(screen.getByText('Ex-Mechanic'));
  fireEvent.press(screen.getByText('Begin'));

  await waitFor(() => expect(screen.getByTestId('home-dashboard')).toBeTruthy());
}

describe('#348 in-tab navigation — the shell survives walking into a room', () => {
  it('keeps the tab bar up in a sub-screen, and each tab holds its own position', async () => {
    const screen = render(
      <DealershipApp driverFactory={createInMemoryDriverFactory()} />,
    );
    await startNewCareer(screen);

    // Operations → the Lot room.
    fireEvent.press(screen.getByLabelText('Operations'));
    await waitFor(() =>
      expect(screen.getByTestId('department-dock')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('dept-tile-lot'));
    await waitFor(() => expect(screen.getByTestId('lot-room')).toBeTruthy());

    // THE fix: the room renders with the whole 5-tab bar still mounted, and
    // every tab is still a live control from inside it.
    expect(screen.getByTestId('app-shell-tabbar')).toBeTruthy();
    expect(screen.getByTestId('app-shell-stack')).toBeTruthy();
    for (const tab of ['Home', 'Operations', 'People', 'Finance', 'Growth']) {
      expect(screen.getByLabelText(tab)).toBeTruthy();
    }

    // Switching tabs from inside the room leaves the room behind — People shows
    // its own root page, not Operations' stack.
    fireEvent.press(screen.getByLabelText('People'));
    await waitFor(() =>
      expect(screen.getByTestId('people-region-roster')).toBeTruthy(),
    );
    expect(screen.queryByTestId('lot-room')).toBeNull();

    // ...and coming back restores Operations exactly where it was left: still
    // in the Lot room, not reset to the dock.
    fireEvent.press(screen.getByLabelText('Operations'));
    await waitFor(() => expect(screen.getByTestId('lot-room')).toBeTruthy());
    expect(screen.queryByTestId('people-region-roster')).toBeNull();

    // Back pops the room and lands on the tab's own page, tab bar unbroken.
    fireEvent.press(screen.getByLabelText('Back'));
    await waitFor(() =>
      expect(screen.getByTestId('department-dock')).toBeTruthy(),
    );
    expect(screen.queryByTestId('lot-room')).toBeNull();
    expect(screen.getByTestId('app-shell-tabbar')).toBeTruthy();
  });

  it('all five tabs render their room', async () => {
    // #378 — the anti-orphan half of the sweep. Every tab in the fixed IA opens
    // a surface that was really built; none of them lands on a "coming in a
    // later slice" card. Each assertion names a testID only that room renders.
    const screen = render(
      <DealershipApp driverFactory={createInMemoryDriverFactory()} />,
    );
    await startNewCareer(screen);

    const rooms: ReadonlyArray<[string, string]> = [
      ['Home', 'home-dashboard'],
      ['Operations', 'department-dock'],
      ['People', 'people-region-roster'],
      ['Finance', 'finance-tab'],
      ['Growth', 'growth-tab'],
    ];
    for (const [tab, testID] of rooms) {
      fireEvent.press(screen.getByLabelText(tab));
      await waitFor(() => expect(screen.getByTestId(testID)).toBeTruthy());
      expect(screen.queryByText(/coming in a later slice/i)).toBeNull();
    }
  });

  it('renders the live floor as a full-screen mode with no tab bar', async () => {
    const screen = render(
      <DealershipApp driverFactory={createInMemoryDriverFactory()} />,
    );
    await startNewCareer(screen);

    // The shell is up before the day opens.
    expect(screen.getByTestId('app-shell-tabbar')).toBeTruthy();

    fireEvent.press(screen.getByText('Open Floor'));
    await waitFor(() => expect(screen.getByText('FLOOR')).toBeTruthy());

    // The watch-it-resolve beat suspends the console deliberately (IA §3
    // carve-out): no tab bar, no shell.
    expect(screen.queryByTestId('app-shell-tabbar')).toBeNull();
    expect(screen.queryByTestId('app-shell-stack')).toBeNull();

    // ...and the console comes back at day close.
    fireEvent.press(screen.getByLabelText('Skip to close'));
    await waitFor(() => expect(screen.getByText('Drove by')).toBeTruthy());
    expect(screen.getByTestId('app-shell-tabbar')).toBeTruthy();
  });

  it('keeps the day recap and both spotlights as modals over the shell', async () => {
    let services: Parameters<
      NonNullable<React.ComponentProps<typeof DealershipApp>['onServicesReady']>
    >[0] | null = null;
    const screen = render(
      <DealershipApp
        driverFactory={createInMemoryDriverFactory()}
        onServicesReady={(s) => {
          services = s;
        }}
      />,
    );
    await startNewCareer(screen);
    await waitFor(() => expect(services).not.toBeNull());

    // 1. Day recap, popped by an actual day close — a modal over the console,
    //    with the shell it interrupts still mounted behind it.
    fireEvent.press(screen.getByText('Open Floor'));
    await waitFor(() => expect(screen.getByText('FLOOR')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Skip to close'));
    await waitFor(() => expect(screen.getByText('Drove by')).toBeTruthy());
    expect(screen.getByTestId('app-shell-tabbar')).toBeTruthy();
    fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByText('Drove by')).toBeNull());

    // 2. Trade spotlight (hand-play): the overlay channel sits above the
    //    Navigator, so it layers over whatever is up — here, the shell.
    act(() => {
      services!.bus.publish('trade:escalated', {
        customerId: 'cust:trade-review',
        day: 1,
        vehicle: {
          id: 'veh:trade-deal',
          make: 'Toyota',
          model: 'Camry',
          year: 2018,
          mileage: 62_000,
          category: 'sedan',
        },
        currentVehicle: {
          templateId: 'cv:civic',
          brand: 'vanda',
          make: 'Honda',
          model: 'Civic',
          year: 2016,
          mileage: 80_000,
          condition: 'average',
          category: 'sedan',
          loanPayoff: 9_000,
        },
        book: 6_000,
        allowanceAsk: 12_000,
        payoff: 9_000,
        target: 5_100,
        recommendedCounter: 5_500,
        staffConfidence: 0,
      });
    });
    expect(screen.getByText(/MANAGER ATTENTION/)).toBeTruthy();
    expect(screen.getByTestId('app-shell-tabbar')).toBeTruthy();

    // 3. Discount spotlight, same channel, same shell behind it.
    act(() => {
      services!.bus.publish('discount:escalated', {
        customerId: 'cust:discount-review',
        day: 1,
        vehicle: {
          id: 'v1',
          make: 'Toyota',
          model: 'Camry',
          year: 2019,
          mileage: 48_000,
          category: 'sedan',
        },
        marketPrice: 19_000,
        askingPrice: 20_000,
        customerTargetPrice: 17_500,
        salespersonCounter: 18_500,
        minimumAcceptablePrice: 17_000,
        frontGrossAtAsk: 4_000,
        canAcceptAsk: false,
        counterAttempts: 0,
        priorMisses: 0,
        salespersonCounterAcceptProb: 0.4,
        priceSensitivity: 0.5,
        missPenalty: 0.1,
      });
    });
    expect(screen.getByText('cust:discount-review')).toBeTruthy();
    expect(screen.getByTestId('app-shell-tabbar')).toBeTruthy();

    // None of the three is a route: the shell never went anywhere.
    expect(screen.queryByTestId('app-shell-stack')).toBeNull();
  });
});

describe('#348 wiring — the shell-unmounting pattern is gone, not just unused', () => {
  it('pushes every sub-screen onto a tab stack, never onto the root navigator', () => {
    const src = readAppCompositionSource();

    expect(src).toContain("if (dept === 'lot') return tabs.navigate('lot')");
    expect(src).toContain("tabs.navigate('service')");
    expect(src).toContain("tabs.navigate('bodyShop')");
    expect(src).toMatch(/onOpenAuction=\{\(\) => tabs\.navigate\('auction'\)\}/);
    expect(src).toMatch(
      /onOpenPricing=\{\(vehicleId\) =>\s*tabs\.navigate\('pricing', \{ vehicleId \}\)\}/,
    );
    // The root navigator keeps the flow states and the global overlays only.
    expect(src).not.toContain("nav.navigate('lot')");
    expect(src).not.toContain("nav.navigate('auction')");
    expect(src).not.toContain("nav.navigate('department'");
  });

  it('hands the active tab AND its stack position to one owner', () => {
    const src = readAppCompositionSource();

    expect(src).toMatch(/useTabStacks<ShellTabKey>\('home'\)/);
    expect(src).toMatch(/activeTabKey=\{tabs\.activeTab\}/);
    // #213 named the handler so a tab press into Growth also finishes the
    // spine's read-the-market step. The guard is what it was for: the shell
    // reports the tap and `tabs` still owns which tab is active.
    expect(src).toMatch(/onTabChange=\{changeTab\}/);
    expect(src).toMatch(
      /const changeTab = \(key: ShellTabKey\) => \{[\s\S]*?tabs\.setActiveTab\(key\);/,
    );
    expect(src).toMatch(/stackScreen=\{stackScreen\}/);
    // The lifted-state workaround the old pattern needed is retired.
    expect(src).not.toMatch(/useState<ShellTabKey>/);
  });
});
