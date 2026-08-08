import { readFileSync } from 'fs';
import { join } from 'path';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { TunablesSchema } from '../src/game/data';
import type { CharacterProfile } from '../src/game/CareerProgression';

/**
 * #372 — advertising buys a different crowd.
 *
 * An advertising campaign carries TWO orthogonal lanes: vehicle-type weights
 * (which segment walks in) and person-archetype weights (who does). The second
 * lane is what gives the #371 finance-mix read something to answer with: the
 * wire says the crowd leans cash, and advertising is how the player moves it.
 *
 * The lanes ride ONE influence input on ONE lag/decay clock, and the skew is
 * applied in ONE place (`skewSegmentArchetypes`) that both the spawn draw and
 * the forward finance-mix projection read — so the crowd the wire promises is
 * the crowd that walks through the door.
 */

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

const TUNABLES_PATH = join(__dirname, '..', 'data', 'tunables.json');

function loadRawTunables(): Record<string, unknown> {
  return JSON.parse(readFileSync(TUNABLES_PATH, 'utf-8')) as Record<string, unknown>;
}

function makeWorld() {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed: 42, characterProfile: PROFILE });
  return { bus, world };
}

/**
 * Run a campaign to its fully ramped-in state. The lag is real (the whole point
 * of the "lags and decays" criterion), so a crowd assertion has to advance past
 * it or it is measuring the pre-campaign world.
 */
function runCampaign(
  world: ReturnType<typeof createWorld>,
  campaignId: string,
  days = 10,
): void {
  world.demandControls.setAdvertisingCampaign(campaignId);
  world.demandShaper.advanceInfluenceDay(days);
}

interface CrowdReading {
  size: number;
  financedShare: number;
  meanCredit: number;
}

/**
 * Run real days and measure the crowd that actually walked onto the floor.
 *
 * `capacity:customer_admitted` fires once per generated sales up, straight out
 * of the composition root's `customerSource.spawn` — so this reads the shipped
 * generation path (heat map draw → skewed within-segment archetype roll →
 * CustomerFactory), not a re-derivation of it in the test.
 */
function runCrowd(
  bus: ReturnType<typeof createEventBus>,
  world: ReturnType<typeof createWorld>,
  days: number,
): CrowdReading {
  let size = 0;
  let financed = 0;
  let creditTotal = 0;
  bus.subscribe('capacity:customer_admitted', ({ customerId }) => {
    const session = world.customerPool.getSession(customerId);
    if (!session) return;
    const { person, visit } = session.bundle;
    if (visit.kind !== 'sales') return;
    size++;
    if (visit.paymentMethod === 'finance') financed++;
    creditTotal += person.credit;
  });
  // Demand is gated on inventory depth (#128a) — an empty lot draws nobody, and
  // since #361 a tier-1 lot holds six cars with the seed lot already in three.
  const listings = [...world.inventory.getAuctionListings()].sort(
    (a, b) => a.askingPrice - b.askingPrice,
  );
  for (const listing of listings) {
    if (world.economy.cash < listing.askingPrice) break;
    if (world.inventory.getLotOccupancy().atCapacity) break;
    world.inventory.buyFromAuction(listing.id);
  }
  for (let day = 0; day < days; day++) world.dayLoop.nextDay().runDay();
  if (size === 0) throw new Error('no crowd was generated');
  return { size, financedShare: financed / size, meanCredit: creditTotal / size };
}

const CROWD_DAYS = 60;

describe('#372 advertising campaigns carry a crowd lane', () => {
  it('a campaign carries both kinds of weight', () => {
    const raw = loadRawTunables();
    const parsed = TunablesSchema.parse(raw);
    const campaigns = parsed.demandShaper.advertisingInfluence?.campaigns ?? [];

    const finance = campaigns.find((c) => c.id === 'we-finance-anyone');
    const cpo = campaigns.find((c) => c.id === 'certified-preowned');
    expect(finance).toBeDefined();
    expect(cpo).toBeDefined();

    // Both lanes declared on one campaign, and both reach the schema intact.
    expect(Object.keys(finance!.weights ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(finance!.personWeights ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(cpo!.personWeights ?? {}).length).toBeGreaterThan(0);

    // Person weights may only name buyers the game actually spawns — the world
    // hands DemandShaper the spawn catalog as the key universe, so an unknown
    // id would throw at campaign start rather than skew a phantom crowd.
    const { world } = makeWorld();
    expect(() => world.demandControls.setAdvertisingCampaign('we-finance-anyone')).not.toThrow();
    expect(() => world.demandControls.setAdvertisingCampaign('certified-preowned')).not.toThrow();
  });

  it('a campaign that influences nothing is refused', () => {
    const raw = loadRawTunables();
    const demandShaper = raw.demandShaper as Record<string, unknown>;
    const advertising = demandShaper.advertisingInfluence as {
      campaigns: Record<string, unknown>[];
    };
    const inert = {
      ...advertising.campaigns[0],
      id: 'billboard-of-nothing',
      weights: undefined,
      personWeights: undefined,
    };
    delete inert.weights;
    delete inert.personWeights;
    const broken = {
      ...raw,
      demandShaper: {
        ...demandShaper,
        advertisingInfluence: {
          campaigns: [...advertising.campaigns, inert],
        },
      },
    };
    expect(() => TunablesSchema.parse(broken)).toThrow();

    // An empty declaration is the same nothing as an absent one.
    const empty = { ...inert, weights: {}, personWeights: {} };
    expect(() =>
      TunablesSchema.parse({
        ...raw,
        demandShaper: {
          ...demandShaper,
          advertisingInfluence: { campaigns: [...advertising.campaigns, empty] },
        },
      }),
    ).toThrow();
  });

  it('we-finance-anyone moves the payment mix', () => {
    const projectionCold = makeWorld().world;
    const projectionPushed = makeWorld().world;
    runCampaign(projectionPushed, 'we-finance-anyone');
    // The forward read (#371, the wire's finance-mix lane) moves first — it is
    // what the player checks before committing the spend.
    expect(projectionPushed.getCrowdFinanceMix().financeShare).toBeGreaterThan(
      projectionCold.getCrowdFinanceMix().financeShare,
    );

    // And the crowd that actually walks in moves with it: the read and the draw
    // go through the same skewed weights, so they cannot disagree.
    const cold = makeWorld();
    const pushed = makeWorld();
    pushed.world.demandControls.setAdvertisingCampaign('we-finance-anyone');
    const coldCrowd = runCrowd(cold.bus, cold.world, CROWD_DAYS);
    const pushedCrowd = runCrowd(pushed.bus, pushed.world, CROWD_DAYS);
    expect(pushedCrowd.financedShare).toBeGreaterThan(coldCrowd.financedShare);
    // Easy-approval advertising pulls a weaker book, not just a busier office.
    expect(pushedCrowd.meanCredit).toBeLessThan(coldCrowd.meanCredit);
  });

  it('certified pre-owned moves the crowd the other way', () => {
    const projectionCold = makeWorld().world;
    const projectionPushed = makeWorld().world;
    runCampaign(projectionPushed, 'certified-preowned');
    expect(projectionPushed.getCrowdFinanceMix().cashShare).toBeGreaterThan(
      projectionCold.getCrowdFinanceMix().cashShare,
    );

    const cold = makeWorld();
    const pushed = makeWorld();
    pushed.world.demandControls.setAdvertisingCampaign('certified-preowned');
    const coldCrowd = runCrowd(cold.bus, cold.world, CROWD_DAYS);
    const pushedCrowd = runCrowd(pushed.bus, pushed.world, CROWD_DAYS);
    expect(1 - pushedCrowd.financedShare).toBeGreaterThan(1 - coldCrowd.financedShare);
    expect(pushedCrowd.meanCredit).toBeGreaterThan(coldCrowd.meanCredit);
  });

  it('person weights lag and decay like vehicle weights', () => {
    const { world } = makeWorld();
    const financeShareNow = () => world.getCrowdFinanceMix().financeShare;
    const cold = financeShareNow();

    world.demandControls.setAdvertisingCampaign('we-finance-anyone');
    // lagDays 3 on the certified push, 2 here: the day the poster goes up, the
    // crowd has not changed yet.
    expect(financeShareNow()).toBeCloseTo(cold, 10);

    world.demandShaper.advanceInfluenceDay(1);
    const partial = financeShareNow();
    expect(partial).toBeGreaterThan(cold);

    world.demandShaper.advanceInfluenceDay(1);
    const full = financeShareNow();
    expect(full).toBeGreaterThan(partial);

    // Ramped in: both lanes are at target on the same clock.
    const [input] = world.demandShaper
      .getInfluenceInputs()
      .filter((i) => i.producer === 'advertising');
    expect(input.personWeights.young_family).toBeCloseTo(
      input.targetPersonWeights.young_family,
      10,
    );
    expect(input.weights.truck).toBeCloseTo(input.targetWeights.truck, 10);

    // And it decays back out rather than snapping off.
    world.demandControls.setAdvertisingCampaign('none');
    const justPulled = financeShareNow();
    expect(justPulled).toBeGreaterThan(cold);
    world.demandShaper.advanceInfluenceDay(1);
    expect(financeShareNow()).toBeLessThan(justPulled);
    world.demandShaper.advanceInfluenceDay(5);
    expect(financeShareNow()).toBeCloseTo(cold, 10);
  });

  it('a crowd-only campaign still bills, and still reports as running', () => {
    const { world } = makeWorld();
    // The daily spend is read back off the RUNNING input, so a campaign whose
    // only lane is the crowd must still resolve to a live input — otherwise it
    // would silently run free.
    world.demandControls.setAdvertisingCampaign('we-finance-anyone');
    expect(world.demandControls.getAdvertisingCampaignId()).toBe('we-finance-anyone');
    expect(world.demandControls.getAdvertisingDailyCost()).toBeGreaterThan(0);
  });
});
