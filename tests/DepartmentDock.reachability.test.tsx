import React from 'react';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { buildDepartmentDock, BODY_SHOP_MIN_TIER } from '../src/app/config';
import { DepartmentDock, OperationsTab } from '../src/ui/OperationsTab';
import { readAppCompositionSource } from './helpers/appComposition';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { World } from '../src/createWorld';

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

function freshWorld(): World {
  const bus = createEventBus();
  return createWorld({ bus, masterSeed: 346, characterProfile: PROFILE });
}

const keysOf = (world: World) => buildDepartmentDock(world).map((t) => t.key);

/** Stand a world up at a tier through TierManager's public state seam. */
function setTier(world: World, tier: number) {
  world.tierManager.restoreState({
    ...world.tierManager.getSerializableState(),
    currentTier: tier,
  });
}

describe('#346 department dock — the dock renders only stood-up departments', () => {
  it('omits BDC and Office at Tier 1 — no mechanic produces work for either', () => {
    const keys = keysOf(freshWorld());

    expect(keys).not.toContain('bdc');
    expect(keys).not.toContain('office');
  });

  it('renders the Lot and Sales at Tier 1, with the Lot as the hero tile', () => {
    const tiles = buildDepartmentDock(freshWorld());

    expect(tiles.map((t) => t.key)).toEqual(['lot', 'sales']);
    expect(tiles.find((t) => t.key === 'lot')!.hero).toBe(true);
    expect(tiles.find((t) => t.key === 'sales')!.hero).toBe(false);
  });

  it('omits Service at Tier 1 and includes it once the tier gate opens', () => {
    const world = freshWorld();
    expect(keysOf(world)).not.toContain('service');

    // The dock reads the live tier, so standing the department up is the only
    // thing that adds the tile — the component holds no unlock logic.
    setTier(world, 2);
    expect(keysOf(world)).toContain('service');
  });

  it('omits the Body Shop below its minimum tier and includes it at or above', () => {
    const world = freshWorld();
    expect(keysOf(world)).not.toContain('bodyshop');

    setTier(world, BODY_SHOP_MIN_TIER);
    expect(keysOf(world)).toContain('bodyshop');
  });

  it('reports real stock on the Lot tile', () => {
    const world = freshWorld();
    const units = world.inventory.getLotVehicles().length;

    const lot = buildDepartmentDock(world).find((t) => t.key === 'lot')!;
    expect(lot.status).toContain(String(units));
  });
});

describe('#346 department dock — the surface is mounted and dispatches', () => {
  it('renders one tile per stood-up department', () => {
    const tiles = buildDepartmentDock(freshWorld());
    const { queryByTestId } = render(
      <DepartmentDock tiles={tiles} onPress={() => {}} />,
    );

    for (const tile of tiles) {
      expect(queryByTestId(`dept-tile-${tile.key}`)).not.toBeNull();
    }
    expect(queryByTestId('dept-tile-bdc')).toBeNull();
    expect(queryByTestId('dept-tile-office')).toBeNull();
  });

  it('dispatches the department key when a tile is pressed', () => {
    const pressed: string[] = [];
    const tiles = buildDepartmentDock(freshWorld());
    const { getByTestId } = render(
      <DepartmentDock tiles={tiles} onPress={(d) => pressed.push(d)} />,
    );

    getByTestId('dept-tile-lot').props.onClick?.();
    getByTestId('dept-tile-lot').props.onPress?.();

    expect(pressed).toContain('lot');
  });

  it('mounts the dock inside the Operations tab', () => {
    const { queryByTestId } = render(
      <OperationsTab
        dock={buildDepartmentDock(freshWorld())}
        onDeptPress={() => {}}
      />,
    );

    expect(queryByTestId('department-dock')).not.toBeNull();
  });

  it('is wired in the app composition root off world state, not a fixed list', () => {
    const src = readAppCompositionSource();

    expect(src).toContain('buildDepartmentDock(world)');
    // The legacy bottom-nav row reuse is gone from the Operations surface —
    // badges now reach the dock through the builder, not as a raw prop.
    expect(src).not.toContain('badges={world.departmentQueue.getBadges()}');
  });

  it('routes Service and the Body Shop to their own rooms, not the generic queue', () => {
    const src = readAppCompositionSource();

    // #348: onto the Operations tab's own stack, so the room opens inside the
    // shell with the tab bar still up.
    expect(src).toContain("tabs.navigate('service')");
    expect(src).toContain("tabs.navigate('bodyShop')");
  });
});
