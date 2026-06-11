import { z } from 'zod';
import { parseData } from './loadJson';

// One season's weather generation band (#231). Temperature is drawn uniformly
// in [tempMinF, tempMaxF]; the day's condition is a weighted draw over the
// shared condition catalog (snow weight ~0 outside winter, etc.).
const WeatherSeasonSchema = z
  .object({
    tempMinF: z.number(),
    tempMaxF: z.number(),
    conditionWeights: z.record(z.string().min(1), z.number().nonnegative()),
  })
  .strict();

export const TunablesSchema = z.object({
  schemaVersion: z.literal(1),
  clock: z.object({
    minutesPerTick: z.number().int().positive(),
    ticksPerDay: z.number().int().positive(),
    daysPerMonth: z.number().int().positive(),
  }),
  floorSim: z.object({
    ticksPerDay: z.number().int().positive(),
    baseDailyArrivals: z.number().nonnegative(),
    reputationArrivalCoeff: z.number().nonnegative(),
    marketShareArrivalCoeff: z.number().nonnegative(),
    seasonArrivalMultiplier: z.object({
      spring: z.number().nonnegative(),
      summer: z.number().nonnegative(),
      fall: z.number().nonnegative(),
      winter: z.number().nonnegative(),
    }),
    // Forced-exception channel (#103): whether escalated cases minted into
    // FloorSim's roster are flagged mustHandle (forced for the player).
    exceptionMustHandle: z.boolean(),
  }),
  // Composite demand model (#128a). Lives behind the locked #125 DemandSource
  // seam: the live provider derives a single demandFactor from controllable
  // levers (v1: inventory depth × quality) and rides it on the existing
  // pricing.trafficMultiplier field. FloorSim consumes only the projected
  // scalar — no magic numbers in the provider.
  demandModel: z.object({
    // Inventory count at which the depth saturation factor reaches 0.5
    // (Hill curve stock/(stock+halfSat)): 0 cars → 0 traffic.
    inventoryHalfSat: z.number().positive(),
    // Per-condition desirability weight; averaged across the lot.
    conditionWeight: z.object({
      clean: z.number().nonnegative(),
      average: z.number().nonnegative(),
      rough: z.number().nonnegative(),
    }),
    // Quality multiplier lerps over [min,max] by the lot's avg condition weight.
    qualityMultMin: z.number().nonnegative(),
    qualityMultMax: z.number().nonnegative(),
    // Hard clamp on the composite demandFactor (outlier guard).
    demandFactorMax: z.number().positive(),
  }),
  // Demand-shaping persona mix (#198). DemandShaper turns a per-day persona
  // weight vector into a deterministic weighted spawn draw and tracks realized
  // arrivals in a trailing window for the MANAGERIAL "who's been walking in"
  // readout. windowSize = arrivals retained; trendEpsilon = share delta below
  // which a persona reads 'steady' (damps single-arrival jitter).
  demandShaper: z.object({
    windowSize: z.number().int().positive(),
    trendEpsilon: z.number().min(0).max(1),
    locationProfiles: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          weights: z.record(z.string().min(1), z.number().nonnegative()),
        }),
      )
      .optional(),
    inventoryInfluence: z
      .object({
        maxWeight: z.number().nonnegative(),
        lagDays: z.number().int().nonnegative().optional(),
        decayDays: z.number().int().nonnegative().optional(),
        categoryWeights: z.record(
          z.string().min(1),
          z.record(z.string().min(1), z.number().nonnegative()),
        ),
      })
      .optional(),
    reputationInfluence: z
      .object({
        neutralReviewScore: z.number().min(0).max(100),
        maxWeight: z.number().nonnegative(),
        lagDays: z.number().int().nonnegative().optional(),
        decayDays: z.number().int().nonnegative().optional(),
        highWeights: z.record(z.string().min(1), z.number().nonnegative()),
        lowWeights: z.record(z.string().min(1), z.number().nonnegative()),
      })
      .optional(),
    advertisingInfluence: z
      .object({
        campaigns: z.array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            blurb: z.string().min(1),
            lagDays: z.number().int().nonnegative(),
            decayDays: z.number().int().nonnegative().optional(),
            weights: z.record(z.string().min(1), z.number()),
          }),
        ),
      })
      .optional(),
    coverageCategoryByPersona: z
      .record(z.string().min(1), z.string().min(1))
      .optional(),
  }),
  // Weather / season substrate (#231). Per-day weather is a pure deterministic
  // projection of (masterSeed, day): a temperature drawn in the season's range
  // plus a condition drawn from the season's condition weights, on a per-day
  // keyed seed (replay-safe, independent of tick order — see
  // replay-determinism-constraint). Slice 1 is read-only (a Home calendar
  // readout); later slices ride season/weather onto demand. `conditions` is the
  // id → display-label catalog; each season's `conditionWeights` is a relative
  // distribution over those ids.
  weather: z.object({
    conditions: z.record(z.string().min(1), z.string().min(1)),
    seasons: z.object({
      spring: WeatherSeasonSchema,
      summer: WeatherSeasonSchema,
      fall: WeatherSeasonSchema,
      winter: WeatherSeasonSchema,
    }),
    // Season → demand lean (#231 S2). Additive per-axis deltas applied to the
    // customer want-vector (the 6 SPACED axes), so the seasonal effect stays
    // emergent through persona→preference→pickVehicleFor (#197): weather nudges
    // *what buyers want* along attribute axes, and which specific models that
    // favors falls out of the match — learnable across the full inventory, no
    // per-make/model rules. Each season is a partial record over the SPACED axis
    // ids (safety/performance/appearance/comfort/economy/dependability); a
    // missing axis means no lean (0). Magnitudes are minor first-pass
    // calibration, tuned last. Condition-specific leans over *new* axes
    // (snow→AWD, etc.) arrive with the attribute-schema extension (S4).
    attributeLeans: z.object({
      bySeason: z.object({
        spring: z.record(z.string().min(1), z.number()),
        summer: z.record(z.string().min(1), z.number()),
        fall: z.record(z.string().min(1), z.number()),
        winter: z.record(z.string().min(1), z.number()),
      }),
    }),
  }),
  // Live render loop (#121, design #107). UI-only: a wall-clock interval
  // drives FloorSim.step() at `baseTickIntervalMs / speed`. Game logic never
  // sees these — speed/cadence are pure render multipliers over step().
  renderLoop: z.object({
    // Cadence at 1× speed: ms between step() calls.
    baseTickIntervalMs: z.number().int().positive(),
    // Selectable speed multipliers (1× first = default). Skip-to-close is a
    // separate verb (runDay()), not a multiplier.
    speedMultipliers: z.array(z.number().int().positive()).nonempty(),
    // Representative open-hours window for the HUD clock derived from
    // currentTick/ticksPerDay. Cosmetic — never feeds game logic.
    openHour: z.number().int().min(0).max(23),
    closeHour: z.number().int().min(1).max(24),
  }),
  handPlay: z.object({
    tickCostPerGate: z.number().int().positive(),
    defaultCustomerDifficulty: z.number().min(0).max(1),
    walkQualityFloor: z.number().min(0).max(1),
    // Default for the hand-play spotlight modal (#118): false ⇒ opening the
    // modal auto-pauses the day; true ⇒ the day keeps running live behind it
    // (the #74/#105 felt-pacing comparison path).
    playtestLiveDefault: z.boolean(),
    approachChoices: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          fitModifier: z.number(),
          difficultyModifier: z.number(),
        }),
      )
      .nonempty(),
  }),
  // Inventory-buyer match-payoff beat (#199). Presentation-only: the want-axis
  // fit a closed deal must clear for the floor toast ("you had what they
  // wanted") + the DayRecap "strong match" tally to count it. Game logic never
  // reads this — it thresholds the `matchQuality` carried on staff:auto_resolved.
  matchPayoff: z.object({
    strongMatchThreshold: z.number().min(0).max(1),
  }),
  economy: z.object({
    startingCash: z.number().nonnegative(),
    dailyOverheadBase: z.number().nonnegative(),
  }),
  // Pre-open ownership levers (#120, design #107 d11). The hours-of-op lever
  // selects an option and the composition root feeds its scaled `ticksPerDay`
  // into FloorSim via the additive `createFloorSim` override (#207), so a
  // longer shift runs a longer day.
  // MarketEconomy comp-history window (#157). Rolling window per segment of
  // realized wholesale + retail transactions; the mean of `(price/reference)
  // - 1` over the window is the emergent segment-drift term that layers on
  // top of the per-save personality bias (#156). All tunables live here so
  // the engine has zero magic numbers in code.
  marketEconomy: z.object({
    compWindow: z.object({
      // Max comp entries retained per segment (FIFO). Older entries drop
      // when the window is full.
      sizePerSegment: z.number().int().positive(),
      // Comps older than this (in days, vs. the current day at read time)
      // are ignored by the drift calculation. They stay in the window until
      // a fresher comp pushes them out — keeps the math stable across
      // reload + replay.
      ageCutoffDays: z.number().int().positive(),
      // Weights applied when averaging deltas. Retail signal is stronger
      // (realized customer-paid price); wholesale is noisier (auction
      // motivated-seller variance, future #160).
      retailWeight: z.number().positive(),
      wholesaleWeight: z.number().positive(),
      // Synthetic-comp weight applied to entries derived from
      // `competitor:price_changed` (slice #158). Lower than retail so the
      // player's own realized prices dominate the drift signal.
      competitorWeight: z.number().positive(),
      // Multiplier applied to the weighted mean delta to produce the
      // segmentDrift term. < 1 dampens (prevents runaway feedback once
      // drift loops back into demand in later slices); > 1 amplifies.
      driftDamping: z.number().nonnegative(),
    }),
    // Scales `(newPricing - oldPricing)` from competitor:price_changed into
    // the synthetic-comp delta. < 1 keeps competitor moves from dominating
    // realized retail comps (slice #158).
    competitorInfluence: z.number().nonnegative(),
    // Stochastic market-shock scheduler (slice #159). On each
    // clock:day_started, a single deterministic roll decides whether a new
    // shock activates (probability `arrivalProbPerDay`). The active list is
    // capped at `maxConcurrent` — if at cap, the day's roll is skipped.
    // Selection is rarity-weighted from market-shocks.json; magnitude +
    // duration draw uniformly from the catalog band.
    shocks: z.object({
      arrivalProbPerDay: z.number().min(0).max(1),
      maxConcurrent: z.number().int().positive(),
    }),
    // Motivated-seller noise distribution applied to each auction listing
    // price (slice #160). Per-source reliability lerps the multiplier stdev
    // from `stdevHonest` (reliability=1) to `stdevUnreliable` (reliability=0),
    // then the raw draw is clipped to `[floor, ceiling]`. Centered at
    // `meanMultiplier` so listings stay anchored to honest book on average.
    motivatedSeller: z.object({
      meanMultiplier: z.number().positive(),
      stdevHonest: z.number().nonnegative(),
      stdevUnreliable: z.number().nonnegative(),
      floor: z.number().positive(),
      ceiling: z.number().positive(),
    }),
  }),
  // CompetitorMarket (slice #158). Weekly drift emits
  // `competitor:price_changed` when |new − old| ≥ this threshold. Below the
  // threshold the drift is treated as noise and no event fires.
  competitorMarket: z.object({
    pricingChangeThreshold: z.number().nonnegative(),
  }),
  ownership: z.object({
    hoursOfOp: z.object({
      // Selectable shift lengths. Longer day ⇒ higher ticksPerDay ⇒ more
      // arrivals (and, downstream, more morale hit per #107 d5).
      options: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            ticksPerDay: z.number().int().positive(),
          }),
        )
        .nonempty(),
      defaultId: z.string().min(1),
    }),
  }),
  // Per-slot trade-acquisition policy (#172). `multiplier` scales the staff's
  // internal trade-in acceptance target in DealEngine.evaluateTrade. The
  // composition root resolves the selected id to its multiplier
  // (`resolveTradePolicyMultiplier`) and threads it through the trade resolver;
  // the chosen id persists per save slot. Default `market` = 1.0 (honest book),
  // so an unset/legacy slot leaves the #94 calibration path untouched.
  tradePolicy: z.object({
    defaultId: z.string().min(1),
    policies: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          multiplier: z.number().positive(),
          blurb: z.string().min(1),
        }),
      )
      .nonempty(),
  }),
});

export type Tunables = z.infer<typeof TunablesSchema>;

export function loadTunables(): Tunables {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/tunables.json');
  return parseData(raw, TunablesSchema, 'data/tunables.json');
}
