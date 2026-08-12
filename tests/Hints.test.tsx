import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  createMultiSlotSaveStore,
  createInMemoryDriverFactory,
  type MultiSlotSaveStore,
} from '../src/game/SaveStore';
import { useHints } from '../src/app/useHints';
import { useLevers } from '../src/app/useLevers';
import { loadHints } from '../src/app/hints';
import { OwnershipLevers } from '../src/ui/OwnershipLevers';
import { InGameMenu } from '../src/ui/InGameMenu';
import { TRADE_POLICY, FNI_POSTURE } from '../src/app/config';

/**
 * The teaching mechanism (#386): a consequence hint draws until the player uses
 * the control it sits under, then retires for good in that slot.
 *
 * The harness wires the three pieces the way the composition root does —
 * `useHints` reading the active slot's teaching cell, `useLevers` retiring a
 * hint through `onControlUsed`, and the real lever surface rendering it — so a
 * hint that stopped reaching the surface, or a handler that stopped marking, is
 * a failure here rather than something only a drive would find.
 */
function Harness({ slotStore }: { slotStore: MultiSlotSaveStore }) {
  const hints = useHints({ slotStore });
  const levers = useLevers({
    worldRef: { current: null },
    persistCurrentSave: () => {},
    bump: () => {},
    onControlUsed: hints.markUsed,
  });
  return (
    <>
      <OwnershipLevers
        enabled
        hoursOptions={[{ id: 'standard', label: 'Standard', ticksPerDay: 40 }]}
        hoursOfOpId="standard"
        onSelectHours={() => {}}
        tradePolicyOptions={TRADE_POLICY.policies.map((p) => ({
          id: p.id,
          label: p.label,
          blurb: p.blurb,
        }))}
        tradePolicyId={levers.tradePolicyId}
        onSelectTradePolicy={levers.handleSelectTradePolicy}
        fniPostureOptions={FNI_POSTURE.postures.map((p) => ({
          id: p.id,
          label: p.label,
          blurb: p.blurb,
        }))}
        fniPostureId={levers.fniPostureId}
        onSelectFniPosture={levers.handleSelectFniPosture}
        fniDeskStaffed
        tradePolicyHint={hints.hintFor('trade_policy')}
        fniPostureHint={hints.hintFor('fni_posture')}
      />
      <InGameMenu
        slots={[]}
        activeSlotId={null}
        onClose={() => {}}
        onSave={() => {}}
        onLoadSlot={() => {}}
        onReturnToMainMenu={() => {}}
        onShowHintsAgain={hints.resetHints}
      />
    </>
  );
}

async function harnessWithSlot() {
  const slotStore = createMultiSlotSaveStore(createInMemoryDriverFactory());
  await slotStore.createSlot('Teaching Save');
  return { slotStore, screen: render(<Harness slotStore={slotStore} />) };
}

const CATALOG = loadHints();
const hintText = (id: string) =>
  CATALOG.hints.find((h) => h.id === id)!.text;

describe('#386 consequence hints', () => {
  it('draws a hint under an untouched control', async () => {
    const { screen } = await harnessWithSlot();
    await waitFor(() =>
      expect(screen.getByTestId('hint-fni-posture')).toBeTruthy(),
    );
    // The copy is the catalog's, verbatim — the surface words nothing.
    expect(screen.getByTestId('hint-fni-posture').props.children).toBe(
      hintText('fni_posture'),
    );
    expect(screen.getByTestId('hint-trade-policy')).toBeTruthy();
  });

  it('a used control retires its hint', async () => {
    const { slotStore, screen } = await harnessWithSlot();
    await waitFor(() =>
      expect(screen.getByTestId('hint-fni-posture')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('More per deal'));

    // Retired on the tap, not after the write resolves.
    expect(screen.queryByTestId('hint-fni-posture')).toBeNull();
    // ...and only that one: using one control teaches one thing.
    expect(screen.getByTestId('hint-trade-policy')).toBeTruthy();

    await waitFor(async () => {
      const taught = await (await slotStore.teachingStore())!.listTaught();
      expect(taught).toEqual(['fni_posture']);
    });
  });

  it('a retired hint stays retired across a fresh mount of the same slot', async () => {
    const { slotStore, screen } = await harnessWithSlot();
    await waitFor(() =>
      expect(screen.getByTestId('hint-fni-posture')).toBeTruthy(),
    );
    fireEvent.press(screen.getByText('More per deal'));
    await waitFor(async () => {
      expect(
        await (await slotStore.teachingStore())!.listTaught(),
      ).toEqual(['fni_posture']);
    });

    // A cold mount over the same store — the reload path.
    const reloaded = render(<Harness slotStore={slotStore} />);
    await waitFor(() =>
      expect(reloaded.getByTestId('hint-trade-policy')).toBeTruthy(),
    );
    expect(reloaded.queryByTestId('hint-fni-posture')).toBeNull();
  });

  it('the InGameMenu switch re-arms every hint', async () => {
    const { slotStore, screen } = await harnessWithSlot();
    await waitFor(() =>
      expect(screen.getByTestId('hint-fni-posture')).toBeTruthy(),
    );
    fireEvent.press(screen.getByText('More per deal'));
    fireEvent.press(screen.getByText('Aggressive'));
    expect(screen.queryByTestId('hint-fni-posture')).toBeNull();
    expect(screen.queryByTestId('hint-trade-policy')).toBeNull();

    fireEvent.press(screen.getByText('Show hints again'));

    // Back without a reload.
    expect(screen.getByTestId('hint-fni-posture')).toBeTruthy();
    expect(screen.getByTestId('hint-trade-policy')).toBeTruthy();
    await waitFor(async () => {
      expect(await (await slotStore.teachingStore())!.listTaught()).toEqual([]);
    });
  });

  it('renders hints when no slot is selected', async () => {
    // `teachingStore()` is null here. A hint the store cannot answer for is
    // shown, not hidden — the failure mode is teaching too much, never a
    // control the player was never told anything about.
    const slotStore = createMultiSlotSaveStore(createInMemoryDriverFactory());
    expect(await slotStore.teachingStore()).toBeNull();

    const screen = render(<Harness slotStore={slotStore} />);
    await waitFor(() =>
      expect(screen.getByTestId('hint-fni-posture')).toBeTruthy(),
    );
    expect(screen.getByTestId('hint-trade-policy')).toBeTruthy();

    // And using the control cannot throw just because there is nowhere to
    // record it — the line simply goes for this session.
    fireEvent.press(screen.getByText('More per deal'));
    expect(screen.queryByTestId('hint-fni-posture')).toBeNull();
  });
});
