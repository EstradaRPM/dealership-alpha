import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { DealershipApp } from '../App';
import {
  createInMemoryDriverFactory,
  createMultiSlotSaveStore,
} from '../src/game/SaveStore';
import { loadSpine, nextAdviceId, SPINE_STEP_IDS } from '../src/app/spine';
import { readAppCompositionSource } from './helpers/appComposition';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.setTimeout(60_000);

/**
 * The first-run spine (#213): five numbered coachmarks that teach one day of
 * this game — read the market, find the coverage gap, stock to match it, run
 * the day, read the recap.
 *
 * Driven through the LIVE composed app on a fresh save rather than against a
 * component in isolation, because the thing being asserted is that a new player
 * actually meets it. That is the anti-orphan rule this repo has paid for before.
 */
const config = loadSpine();
const testIdFor = (id: string) => `coachmark-${id.replace(/_/g, '-')}`;
/** Any coachmark at all, wherever it is drawn. */
const ANY_STEP_LINE = /^Step \d+ of \d+$/;

async function startCareer(name = 'Spine') {
  render(<DealershipApp driverFactory={createInMemoryDriverFactory()} />);
  await waitFor(() => screen.getByText('DEALERSHIP'));
  fireEvent.press(screen.getByText('New Game'));
  fireEvent.changeText(screen.getByPlaceholderText('Name this save'), name);
  fireEvent.press(screen.getByText('Create & Continue'));
  await waitFor(() => screen.getByPlaceholderText('Your name'));
  fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ray');
  fireEvent.press(screen.getByText('Ex-Mechanic'));
  fireEvent.press(screen.getByText('Begin'));
  await waitFor(() => screen.getByTestId('home-dashboard'));
}

/** Acknowledge the coachmark currently drawn for `stepId`. */
async function acknowledge(stepId: string) {
  fireEvent.press(screen.getByTestId(`${testIdFor(stepId)}-done`));
  await waitFor(() => expect(screen.queryByTestId(testIdFor(stepId))).toBeNull());
}

/** Home → the Growth demand console, where the coverage-gap step draws. */
async function openConsole() {
  fireEvent.press(screen.getByTestId('shell-tab-growth'));
  await waitFor(() => screen.getByTestId('demand-readout'));
}

/** Operations → the Lot room, where the stocking step draws. */
async function openLot() {
  fireEvent.press(screen.getByTestId('shell-tab-operations'));
  fireEvent.press(screen.getByTestId('dept-tile-lot'));
  await waitFor(() => screen.getByTestId('lot-room'));
}

/**
 * Play one whole day: open the floor, exhaust it with the skip control (the
 * same `runDay()` the live clock walks to), and land on the recap the spine's
 * last step draws inside.
 */
async function playADay() {
  fireEvent.press(screen.getByTestId('shell-tab-home'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('shell-primary-action'));
  });
  await waitFor(() => screen.getByLabelText('Skip to close'));
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Skip to close'));
  });
  await waitFor(() => screen.getByTestId('day-recap-modal'));
}

describe('the catalog', () => {
  it('declares every step, in order, with a distinct anchor', () => {
    expect(config.steps.map((s) => s.id)).toEqual([...SPINE_STEP_IDS]);
    expect(new Set(config.steps.map((s) => s.anchor)).size).toBe(
      config.steps.length,
    );
  });

  it('the advice ladder answers something for every reading', () => {
    expect(nextAdviceId({ cashLow: true, coverageGap: true, lotHasRoom: true })).toBe(
      'cash_low',
    );
    expect(
      nextAdviceId({ cashLow: false, coverageGap: true, lotHasRoom: true }),
    ).toBe('coverage_gap');
    expect(
      nextAdviceId({ cashLow: false, coverageGap: false, lotHasRoom: true }),
    ).toBe('lot_has_room');
    // The floor of the ladder — this is what stops the menu entry going dead.
    expect(
      nextAdviceId({ cashLow: false, coverageGap: false, lotHasRoom: false }),
    ).toBe('run_the_day');
  });
});

describe('the first-run spine walks the player through one day', () => {
  it('a fresh career opens on the demand coachmark', async () => {
    await startCareer();
    const first = config.steps[0];
    expect(screen.getByTestId(testIdFor(first.id))).toBeTruthy();
    expect(screen.getByText(first.title)).toBeTruthy();
    expect(screen.getByText(`Step 1 of ${config.steps.length}`)).toBeTruthy();
    // ...and only that one. The spine draws one coachmark at a time.
    for (const later of config.steps.slice(1)) {
      expect(screen.queryByTestId(testIdFor(later.id))).toBeNull();
    }
  });

  it('opening the demand console advances the flow off Home', async () => {
    await startCareer();
    // The market glance is the app action that already routes to the console —
    // no tutorial-only control was added to finish this step.
    fireEvent.press(screen.getByTestId('home-market-glance'));
    await waitFor(() => screen.getByTestId('demand-readout'));
    expect(screen.queryByTestId(testIdFor('spine_read_demand'))).toBeNull();
    expect(screen.getByTestId(testIdFor('spine_cover_the_gap'))).toBeTruthy();
  });

  // Three doors reach the console — the glance, the gate strip and the tab bar
  // — and the step is "go and read the market", not "use this particular
  // control". A door that did not count would leave a player staring at an
  // instruction they had already followed.
  it('the tab bar is a door to the console like any other', async () => {
    await startCareer();
    await openConsole();
    expect(screen.queryByTestId(testIdFor('spine_read_demand'))).toBeNull();
    expect(screen.getByTestId(testIdFor('spine_cover_the_gap'))).toBeTruthy();
  });

  it('stocking to match advances the flow', async () => {
    await startCareer();
    fireEvent.press(screen.getByTestId('home-market-glance'));
    await waitFor(() => screen.getByTestId('demand-readout'));
    await acknowledge('spine_cover_the_gap');

    await openLot();
    expect(screen.getByTestId(testIdFor('spine_stock_to_match'))).toBeTruthy();

    // Buying at the auction PERFORMS the step — no acknowledgment, because the
    // step names `auction_buy` as the control that performs it and that hint's
    // retirement is the same one fact in the same cell.
    fireEvent.press(screen.getByTestId('lot-auction-button'));
    await waitFor(() => screen.getAllByTestId(/^auction-listing-/));
    fireEvent.press(screen.getAllByTestId(/^auction-listing-/)[0]);
    await waitFor(() => screen.getByTestId('auction-buy'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('auction-buy'));
    });

    fireEvent.press(screen.getByTestId('shell-tab-home'));
    await waitFor(() => screen.getByTestId('home-dashboard'));
    expect(screen.queryByTestId(testIdFor('spine_stock_to_match'))).toBeNull();
    expect(screen.getByTestId(testIdFor('spine_run_the_day'))).toBeTruthy();
  });

  it('a taught career sees no coachmarks', async () => {
    await startCareer();
    await acknowledge('spine_read_demand');
    await openConsole();
    await acknowledge('spine_cover_the_gap');
    await openLot();
    await acknowledge('spine_stock_to_match');
    fireEvent.press(screen.getByTestId('lot-back'));

    await playADay();
    // Running the day retired its own step; the recap is where the last one is.
    expect(screen.queryByTestId(testIdFor('spine_run_the_day'))).toBeNull();
    expect(screen.getByTestId(testIdFor('spine_read_the_reveal'))).toBeTruthy();
    fireEvent.press(screen.getByText('Done'));

    await waitFor(() => screen.getByTestId('home-dashboard'));
    expect(screen.queryByText(ANY_STEP_LINE)).toBeNull();
    await openConsole();
    expect(screen.queryByText(ANY_STEP_LINE)).toBeNull();
    await openLot();
    expect(screen.queryByText(ANY_STEP_LINE)).toBeNull();
  });

  it('an unmounted anchor is skipped, not floated', async () => {
    await startCareer();
    // Advance to the stocking step, whose anchor is the Lot room's sourcing
    // block, then stand somewhere the Lot is not mounted.
    await acknowledge('spine_read_demand');
    await openConsole();
    await acknowledge('spine_cover_the_gap');

    fireEvent.press(screen.getByTestId('shell-tab-people'));
    expect(screen.queryByTestId('lot-sourcing')).toBeNull();
    // Nothing anywhere on screen: not the owed step, not a stray overlay.
    expect(screen.queryByTestId(testIdFor('spine_stock_to_match'))).toBeNull();
    expect(screen.queryByText(ANY_STEP_LINE)).toBeNull();
    // ...and it was skipped, not consumed: walk to the anchor and it is there.
    await openLot();
    expect(screen.getByTestId(testIdFor('spine_stock_to_match'))).toBeTruthy();
  });

  it('the menu entry answers before and after the spine', async () => {
    await startCareer();
    fireEvent.press(screen.getByTestId('shell-menu'));
    await waitFor(() => screen.getByTestId('menu-advice'));
    fireEvent.press(screen.getByTestId('menu-advice'));
    // Mid-spine, the answer is the step the player has not done yet.
    expect(screen.getByTestId('menu-advice-answer').props.children).toBe(
      config.steps[0].text,
    );
    fireEvent.press(screen.getByText('Resume'));
    await waitFor(() => screen.getByTestId('home-dashboard'));

    await acknowledge('spine_read_demand');
    await openConsole();
    await acknowledge('spine_cover_the_gap');
    await openLot();
    await acknowledge('spine_stock_to_match');
    fireEvent.press(screen.getByTestId('lot-back'));
    await playADay();
    await acknowledge('spine_read_the_reveal');
    fireEvent.press(screen.getByText('Done'));
    await waitFor(() => screen.getByTestId('home-dashboard'));

    fireEvent.press(screen.getByTestId('shell-menu'));
    await waitFor(() => screen.getByTestId('menu-advice'));
    fireEvent.press(screen.getByTestId('menu-advice'));
    // Spine finished ⇒ the answer is now a rung of the live ladder, never blank.
    const answer = screen.getByTestId('menu-advice-answer').props
      .children as string;
    expect(config.advice.map((a) => a.text)).toContain(answer);
  });

  it('a new career is taught again', async () => {
    // Two slots off one storage layer: the teaching cell is per-slot, so a
    // second career meets the spine from its first step even though the first
    // career finished it. `deleteSlot` wipes the cell outright (#386).
    const factory = createInMemoryDriverFactory();
    const slots = createMultiSlotSaveStore(factory);
    const a = await slots.createSlot('First');
    await slots.selectSlot(a.id);
    const teaching = await slots.teachingStore();
    for (const id of SPINE_STEP_IDS) await teaching!.markTaught(id);
    expect((await teaching!.listTaught()).length).toBe(SPINE_STEP_IDS.length);

    const b = await slots.createSlot('Second');
    await slots.selectSlot(b.id);
    expect(await (await slots.teachingStore())!.listTaught()).toEqual([]);

    await slots.deleteSlot(a.id);
    const recreated = await slots.createSlot('First again');
    await slots.selectSlot(recreated.id);
    expect(await (await slots.teachingStore())!.listTaught()).toEqual([]);
  });
});

describe('the spine introduces no tutorial-only state', () => {
  it('every coachmark is resolved through the teaching cell, not a flow machine', () => {
    const src = readAppCompositionSource();
    // The one store the spine reads and writes.
    expect(src).toContain('useSpine');
    expect(src).toContain('hints.markTaught');
    // No parallel progress store, no persisted step cursor. `useSpine` derives
    // the current step from the shared cell every render; a `useState` cursor
    // here would be exactly the second copy of the fact this slice avoids.
    const spineSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'useSpine.ts'),
      'utf8',
    );
    expect(spineSrc).not.toMatch(/useState|useRef|useReducer/);
  });

  it('the spine copy is data, never a literal under src/', () => {
    const root = path.join(__dirname, '..', 'src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
          files.push(full);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(100);
    const fragments = [
      ...config.steps.flatMap((s) => [s.title, s.text]),
      ...config.advice.map((a) => a.text),
    ].map((s) => s.slice(0, 40));
    const leaked = files.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return fragments.some((fragment) => src.includes(fragment));
    });
    expect(leaked).toEqual([]);
  });
});
