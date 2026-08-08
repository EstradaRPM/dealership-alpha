import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { readAppCompositionSource } from './helpers/appComposition';
import type { CharacterProfile } from '../src/game/CareerProgression';

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

function closeDeal(
  bus: ReturnType<typeof createEventBus>,
  frontGross: number,
  backGross: number,
) {
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 21_000,
    frontGross,
    backGross,
    productGross: backGross,
    reserveGross: 0,
    daysInInventory: 9,
    paymentMethod: 'cash',
    downPayment: 21_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

// #331: the FLOOR-OPEN HUD's running gross, the day-close recap's gross, and
// the Reveal's gross all read one number — Records' day total. The app keeps no
// tally of its own, so the figure survives a reload and is replay-safe.
describe('#331 day gross comes from Records, not an app-side tally', () => {
  it('the value the HUD reads tracks the engine through a real day', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 331, characterProfile: PROFILE });

    bus.publish('clock:day_started', { day: world.clock.currentDay });
    expect(world.records.getDayTotals()).toEqual({ gross: 0, units: 0 });

    closeDeal(bus, 1_400, 700);
    expect(world.records.getDayTotals().gross).toBe(2_100);
    closeDeal(bus, 800, 200);
    expect(world.records.getDayTotals().gross).toBe(3_100);

    // Day closes: the figure stands, so the recap + Reveal read the day's real
    // total off the same accessor the HUD used all day.
    bus.publish('floor:day_complete', {
      day: world.clock.currentDay,
      ticks: 1,
      totalArrivals: 3,
    });
    expect(world.records.getDayTotals().gross).toBe(3_100);

    // Next Day clears it for the day now opening.
    bus.publish('clock:day_started', { day: world.clock.currentDay + 1 });
    expect(world.records.getDayTotals()).toEqual({ gross: 0, units: 0 });
  });

  it('the app composition reads the day gross from the engine and keeps no tally', () => {
    const src = readAppCompositionSource();
    // The HUD value is derived at render off the live world...
    expect(src).toMatch(
      /const grossToday = worldRef\.current\?\.records\.getDayTotals\(\)\.gross \?\? 0;/,
    );
    // ...and the day-close read is the same accessor.
    expect(src).toMatch(/const dayGross = w\.records\.getDayTotals\(\)\.gross;/);
    // No parallel accumulation anywhere in the app layer.
    expect(src).not.toMatch(/grossTodayRef/);
    expect(src).not.toMatch(/setGrossToday/);
  });
});
