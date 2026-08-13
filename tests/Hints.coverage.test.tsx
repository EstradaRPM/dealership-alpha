import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';
import { loadHints, controlOwns } from '../src/app/hints';
import { ServicePage } from '../src/ui/ServicePage';
import { BodyShopPage } from '../src/ui/BodyShopPage';
import { DepartmentScreen } from '../src/ui/DepartmentScreen';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.setTimeout(60_000);

/**
 * The completeness guard for the consequence-hint pass (#388).
 *
 * ONE rule, asserted by mounting rather than by a checklist: **every control a
 * player can press is declared in `data/hints.json` — either it teaches a
 * consequence, or it is named `viewOnly` because it only moves the view.** The
 * scan walks the rendered tree, takes every pressable, and resolves it to the
 * nearest declared control above it (itself first). A pressable that resolves to
 * nothing fails the suite by name.
 *
 * That is what stops the seventh control added next year from shipping silent:
 * whoever adds it must decide which of the two it is, in writing, in the data
 * file — a decision no scan can make for them.
 *
 * Resolution is by ANCESTRY on purpose. A hint sits under a control *group* —
 * a chip row, a par block, a modal's two buttons — and every press inside that
 * group belongs to the lesson drawn beneath it. Requiring one declaration per
 * pressable would put twelve entries where the surface teaches one thing once.
 */
const config = loadHints();
const declared = [
  ...config.hints.flatMap((h) => h.places.map((p) => p.control)),
  ...config.viewOnly,
];

/**
 * A node in the rendered tree, as react-test-renderer hands it back. Typed
 * structurally here so the suite needs no `@types/react-test-renderer`.
 */
interface TreeNode {
  type: unknown;
  props: Record<string, unknown>;
  parent: TreeNode | null;
  findAll: (
    predicate: (n: TreeNode) => boolean,
    options?: { deep?: boolean },
  ) => TreeNode[];
}

/**
 * Host-level pressables + text inputs: what a player can actually touch.
 *
 * Restricted to `View`/`TextInput` hosts deliberately. A scroll view also claims
 * the responder (`RCTScrollView`), and counting one would demand a hint for the
 * act of scrolling a list.
 */
function pressables(root: TreeNode): TreeNode[] {
  return root.findAll(
    (n: TreeNode) =>
      (n.type === 'View' && n.props.onStartShouldSetResponder != null) ||
      (n.type === 'TextInput' && n.props.onChangeText != null),
    { deep: true },
  );
}

/** The nearest declared control at or above this node, or null. */
function resolve(node: TreeNode): string | null {
  let cur: TreeNode | null = node;
  while (cur) {
    const id: unknown = cur.props?.testID;
    if (typeof id === 'string') {
      const owner = declared.find((c) => controlOwns(c, id));
      if (owner) return owner;
    }
    cur = cur.parent;
  }
  return null;
}

/**
 * Every undeclared pressable on this surface, named by the best handle it has.
 * The label is what the failure message hands the next author — a bare "3
 * controls are undeclared" tells them nothing about which ones.
 */
function undeclared(root: TreeNode, surface: string): string[] {
  return pressables(root)
    .filter((n) => resolve(n) === null)
    .map((n) => {
      const label: unknown =
        n.props.testID ?? n.props.accessibilityLabel ?? n.props.accessibilityRole;
      return `${surface}: ${typeof label === 'string' ? label : '<unlabelled>'}`;
    });
}

async function startCareer() {
  render(<DealershipApp driverFactory={createInMemoryDriverFactory()} />);
  await waitFor(() => screen.getByText('DEALERSHIP'));
  fireEvent.press(screen.getByText('New Game'));
  fireEvent.changeText(screen.getByPlaceholderText('Name this save'), 'Coverage');
  fireEvent.press(screen.getByText('Create & Continue'));
  await waitFor(() => screen.getByPlaceholderText('Your name'));
  fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray');
  fireEvent.press(screen.getByText('Ex-Mechanic'));
  fireEvent.press(screen.getByText('Begin'));
  await waitFor(() => screen.getByTestId('home-dashboard'));
}

describe('every control a player can press is classified', () => {
  it('the five tabs and the rooms they open declare all of theirs', async () => {
    await startCareer();
    const misses: string[] = [];

    // The five tabs. Addressed by their own testID now (#388) — the tab bar
    // used to be reachable only by accessibility label.
    for (const tab of ['home', 'operations', 'people', 'finance', 'growth']) {
      fireEvent.press(screen.getByTestId(`shell-tab-${tab}`));
      misses.push(...undeclared(screen.UNSAFE_root, tab));
    }

    // The rooms Operations opens. The Lot is reachable at Tier 1 with the #296
    // seed inventory already on it, so the stock rows, the price input and the
    // wholesale sheet all mount for real.
    fireEvent.press(screen.getByTestId('shell-tab-operations'));
    fireEvent.press(screen.getByTestId('dept-tile-lot'));
    await waitFor(() => screen.getByTestId('lot-room'));
    misses.push(...undeclared(screen.UNSAFE_root, 'lot'));

    const wholesale = screen.getAllByTestId(/^lot-wholesale-button-/)[0];
    expect(wholesale).toBeDefined();
    fireEvent.press(wholesale);
    await waitFor(() => screen.getByTestId('lot-wholesale-confirm'));
    misses.push(...undeclared(screen.UNSAFE_root, 'lot wholesale sheet'));
    fireEvent.press(screen.getByTestId('lot-wholesale-cancel'));

    fireEvent.press(screen.getAllByTestId(/^lot-open-pricing-/)[0]);
    await waitFor(() => screen.getByTestId('pricing-screen'));
    misses.push(...undeclared(screen.UNSAFE_root, 'pricing'));
    fireEvent.press(screen.getByTestId('pricing-close'));

    await waitFor(() => screen.getByTestId('lot-room'));
    fireEvent.press(screen.getByTestId('lot-auction-button'));
    await waitFor(() => screen.getByTestId('auction-lot-occupancy'));
    misses.push(...undeclared(screen.UNSAFE_root, 'auction'));
    fireEvent.press(screen.getAllByTestId(/^auction-listing-/)[0]);
    await waitFor(() => screen.getByTestId('auction-buy'));
    misses.push(...undeclared(screen.UNSAFE_root, 'auction listing'));
    fireEvent.press(screen.getByTestId('auction-detail-close'));

    expect(misses).toEqual([]);
  });

  // Service and the Body Shop are Tier 2 and Tier 3 doors, so they are mounted
  // directly rather than walked to — the same split `tests/BodyShopPage.smoke`
  // makes. The queue screen takes the same treatment because its route needs a
  // department with work waiting.
  it('the department rooms declare all of theirs', () => {
    const par = [
      {
        category: 'brakes',
        label: 'Brakes',
        reorderPoint: 2,
        target: 6,
        tier: 'standard',
        onHand: 4,
      },
    ];
    const tierOptions = [
      { id: 'standard', label: 'Standard' },
      { id: 'express', label: 'Express' },
    ];
    const noop = () => {};

    const service = render(
      <ServicePage
        model={{
          demandHeat: [],
          coverage: [],
          baseHealth: {
            size: 0,
            avgLoyalty: 0,
            avgCsi: 0,
            atRiskCount: 0,
            returnsPerDay: 0,
            returnTrend: 'steady',
            defectionsPerDay: 0,
            churnTrend: 'steady',
          },
        }}
        controls={{
          model: {
            par,
            tierOptions,
            pricingPosture: 0.5,
            retentionOptions: [{ id: 'none', label: 'None' }],
            retentionId: 'none',
            conquestOptions: [{ id: 'none', label: 'None' }],
            conquestCategory: 'none',
          },
          onSetReorderPoint: noop,
          onSetTarget: noop,
          onSetSupplierTier: noop,
          onSetPricingPosture: noop,
          onSetRetention: noop,
          onSetConquest: noop,
        }}
        onClose={noop}
      />,
    );
    const bodyShop = render(
      <BodyShopPage
        model={{
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
        }}
        controls={{
          model: { par, tierOptions, channelPosture: 0.5 },
          onSetReorderPoint: noop,
          onSetTarget: noop,
          onSetSupplierTier: noop,
          onSetChannelPosture: noop,
        }}
        onClose={noop}
      />,
    );
    const queue = render(
      <DepartmentScreen
        title="Sales"
        items={[{ id: 'q1', label: 'A lead is waiting', kind: 'lead' } as never]}
        onResolve={noop}
        onClose={noop}
      />,
    );

    expect([
      ...undeclared(service.UNSAFE_root, 'service'),
      ...undeclared(bodyShop.UNSAFE_root, 'bodyshop'),
      ...undeclared(queue.UNSAFE_root, 'department'),
    ]).toEqual([]);
  });

  it('the guard is actually finding controls (a scan that scans nothing passes everything)', async () => {
    await startCareer();
    expect(pressables(screen.UNSAFE_root).length).toBeGreaterThan(5);
  });
});

describe('a hint draws under its control and retires when it is used', () => {
  it('the day verb states its consequence, then stops once a day has run', async () => {
    await startCareer();
    const runDay = config.hints.find((h) => h.id === 'run_day')!;
    expect(screen.getByTestId('hint-run-day').props.children).toBe(runDay.text);

    fireEvent.press(screen.getByTestId('shell-primary-action'));
    await waitFor(() => expect(screen.queryByTestId('hint-run-day')).toBeNull());
  });

  it('a surface whose controls have all been used draws no hint furniture', async () => {
    await startCareer();
    fireEvent.press(screen.getByTestId('shell-tab-operations'));
    // Three lessons live on Operations: the hours, the trade policy and the F&I
    // posture. Each retires on its own control, and the region goes quiet only
    // when the last of them has been answered.
    expect(screen.getByTestId('hint-hours-of-operation')).toBeTruthy();
    expect(screen.getByTestId('hint-trade-policy')).toBeTruthy();
    expect(screen.getByTestId('hint-fni-posture')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('8 hrs (9–5)'));
    await waitFor(() =>
      expect(screen.queryByTestId('hint-hours-of-operation')).toBeNull(),
    );
    expect(screen.getByTestId('hint-trade-policy')).toBeTruthy();
  });
});
