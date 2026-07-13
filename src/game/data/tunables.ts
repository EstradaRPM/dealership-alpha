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

// Per-capability execution-fidelity drift tuning (M5 #292). Structurally the
// `SkillDriftConfig` consumed by `NPC.skillDriftFraction`/`signedSkillDrift`
// (defined locally — the data module must not import a game module: that would
// cycle through NPC → data). `maxDriftFraction` is the drift as skill → 0;
// `skillReference` is the skill at which drift floors out.
const SkillDriftConfigSchema = z
  .object({
    maxDriftFraction: z.number().min(0),
    skillReference: z.number().positive().max(100),
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
  }),
  // Composite demand model (#128a). Lives behind the locked #125 DemandSource
  // seam: the live provider derives a single demandFactor from controllable
  // levers (currently: inventory depth × quality) and rides it on the existing
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
    // Price → arrivals blend weight (#277, Pricing/Demand spine S5). How
    // strongly the lot-wide price-posture response bends FloorSim arrival
    // volume, riding the same #125 pricing.trafficMultiplier composite. Ships
    // at 0 ⇒ identity (the seam is wired but the curve is unarmed — zero
    // behavior change); the calibration slice raises it once the per-vehicle
    // response is sourced from MarketEconomy's shared demandMultiplier.
    pricingTrafficWeight: z.number().nonnegative(),
  }),
  // Demand-shaping vehicle-type heat map (#198, re-keyed to segments in #278,
  // Pricing/Demand spine S6). DemandShaper turns a per-day per-segment heat
  // vector into a deterministic weighted spawn draw and tracks realized
  // arrivals in a trailing window for the MANAGERIAL "what's hot" readout.
  // windowSize = arrivals retained; trendEpsilon = share delta below which a
  // segment reads 'steady' (damps single-arrival jitter). `segments` is the
  // ordered heat-map dimension (the VehicleCategory universe); `segmentArchetypes`
  // is the within-segment visit-archetype roll that demotes personas to
  // per-customer negotiation flavor (segment heat drives demand, not personas).
  demandShaper: z.object({
    windowSize: z.number().int().positive(),
    trendEpsilon: z.number().min(0).max(1),
    // Heat-console band thresholds (#280). The console reads the live heat
    // vector (getMix(), the same vector drawSegment uses) and expresses each
    // segment's normalized share as a multiple of an even split (share ×
    // segmentCount, so 1.0 = fair share). `hot`/`cold` are the multiples at
    // which a segment reads HOT / COLD; between them is WARM. Coarse bands by
    // design — precision tiering arrives with the UCM intel slice.
    heatBands: z.object({
      hot: z.number().positive(),
      cold: z.number().positive(),
      // Fine-band edges surfaced once a UCM sharpens the read (#284). `veryHot`
      // is the multiple at/above which a hot segment reads VERY HOT; `veryCold`
      // the multiple at/below which a cold one reads VERY COLD.
      veryHot: z.number().positive(),
      veryCold: z.number().positive(),
    }),
    segments: z.array(z.string().min(1)).min(1),
    segmentArchetypes: z.record(
      z.string().min(1),
      z.record(z.string().min(1), z.number().nonnegative()),
    ),
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
    // Daily weather → traffic VOLUME (#231 S3). A per-condition multiplier on
    // the day's expected foot traffic — nice day ↑, bad day ↓. Rides the locked
    // #125 pricing.trafficMultiplier composite alongside the inventory-depth
    // demandFactor; it is the per-DAY variance, orthogonal to (and never
    // double-counting) floorSim.seasonArrivalMultiplier, which stays the
    // coarse SEASON-level baseline. A condition id absent here defaults to 1
    // (neutral). Reuses the day's already-drawn condition — no new RNG, so the
    // multiplier is a pure projection of (masterSeed, day) and replay-safe.
    conditionVolume: z.record(z.string().min(1), z.number().nonnegative()),
    // Qualitative outlook bands for the Home weather card (#231 S3): the
    // volume multiplier ≥ busyMin reads "high traffic", ≤ slowMax reads "low
    // traffic", otherwise "normal". UI label thresholds, data-driven so the
    // forecast stays an honest, learnable planning signal — not an oracle.
    volumeOutlook: z.object({
      busyMin: z.number().positive(),
      slowMax: z.number().positive(),
    }),
    // New vehicle-attribute demand leans (#231 S4). Signed deltas over the
    // *attribute* axes (winterCapability / openAir / fuelEfficiency — drivetrain,
    // convertible body, fuel economy), the across-the-board complement to the
    // persona-SPACED `attributeLeans` above. `bySeason` carries the climate
    // regime (summer→open-air, winter→AWD) and `byCondition` the acute daily
    // signal (snow/storm/rain→AWD); the two are summed per axis for the day. A
    // positive lean tilts the auto-resolve match toward vehicles above-neutral
    // on that attribute, so which models a day favors stays emergent through
    // persona→preference→pickVehicleFor (#197) — no per-make/model rules. Empty
    // ⇒ no effect (calm-day / config-absent back-compat). Magnitudes are minor
    // first-pass calibration, tuned last.
    attributeAxisLeans: z.object({
      bySeason: z.object({
        spring: z.record(z.string().min(1), z.number()),
        summer: z.record(z.string().min(1), z.number()),
        fall: z.record(z.string().min(1), z.number()),
        winter: z.record(z.string().min(1), z.number()),
      }),
      byCondition: z.record(
        z.string().min(1),
        z.record(z.string().min(1), z.number()),
      ),
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
  // The Reveal engagement spine (#319, design docs/planning/engagement-spine.md).
  // T1's daily Reveal scoreline reads "busy" vs "slow" off the funnel's
  // walked-in count — the only threshold the plain-language framing needs.
  reveal: z.object({
    busyWalkedInThreshold: z.number().nonnegative(),
    // #320: how many individual starred win reactions the Reveal surfaces per
    // day, ranked by drama (match strength, then gross as a tiebreak). Kept
    // small by design — a handful of standout wins, not a per-close ticker.
    starBudget: z.number().int().positive(),
    // #321: how many individual starred walk-off (loss) reactions the Reveal
    // surfaces per day — only the painful/instructive `no_sale` reasons; the
    // boring middle stays folded into the aggregate. Kept smaller than
    // `starBudget` by design (losses are the harsher beat).
    lossStarBudget: z.number().int().positive(),
    // #322: the morning-prep bet's demand-heat read fold. `weatherWeight` is how
    // strongly the Weather attribute lean can move the sedan/truck/suv read vs.
    // the DemandShaper baseline heat; `categoryAttributeProfiles` is the
    // per-category representative attribute vector over the Weather axes
    // (winterCapability / openAir / fuelEfficiency), each in [0,1]. First-pass
    // calibration — tuned last (#286).
    prepBet: z.object({
      weatherWeight: z.number().nonnegative(),
      categoryAttributeProfiles: z.record(
        z.string().min(1),
        z.record(z.string().min(1), z.number()),
      ),
    }),
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
  // Channel-desk manager capability gates (#289+, see
  // docs/planning/manager-roles-channel-desk.md §3). Each *acting* capability
  // earns a hard threshold on its own skill axis: above the gate the manager
  // handles all cases, below (or no manager) is the understaffed path. `advise`
  // capabilities (intel precision #284, appraisal tightness) stay free on hire
  // and aren't gated here — only the act side. M2 (#289) consumes `pricing`
  // (auto-pricing standing policy); M3/M4 add `t_o_closing` / `condition_reading`
  // siblings. Thresholds are on the 0–100 skill scale; magnitudes are
  // placeholders pending the S14 calibration pass (#286).
  managerGates: z.object({
    actThresholds: z.object({
      // Top UCM `pricing` skill at/above which the standing auto-pricing policy
      // is ON (intake auto-prices to the chosen posture); below = suggestion-only.
      pricing: z.number().min(0).max(100),
      // Top UCM `t_o_closing` (turn-over/desking) skill at/above which the UCM
      // desks ALL below-floor discounts (M3 #290); below = the understaffed path
      // (a rare rate-gated slice escalates to the player, the rest walk).
      t_o_closing: z.number().min(0).max(100),
      // Top UCM `condition_reading` skill at/above which the UCM auto-approves
      // ALL escalated trades (M4 #291); below (or no UCM) = the unusual trade
      // escalates to the player. The GM trumps this gate. The appraisal-advice
      // side (#163 trade-confidence read) is free on hire and NOT gated here.
      condition_reading: z.number().min(0).max(100),
    }),
    // Execution-fidelity drift (M5 #292, manager-roles-channel-desk.md §4). Above
    // an act gate the UCM aims at the player's setpoint; skill governs the gap.
    // Per-capability `{ maxDriftFraction (drift as skill→0), skillReference
    // (skill at which drift floors out) }`, scaled deterministically by
    // `NPC.skillDriftFraction`/`signedSkillDrift`. Always drift toward worse
    // (looser allowances / weaker counters / mis-priced units), never ignoring
    // the player. Magnitudes are placeholders pending the S14 calibration pass.
    executionDrift: z.object({
      // Auto-pricing target adherence: the realized intake ask scatters off the
      // strategy's suggested target (two-sided mis-price), clamped at the gross
      // floor. Keyed on the top UCM `pricing` skill.
      pricing: SkillDriftConfigSchema,
      // Discount-desking counter quality: the UCM-desked counter weakens off the
      // salesperson's hold toward the customer's target (one-sided, thinner
      // gross), floored at vehicle cost. Keyed on the top UCM `t_o_closing` skill.
      t_o_closing: SkillDriftConfigSchema,
      // Trade allowance tightness: the appraisal target loosens above the M4
      // monotonic margin (one-sided, looser allowance). Keyed on the top UCM
      // `condition_reading` skill.
      condition_reading: SkillDriftConfigSchema,
    }),
    // #310 (parent #297): the Service-side mirror of the channel-desk gates — a
    // later-tier service manager whose top `shop_throughput` clears each
    // function's threshold takes over that standing Service decision. A LADDER
    // (par lowest → capacity highest) so automation engages one function at a
    // time as the SM grows; below a gate (or no SM) the player keeps manual
    // control. Function tuning lives in `data/service-manager.json`; only the
    // gate thresholds (0–100 skill scale) live here. Placeholders pending #286.
    serviceManager: z.object({
      actThresholds: z.object({
        // Demand-driven par tuning (PartsInventory reorderPoint/target).
        par: z.number().min(0).max(100),
        // Reputation-driven competitive↔premium pricing posture.
        pricing: z.number().min(0).max(100),
        // Base-health / over-stock-driven marketing-arm selection.
        marketing: z.number().min(0).max(100),
        // SM makes the rush-vs-walk call on a parts miss (enables rush-order
        // regardless of tier — the SM IS the operational maturity).
        rush: z.number().min(0).max(100),
        // The rush call becomes capacity-aware (balances against live shop
        // utilization — don't overcommit a slammed bay/advisor floor).
        capacity: z.number().min(0).max(100),
      }),
    }),
    // Body-shop-manager automation gates (#316, parent #297). The Tier-3 mirror of
    // serviceManager. A LADDER (par lowest → capacity highest). The Body Shop's
    // marketing IS the insurance↔retail `channel` posture ("channel choice — no
    // separate mailer arms"), so the single `channel` rung is the unified
    // pricing+marketing gate — there is no separate marketing gate. Function tuning
    // lives in `data/body-shop-manager.json`; only the gate thresholds (0–100 skill
    // scale) live here. Placeholders pending #286.
    bodyShopManager: z.object({
      actThresholds: z.object({
        // Demand-driven par tuning over the collision categories.
        par: z.number().min(0).max(100),
        // Reputation-driven insurance↔retail channel posture (pricing+marketing).
        channel: z.number().min(0).max(100),
        // Manager makes the rush-vs-walk call on a parts miss (enables rush-order
        // regardless of tier — the manager IS the operational maturity).
        rush: z.number().min(0).max(100),
        // The rush call becomes capacity-aware (balances against live shop
        // utilization — don't overcommit a slammed bay/advisor floor).
        capacity: z.number().min(0).max(100),
      }),
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
