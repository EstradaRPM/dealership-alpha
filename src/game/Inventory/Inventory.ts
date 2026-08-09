import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import {
  rollRecon,
  pickSurpriseTemplate,
  deriveReconSeed,
  deriveReconSurpriseSeed,
  loadReconVarianceConfig,
  loadReconSurpriseEventsConfig,
  rollAuctionSourceReliability,
  loadAuctionSourcesConfig,
  type ReconVarianceConfig,
  type ReconSurpriseEventsConfig,
  type AuctionSourceReliability,
} from '../MarketEconomy';
import { generateAuctionListings } from './auctionGenerator';
import { loadVehicleData, reconEstimateFor } from './vehicleData';
import { loadInventoryConfig, type InventoryConfig } from './inventoryConfig';
import { computeDailyCarryingCost, floorplanAprForTier } from './carryingCost';
import type { VehicleData } from './vehicleData';
import type { StartingInventorySpec } from './startingInventory';
import type { AuctionListing, LotVehicle, TradeAcquisitionInput } from './types';

/**
 * The one ledger label every cost-of-sale relief is written under (#374).
 * Deliberately NOT per-vehicle: the Finance expense breakdown groups by label,
 * and a label per car would shatter the single largest line on a dealership's
 * statement into a hundred slivers that all fold into "Other".
 */
const COST_OF_SALE_LABEL = 'Cost of Vehicles Sold';

/**
 * Powertrain stamped on every `inventory:vehicle_sold` (#298). The vehicle
 * catalog has no powertrain axis yet — every unit is internal-combustion — so
 * this is the single honest value, not a placeholder guess. When EV/hybrid
 * templates are modeled the value is sourced per-vehicle here; the join seam
 * downstream (InstalledBase) is already powertrain-aware.
 */
const DEFAULT_POWERTRAIN = 'ice' as const;

/**
 * Persistence surface for Inventory (#189, parent #186). Module-owned
 * `schemaVersion`, same convention as GameClock/Economy. Captures the full
 * mutable lot state so a load restores the exact lot the player left — lot
 * vehicles (with their aging clocks + accrued carrying cost), the live auction
 * board, and any held inspection listings — rather than recomputing from
 * scratch. The hidden per-save auction-source reliability is NOT persisted: it
 * is rolled deterministically from `masterSeed`, so the seed + catalog stay the
 * canonical artifact (same pattern as the #156 personality vector). Maps are
 * flattened to arrays for JSON; `LotVehicle`/`AuctionListing` are plain data.
 */
export interface InventorySnapshot {
  readonly schemaVersion: 1;
  readonly currentDay: number;
  readonly lastPreparedDay: number;
  readonly auctionListings: readonly AuctionListing[];
  readonly pendingInspections: readonly AuctionListing[];
  readonly lotVehicles: readonly LotVehicle[];
}

/**
 * How full the lot is (#361, A2 R2). `occupied` counts **every** owned unit —
 * a car inside the frontline hold and a car with recon outstanding are both
 * sitting on the lot costing money, and there is no off-lot state in the model.
 * `built` is the Facility's built lot spaces, read live, so a finished
 * construction job reopens buying with no further player action.
 *
 * `occupied` can legitimately exceed `built`: a trade always lands (it is part
 * of a sale already made), and that is the one way over the cap. Buying stays
 * frozen until the lot is back under it.
 */
export interface LotOccupancy {
  readonly occupied: number;
  readonly built: number;
  /** Spaces left to buy into; 0 at or over the cap (never negative). */
  readonly spacesOpen: number;
  /** `true` when no buy may be made — the auction's "no spaces open". */
  readonly atCapacity: boolean;
}

/**
 * What wholesaling a given unit would do (#362, A2 R2). The whole quote — the
 * offer AND what it costs you — because this is the one action that realizes a
 * loss on purpose, and the player must see the number before committing.
 *
 * The rule lives here and only here: no surface re-derives proceeds from book,
 * and none subtracts its own cost basis.
 */
export interface WholesaleQuote {
  readonly vehicleId: string;
  /** The unit's live book value — what the offer comes off. */
  readonly bookValue: number;
  /** `bookValue × (1 − haircutPct)`, rounded, never below 0. */
  readonly proceeds: number;
  /** `purchasePrice + reconCost` — what the unit has cost you so far. */
  readonly costBasis: number;
  /** `proceeds − costBasis`. Negative is the loss you are choosing to take. */
  readonly gain: number;
}

export interface Inventory {
  getAuctionListings(): readonly AuctionListing[];
  getLotVehicles(): readonly LotVehicle[];
  getLotVehicle(vehicleId: string): LotVehicle | undefined;
  /**
   * Lot occupancy against built spaces (#361). The one number the Lot room and
   * the auction surface both state ("31 of 35 spaces"); neither re-derives it.
   */
  getLotOccupancy(): LotOccupancy;
  /**
   * Buy a listing outright. Throws when the lot has no space for it (#361) —
   * the cap is checked at the bid, so units already won this pass count.
   */
  buyFromAuction(listingId: string): void;
  /**
   * Materialize a customer's accepted trade-in as a new lot vehicle (#171).
   * Driven by `trade:resolved` (subscribed internally); exposed for direct /
   * test use. The `agreedAllowance` is the cost basis — a *non-cash*
   * acquisition (offset against deal cash in the close structure, NOT posted as
   * an Economy expense). Recon-variance machinery applies exactly as for an
   * auction buy, with the staff condition-read confidence standing in for
   * source reliability, so a trade can hide a lemon. Emits
   * `inventory:vehicle_acquired_via_trade`; the unit is on the lot immediately.
   *
   * #361: a trade **always lands**, even at or over the lot cap — it is part of
   * a sale you already made, and refusing it would unwind a closed deal. It may
   * put the lot at 36 of 35; buying is then frozen until you are back under.
   * The rule is self-correcting by construction: the deal that brings a trade
   * in also takes a car out.
   */
  acquireFromTrade(acquisition: TradeAcquisitionInput): LotVehicle;
  /**
   * Remove a lot vehicle and publish `inventory:vehicle_sold`. `salePrice` is
   * the realized retail price (DealEngine passes `agreedPrice`). Tests calling
   * `sellVehicle` without DealEngine in the loop can omit it — it defaults to
   * the vehicle's `askingPrice` so the comp record stays meaningful.
   */
  sellVehicle(vehicleId: string, salePrice?: number): LotVehicle;
  /**
   * What wholesaling this unit would pay and cost (#362). Returns `undefined`
   * for an unknown id. Read-only — nothing moves until `wholesaleVehicle`.
   */
  getWholesaleQuote(vehicleId: string): WholesaleQuote | undefined;
  /**
   * Wholesale a unit out (#362, A2 R2) — the release valve on owned inventory.
   * Pays `getWholesaleQuote(id).proceeds` through Economy, takes the unit off
   * the lot, and emits `inventory:vehicle_wholesaled`.
   *
   * Available for **any** owned unit: recon state and the #295 frontline hold
   * are states of a car already sitting on your lot, not conditions on selling
   * it. One rule, no second ceiling. Throws on an unknown id (the surface only
   * ever passes ids it just read off `getLotVehicles`).
   */
  wholesaleVehicle(vehicleId: string): WholesaleQuote;
  /**
   * Player-set asking price for a lot vehicle (MANAGERIAL Pricing lever,
   * #120). Negative inputs are clamped to 0; an unknown vehicleId is a no-op
   * (the lever only ever passes ids it just read from `getLotVehicles`).
   */
  setAskingPrice(vehicleId: string, askingPrice: number): void;
  /**
   * Player authorizes continued recon spend after a mid-recon surprise
   * (#162). Resumes the daily spend cadence; remaining shortfall amortizes
   * across `reconDaysRemaining`. No-op if vehicle isn't paused for a decision.
   */
  authorizeReconSpend(vehicleId: string): void;
  /**
   * Player abandons recon after a surprise (#162). Wholesales the unit at
   * `bookValue − reconSpentToDate` (per #162 AC); the spread vs. cost basis
   * posts as a loss via Economy. No-op if vehicle isn't paused for a decision.
   */
  abandonRecon(vehicleId: string): void;
  /**
   * Player pays for a pre-purchase inspection on an auction listing (#164).
   * Posts the inspection cost via Economy and blocks purchase of the listing
   * until `inspectionAvailableDay` (currentDay + daysToComplete). The listing
   * is held across the day rollover (pulled out of the daily regenerated board)
   * so the result can be presented and the unit can be bought on the next
   * morning. Idempotent for status !== 'none'; throws if the listing id is
   * unknown.
   */
  requestInspection(listingId: string): void;
  /** #189 SaveStore seam: capture/rehydrate the full lot + auction-board state. */
  snapshot(): InventorySnapshot;
  restore(snap: InventorySnapshot): void;
}

export interface InventoryDeps {
  bus: EventBus;
  masterSeed: number;
  economy: Pick<
    Economy,
    'cash' | 'postExpense' | 'postRevenue' | 'forceDebit' | 'postCostOfSale'
  >;
  /**
   * Live dealership tier provider (#173). Drives the floorplan APR used in the
   * daily carrying-cost accrual — better tiers borrow more cheaply. Omit to
   * default to tier 1 (the baseline APR).
   */
  getTier?: () => number;
  /**
   * Built lot spaces — the cap on buying (#361, A2 R2). Read live off the
   * Facility module's built capacity at the composition root, so a finished
   * construction job reopens buying the moment the space is standing and no
   * per-tier lot table lives beside it. Omit (test harnesses without a
   * Facility) ⇒ an uncapped lot, the pre-#361 behavior.
   */
  getBuiltLotSpaces?: () => number;
  vehicleData?: VehicleData;
  /**
   * Live book-value provider used by the recon-abandon path (#162). Receives
   * the in-progress lot vehicle and returns its current honest book. Omit
   * to fall back to `purchasePrice + reconSpentToDate` (the static stub
   * mirror — same shape as the SalesProcess seam default).
   */
  bookValueFn?: (v: LotVehicle) => number;
  /**
   * Live market-price provider (#273). Sets a freshly-acquired unit's
   * `suggestedRetail` (and thus its default `askingPrice`) to the market
   * suggestion rather than the cost-basis placeholder. Omit to fall back to
   * `purchasePrice + reconEstimate` (the cost-basis stub) — test harnesses that don't
   * wire MarketEconomy keep the cost-basis default. Receives the built
   * `LotVehicle`, which carries every anchor field the provider reads.
   */
  marketPriceFn?: (v: LotVehicle) => number;
  /**
   * Standing auto-pricing policy (#285, Pricing/Demand spine S13). Returns the
   * default `askingPrice` a freshly-acquired unit is stamped with — the close's
   * transaction anchor. The composition root encapsulates the strategy posture
   * AND the automation gate (a UCM on staff): unlocked ⇒ the strategy's
   * book↔market target; locked ⇒ the honest market suggestion. Omit (test
   * harnesses) to fall back to `suggestedRetail` — the pre-S13 behavior where
   * the default ask sits at market.
   */
  pricingPolicyFn?: (v: LotVehicle) => number;
  /**
   * UCM sourcing auto-fill (#293, channel-desk M6). Receives the freshly
   * generated daily auction board and returns the listing ids the used-car desk
   * auto-buys this day. The composition root owns the whole decision — the act
   * gate (top UCM `condition_reading`), the player's sourcing lean, the
   * per-candidate book/demand-fit signals, the cash check, and the M5 drift —
   * so Inventory stays decoupled from StaffOrg/MarketEconomy/DemandShaper. Runs
   * inside `prepareDay` after the board + lot pass, so auto-bought units land on
   * the lot for the upcoming day (arrivalDay = that day, like a manual prep-buy)
   * and start carrying the next day. Omit (test harnesses, no UCM) ⇒ no
   * auto-fill; the player buys the board by hand. Manual `buyFromAuction` always
   * lives (Pillar 5: delegation is permission, not amputation).
   */
  autoSourceFn?: (listings: readonly AuctionListing[]) => readonly string[];
  /**
   * Day-one frontline seed (#296). Returns the opening-lot specs (1 SUV / 1
   * truck / 1 sedan, value-banded, condition-capped) the lot is seeded with at
   * construction — owned at t=0 (no cash debit, no purchase event), recon-complete
   * and frontline-ready (`arrivalDay = frontlineDay = 0`, exempt from the #295
   * acquired-unit hold). The composition root owns the generation (it adapts the
   * live MarketEconomy book/retail providers) so Inventory stays decoupled. Called
   * exactly once, synchronously, during construction. Omit (test harnesses) ⇒ an
   * empty opening lot. On a restore the World is built (and seeded) first, then
   * `restore()` overwrites the lot with the persisted set — the seed is harmless
   * there and the persisted units (the same seed) take over.
   */
  startingInventory?: () => readonly StartingInventorySpec[];
  reconVariance?: ReconVarianceConfig;
  reconSurprises?: ReconSurpriseEventsConfig;
  auctionSourceReliability?: AuctionSourceReliability;
  inventoryConfig?: InventoryConfig;
}

export function createInventory(deps: InventoryDeps): Inventory {
  const { bus, masterSeed, economy } = deps;
  const vehicleData = deps.vehicleData ?? loadVehicleData();
  const reconVariance = deps.reconVariance ?? loadReconVarianceConfig();
  const reconSurprises = deps.reconSurprises ?? loadReconSurpriseEventsConfig();
  const sourceReliability =
    deps.auctionSourceReliability ??
    rollAuctionSourceReliability(masterSeed, loadAuctionSourcesConfig());
  const inventoryConfig = deps.inventoryConfig ?? loadInventoryConfig();
  const getTier = deps.getTier ?? (() => 1);
  // #361: no Facility wired ⇒ no cap. Test harnesses that never build a store
  // keep the pre-cap behavior rather than being silently frozen at zero spaces.
  const getBuiltLotSpaces = deps.getBuiltLotSpaces ?? (() => Number.POSITIVE_INFINITY);
  const bookValueFn =
    deps.bookValueFn ?? ((v: LotVehicle) => v.purchasePrice + v.reconCost);
  const marketPriceFn = deps.marketPriceFn;
  const pricingPolicyFn = deps.pricingPolicyFn;
  const autoSourceFn = deps.autoSourceFn;

  let currentDay = 1;
  let auctionListings: AuctionListing[] = [];
  // Listings the player has paid to inspect (#164). Pulled out of the daily
  // regenerated board on `requestInspection` so they survive the rollover; the
  // pending result resolves the morning of `inspectionAvailableDay`. Re-merged
  // into `getAuctionListings()` so the UI sees one combined board.
  const pendingInspections = new Map<string, AuctionListing>();
  const lotVehicles = new Map<string, LotVehicle>();
  let lastPreparedDay = 0;

  function prepareDay(day: number): void {
    if (day === lastPreparedDay) return;
    lastPreparedDay = day;
    currentDay = day;
    auctionListings = generateAuctionListings(day, masterSeed, vehicleData);
    advanceInspections(day);
    accrueDay(day);
    autoSource();
  }

  /**
   * How full the lot is right now (#361). One rule: **every owned unit takes a
   * space** — recon and the frontline hold are states of a car that is already
   * sitting on your lot, not a place it goes instead. Built spaces are read
   * live, so finished construction reopens buying by itself.
   */
  function lotOccupancy(): LotOccupancy {
    const occupied = lotVehicles.size;
    const built = getBuiltLotSpaces();
    return {
      occupied,
      built,
      spacesOpen: Math.max(0, built - occupied),
      atCapacity: occupied >= built,
    };
  }

  /** What a unit has cost you so far: what you paid plus the recon you sank. */
  function costBasisOf(v: LotVehicle): number {
    return v.purchasePrice + v.reconCost;
  }

  /**
   * Relieve a departing unit's acquisition price out of stock (#374). The one
   * place it happens, called from the only two doors a car leaves by — a retail
   * sale and a wholesale-out — so the P&L charges each unit exactly once, on
   * the day it left.
   *
   * **`purchasePrice` only, never `costBasisOf`.** Recon, inspection and
   * carrying are already expensed as operating spend on the days they were
   * incurred (#255's category boundary says so in as many words); relieving the
   * full cost basis would charge recon to the store twice.
   *
   * A trade-in and a #296 seed unit carry a `purchasePrice` that never cost
   * cash — the allowance is settled inside the deal structure, and opening
   * stock is contributed capital. Both are still relieved: the cost of a car
   * the store sold is what it gave up to have it, whether or not the payment
   * went out through the bank account. That is the same statement `frontGross`
   * has always made.
   */
  function relieveCostOfSale(v: LotVehicle): void {
    economy.postCostOfSale(v.purchasePrice, COST_OF_SALE_LABEL);
  }

  /**
   * What wholesaling this unit would pay and cost (#362). Book value with the
   * `data/`-configured haircut — **not** the asking price. The ask is what you
   * hope a retail customer pays; a wholesale buyer is buying to resell and
   * prices off book, which is exactly why the valve realizes a loss.
   */
  function wholesaleQuote(v: LotVehicle): WholesaleQuote {
    const bookValue = bookValueFn(v);
    const proceeds = Math.max(
      0,
      Math.round(bookValue * (1 - inventoryConfig.wholesale.haircutPct)),
    );
    const costBasis = costBasisOf(v);
    return { vehicleId: v.id, bookValue, proceeds, costBasis, gain: proceeds - costBasis };
  }

  /**
   * The one way a unit leaves the lot to a wholesale buyer (#362). Both doors
   * come through here — the voluntary release valve and the #162 recon abandon
   * — so the money, the removal and the event happen in one order and the event
   * means the same thing whichever door was used. They differ only in what the
   * buyer pays, which is the quote the caller brings.
   */
  function wholesaleOut(
    v: LotVehicle,
    quote: WholesaleQuote,
    reason: 'released' | 'recon_abandoned',
    label: string,
  ): void {
    economy.postRevenue(quote.proceeds, label);
    relieveCostOfSale(v);
    lotVehicles.delete(v.id);
    bus.publish('inventory:vehicle_wholesaled', {
      day: currentDay,
      vehicleId: v.id,
      proceeds: quote.proceeds,
      costBasis: quote.costBasis,
      gain: quote.gain,
      year: v.year,
      make: v.make,
      model: v.model,
      category: v.category,
      reason,
    });
  }

  /**
   * UCM sourcing auto-fill (#293, M6). After the board + lot pass, the used-car
   * desk auto-buys the listings the composition root selected against the
   * player's sourcing lean (gated on `condition_reading`; off-lean drift by
   * skill). Runs on the fresh board only — paid-inspection holds (#164) are the
   * player's deliberate picks and are never auto-bought. Each id came from the
   * current board, so `buyFromAuction` resolves it; bought units get
   * `arrivalDay = currentDay` and start carrying the next day (matching a manual
   * prep-window buy). No-op when no auto-fill is wired or nothing scores in.
   *
   * #361: the desk stops at the lot cap. Each buy occupies its space
   * immediately, so re-reading occupancy inside the loop is what makes "you
   * cannot win six cars into four spaces" true for the auto-buyer as well as
   * for the player. The desk *stops* rather than throwing — a full lot is a
   * normal morning, not a programming error.
   */
  function autoSource(): void {
    if (!autoSourceFn) return;
    const ids = autoSourceFn(auctionListings);
    for (const id of ids) {
      if (lotOccupancy().atCapacity) return;
      buyFromAuctionImpl(id);
    }
  }

  function buyFromAuctionImpl(listingId: string): void {
    const pending = pendingInspections.get(listingId);
    const listing = pending ?? auctionListings.find((l) => l.id === listingId);
    if (!listing) throw new Error(`No auction listing "${listingId}"`);
    if (listing.inspectionStatus === 'pending') {
      throw new Error(
        `Listing "${listingId}" has a pending inspection — purchase blocked until day ${listing.inspectionAvailableDay}`,
      );
    }
    // #361 (A2 R2): the lot cap governs BUYING, checked here at the bid so
    // units already won this pass count against it. A trade is the one thing
    // that lands regardless (`acquireFromTrade`) and is the only way over the
    // cap; while over, this refusal keeps buying frozen until a car goes out.
    const occupancy = lotOccupancy();
    if (occupancy.atCapacity) {
      throw new Error(
        `No space on the lot for "${listingId}" — ${occupancy.occupied} of ${occupancy.built} spaces taken`,
      );
    }

    // Categorized as stock acquisition (#255): the Home cash delta breaks
    // this out as "into stock" instead of coloring a deliberate buy as a
    // loss. Inspection/recon/carrying stay uncategorized (operating spend).
    economy.postExpense(
      listing.askingPrice,
      `Auction purchase: ${listing.id}`,
      'inventoryAcquisition',
    );

    const reliability = sourceReliability.reliability[listing.sourceId] ?? 0.5;
    const lotVehicle = buildAcquiredVehicle({
      id: listing.id,
      templateId: listing.templateId,
      brand: listing.brand,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      trim: listing.trim,
      mileage: listing.mileage,
      condition: listing.condition,
      conditionReport: listing.conditionReport,
      purchasePrice: listing.askingPrice,
      category: listing.category,
      reconEstimate: listing.reconCost,
      sourceReliability: reliability,
    });
    lotVehicles.set(lotVehicle.id, lotVehicle);
    auctionListings = auctionListings.filter((l) => l.id !== listingId);
    pendingInspections.delete(listingId);

    bus.publish('inventory:vehicle_purchased', {
      day: currentDay,
      vehicleId: lotVehicle.id,
      cost: listing.askingPrice,
      templateId: lotVehicle.templateId,
      brand: lotVehicle.brand,
      make: lotVehicle.make,
      year: lotVehicle.year,
      mileage: lotVehicle.mileage,
      condition: lotVehicle.condition,
      category: lotVehicle.category,
      reconCost: lotVehicle.reconEstimate,
    });
  }

  /**
   * Daily lot pass (#173): age each unit, advance its recon, then accrue one
   * day of floorplan + carrying cost. The per-vehicle burn is summed and posted
   * as a single aggregate Economy expense, and `economy:carrying_cost_posted`
   * fires for KPI/UI consumption. `forceDebit` (not `postExpense`) because
   * carrying cost is a non-discretionary accrual that legitimately pushes cash
   * negative — that descent is exactly what BankruptcyMonitor watches for.
   * Driven through `prepareDay`'s once-per-day guard, so it is idempotent.
   */
  function accrueDay(day: number): void {
    const carrying = inventoryConfig.carrying;
    const apr = floorplanAprForTier(carrying, getTier());
    let totalCarry = 0;
    let unitCount = 0;
    for (const [id, v] of lotVehicles) {
      const daysInInventory = day - v.arrivalDay;
      const advanced = advanceRecon({ ...v, daysInInventory }, day);
      const dailyCarry = computeDailyCarryingCost({
        bookValue: bookValueFn(advanced),
        apr,
        reconComplete: advanced.reconStatus === 'complete',
        config: carrying,
      });
      lotVehicles.set(id, {
        ...advanced,
        carryingCostToDate: advanced.carryingCostToDate + dailyCarry,
        dailyCarryingCost: dailyCarry,
        aged: daysInInventory > carrying.agedThresholdDays,
      });
      totalCarry += dailyCarry;
      unitCount += 1;
    }
    if (totalCarry > 0) {
      economy.forceDebit(
        totalCarry,
        `Floorplan & carrying cost (Day ${day}, ${unitCount} unit${unitCount === 1 ? '' : 's'})`,
      );
    }
    bus.publish('economy:carrying_cost_posted', {
      day,
      totalCost: totalCarry,
      vehicleCount: unitCount,
    });
  }

  function rollListingRealizedRecon(listing: AuctionListing): number {
    const reliability =
      sourceReliability.reliability[listing.sourceId] ?? 0.5;
    return rollRecon(
      {
        estimate: listing.reconCost,
        condition: listing.condition,
        mileage: listing.mileage,
        sourceReliability: reliability,
      },
      deriveReconSeed(masterSeed, listing.id),
      reconVariance,
    ).realizedCost;
  }

  /**
   * Build a freshly-acquired lot vehicle and roll its hidden realized recon
   * (#162). Shared by the auction-buy and trade-acquisition paths (#171): the
   * only axis that differs is `sourceReliability` — the auction source's hidden
   * reliability for a buy, the staff condition-read confidence for a trade — and
   * both feed the same recon-variance gate. `reconEstimate` is the player's
   * budget (auction listing's `reconCost`, or the condition-tier baseline for a
   * trade); `purchasePrice` is the cost basis.
   */
  function buildAcquiredVehicle(args: {
    id: string;
    templateId: string;
    brand: string;
    year: number;
    make: string;
    model: string;
    trim: string;
    mileage: number;
    condition: AuctionListing['condition'];
    conditionReport: string;
    purchasePrice: number;
    category: AuctionListing['category'];
    reconEstimate: number;
    sourceReliability: number;
  }): LotVehicle {
    const reconRoll = rollRecon(
      {
        estimate: args.reconEstimate,
        condition: args.condition,
        mileage: args.mileage,
        sourceReliability: args.sourceReliability,
      },
      deriveReconSeed(masterSeed, args.id),
      reconVariance,
    );
    const reconDaysTotal =
      reconVariance.reconDaysByCondition[args.condition] ?? 5;
    // Cost-basis placeholder (#120). When a live market provider is wired
    // (#273) the suggested retail — and thus the default asking price, now the
    // close's transaction anchor — comes from the market suggestion instead.
    const costBasis = args.purchasePrice + args.reconEstimate;
    const vehicle: LotVehicle = {
      id: args.id,
      templateId: args.templateId,
      brand: args.brand,
      year: args.year,
      make: args.make,
      model: args.model,
      trim: args.trim,
      mileage: args.mileage,
      condition: args.condition,
      conditionReport: args.conditionReport,
      purchasePrice: args.purchasePrice,
      reconCost: 0,
      category: args.category,
      arrivalDay: currentDay,
      // #295: acquired units (auction buy + customer trade) are held off the
      // walk-in pool for the frontline-prep window. Auction and trade behave
      // identically here — both stamp the same hold from arrival.
      frontlineDay: currentDay + inventoryConfig.frontlineHoldDays,
      daysInInventory: 0,
      carryingCostToDate: 0,
      dailyCarryingCost: 0,
      aged: false,
      suggestedRetail: costBasis,
      askingPrice: costBasis,
      reconStatus: 'in_progress',
      reconEstimate: args.reconEstimate,
      reconRealizedCost: reconRoll.realizedCost,
      reconDaysRemaining: reconDaysTotal,
      reconDaysTotal,
      reconBucket: reconRoll.bucket,
    };
    if (!marketPriceFn) return vehicle;
    const suggestedRetail = Math.max(0, Math.round(marketPriceFn(vehicle)));
    // #285: the standing auto-pricing policy stamps the default ask. When a
    // pricing policy is wired (UCM on staff → strategy auto-prices intake) the
    // default ask follows the policy target; otherwise it sits at the market
    // suggestion (suggestion-only — the toggle just drives the pricing screen).
    const askingPrice = pricingPolicyFn
      ? Math.max(0, Math.round(pricingPolicyFn({ ...vehicle, suggestedRetail })))
      : suggestedRetail;
    return { ...vehicle, suggestedRetail, askingPrice };
  }

  /**
   * Build a recon-complete opening-stock unit from a seed spec (#296). Unlike
   * `buildAcquiredVehicle` this rolls no hidden recon and posts no money: seed
   * units are already-owned stock, recon-complete on arrival (no hidden-lemon
   * tail in the starter set) and frontline-ready at open
   * (`arrivalDay = frontlineDay = 0`, exempt from the #295 acquired-unit hold).
   * The default ask sits at the live market retail the generator resolved (no
   * UCM on staff at game start ⇒ suggestion-only, like any intake).
   */
  function buildSeedVehicle(spec: StartingInventorySpec): LotVehicle {
    const reconDaysTotal =
      reconVariance.reconDaysByCondition[spec.condition] ?? 5;
    return {
      id: spec.id,
      templateId: spec.templateId,
      brand: spec.brand,
      year: spec.year,
      make: spec.make,
      model: spec.model,
      trim: spec.trim,
      mileage: spec.mileage,
      condition: spec.condition,
      conditionReport: spec.conditionReport,
      purchasePrice: spec.purchasePrice,
      // Recon is complete, so the full estimate is the sunk total.
      reconCost: spec.reconEstimate,
      category: spec.category,
      arrivalDay: 0,
      frontlineDay: 0,
      daysInInventory: 0,
      carryingCostToDate: 0,
      dailyCarryingCost: 0,
      aged: false,
      suggestedRetail: spec.suggestedRetail,
      askingPrice: spec.suggestedRetail,
      reconStatus: 'complete',
      reconEstimate: spec.reconEstimate,
      reconRealizedCost: spec.reconEstimate,
      reconDaysRemaining: 0,
      reconDaysTotal,
      reconBucket: 'within',
    };
  }

  /**
   * Materialize a customer's accepted trade-in onto the lot (#171). Cost basis
   * is the agreed allowance and NO Economy expense is posted — the allowance is
   * already offset against the deal cash in the close structure (#169). The
   * recon estimate is the condition-tier baseline (the same budget an auction
   * unit of that condition shows); the staff condition-read confidence drives
   * the realized-recon spread, so an unread trade hides lemons.
   */
  function acquireFromTrade(acquisition: TradeAcquisitionInput): LotVehicle {
    const { customerId, currentVehicle, agreedAllowance, staffConfidence } =
      acquisition;
    const tier = vehicleData.conditionTiers[currentVehicle.condition];
    const lotVehicle = buildAcquiredVehicle({
      id: `trade-day${currentDay}-${customerId}`,
      templateId: currentVehicle.templateId,
      brand: currentVehicle.brand,
      year: currentVehicle.year,
      make: currentVehicle.make,
      model: currentVehicle.model,
      // CurrentVehicle carries no trim — the dealer reconditions/relists it.
      trim: '',
      mileage: currentVehicle.mileage,
      condition: currentVehicle.condition,
      conditionReport: tier.report,
      purchasePrice: agreedAllowance,
      category: currentVehicle.category,
      // #286: the condition tier's fraction of the unit's value, like any other
      // acquisition. The value the trade lane holds at this point is the
      // allowance we just agreed to — the appraised worth of the car, arrived at
      // by the same appraisal that set the condition.
      reconEstimate: reconEstimateFor(agreedAllowance, tier.reconPct),
      sourceReliability: staffConfidence,
    });
    lotVehicles.set(lotVehicle.id, lotVehicle);

    bus.publish('inventory:vehicle_acquired_via_trade', {
      day: currentDay,
      vehicleId: lotVehicle.id,
      customerId,
      allowance: agreedAllowance,
      templateId: lotVehicle.templateId,
      brand: lotVehicle.brand,
      make: lotVehicle.make,
      year: lotVehicle.year,
      mileage: lotVehicle.mileage,
      condition: lotVehicle.condition,
      category: lotVehicle.category,
      reconCost: lotVehicle.reconEstimate,
    });
    return lotVehicle;
  }

  function advanceInspections(day: number): void {
    for (const [id, listing] of pendingInspections) {
      if (
        listing.inspectionStatus === 'pending' &&
        listing.inspectionAvailableDay !== undefined &&
        day >= listing.inspectionAvailableDay
      ) {
        const realized = rollListingRealizedRecon(listing);
        const halfWidth = realized * inventoryConfig.inspection.halfWidthFraction;
        const reconLow = Math.max(0, Math.round(realized - halfWidth));
        const reconHigh = Math.max(reconLow, Math.round(realized + halfWidth));
        pendingInspections.set(id, {
          ...listing,
          inspectionStatus: 'completed',
          inspectionResult: { reconLow, reconHigh },
        });
        continue;
      }
      // Completed listings expire one day after they were made available.
      if (
        listing.inspectionStatus === 'completed' &&
        listing.inspectionAvailableDay !== undefined &&
        day > listing.inspectionAvailableDay
      ) {
        pendingInspections.delete(id);
      }
    }
  }

  function advanceRecon(v: LotVehicle, day: number): LotVehicle {
    if (v.reconStatus !== 'in_progress') return v;

    // Daily spend amortizes the realized total over the configured day count.
    const perDaySpend =
      v.reconDaysTotal > 0 ? v.reconRealizedCost / v.reconDaysTotal : v.reconRealizedCost;
    const remainingShortfall = v.reconRealizedCost - v.reconCost;
    const spendThisDay = Math.min(remainingShortfall, perDaySpend);
    if (spendThisDay <= 0) {
      // Already fully amortized — e.g. a surprise pause landed exactly on the
      // realized total and the player then authorized the (now zero) remaining
      // spend. Completion must always notify, so emit recon_completed here too
      // rather than transition to 'complete' silently.
      bus.publish('inventory:recon_completed', {
        day,
        vehicleId: v.id,
        realizedCost: v.reconRealizedCost,
        estimate: v.reconEstimate,
        bucket: v.reconBucket,
      });
      return {
        ...v,
        reconCost: v.reconRealizedCost,
        reconStatus: 'complete',
        reconDaysRemaining: 0,
      };
    }

    const newSpent = v.reconCost + spendThisDay;
    economy.postExpense(
      Math.round(spendThisDay),
      `Recon: ${v.year} ${v.make} ${v.model} (${v.id})`,
    );

    const surpriseTriggerCost = v.reconEstimate * reconVariance.surpriseThreshold;
    const crossedThreshold =
      v.reconBucket !== 'within' &&
      v.reconCost < surpriseTriggerCost &&
      newSpent >= surpriseTriggerCost;

    let updated: LotVehicle = {
      ...v,
      reconCost: Math.round(newSpent),
      reconDaysRemaining: Math.max(0, v.reconDaysRemaining - 1),
    };

    if (crossedThreshold) {
      const tmpl = pickSurpriseTemplate(
        v.reconBucket,
        deriveReconSurpriseSeed(masterSeed, v.id),
        reconSurprises,
      );
      updated = { ...updated, reconStatus: 'paused_for_decision' };
      bus.publish('inventory:recon_surprise', {
        day,
        vehicleId: v.id,
        templateId: tmpl?.id ?? 'unknown',
        reason: tmpl?.reason ?? 'Recon costs exceed estimate.',
        estimate: v.reconEstimate,
        revisedTotal: v.reconRealizedCost,
        spentToDate: updated.reconCost,
        bucket: v.reconBucket,
      });
      return updated;
    }

    if (updated.reconCost >= v.reconRealizedCost) {
      updated = {
        ...updated,
        reconCost: v.reconRealizedCost,
        reconStatus: 'complete',
        reconDaysRemaining: 0,
      };
      bus.publish('inventory:recon_completed', {
        day,
        vehicleId: v.id,
        realizedCost: v.reconRealizedCost,
        estimate: v.reconEstimate,
        bucket: v.reconBucket,
      });
    }
    return updated;
  }

  // #296: seed the opening lot once, synchronously at construction. These are
  // already-owned opening stock — no cash debit and no `inventory:vehicle_purchased`
  // emit (which would record a bogus wholesale comp / cash delta). The demand
  // influence reads the lot pull-based downstream, so no event is needed. On a
  // restore the World is built (and seeded) first, then `restore()` clears + reloads
  // the persisted lot — this seed is replaced there.
  if (deps.startingInventory) {
    for (const spec of deps.startingInventory()) {
      const vehicle = buildSeedVehicle(spec);
      lotVehicles.set(vehicle.id, vehicle);
    }
  }

  bus.subscribe('clock:managerial_prep', ({ upcomingDay }) => {
    prepareDay(upcomingDay);
  });
  bus.subscribe('clock:day_started', ({ day }) => {
    prepareDay(day);
  });
  // #171: an accepted/countered trade resolves → the trade vehicle enters the
  // lot. `trade:resolved` only fires for `accept`/`counter` (declines and
  // underwater abandons never emit it), so every event here is an acquisition.
  bus.subscribe('trade:resolved', (e) => {
    acquireFromTrade({
      customerId: e.customerId,
      currentVehicle: e.currentVehicle,
      agreedAllowance: e.agreedAllowance,
      staffConfidence: e.staffConfidence,
    });
  });

  return {
    getAuctionListings() {
      if (pendingInspections.size === 0) return auctionListings;
      return [...auctionListings, ...pendingInspections.values()];
    },

    getLotVehicles() {
      return [...lotVehicles.values()];
    },

    getLotVehicle(vehicleId) {
      return lotVehicles.get(vehicleId);
    },

    getLotOccupancy: lotOccupancy,

    getWholesaleQuote(vehicleId) {
      const v = lotVehicles.get(vehicleId);
      return v ? wholesaleQuote(v) : undefined;
    },

    wholesaleVehicle(vehicleId) {
      const v = lotVehicles.get(vehicleId);
      if (!v) throw new Error(`No lot vehicle "${vehicleId}"`);
      // No gate on recon status or the frontline hold: those describe a car
      // that is already on your lot burning money, and the valve exists
      // precisely for the units you regret. One rule.
      const quote = wholesaleQuote(v);
      wholesaleOut(
        v,
        quote,
        'released',
        `Wholesaled: ${v.year} ${v.make} ${v.model}`,
      );
      return quote;
    },

    buyFromAuction(listingId) {
      buyFromAuctionImpl(listingId);
    },

    sellVehicle(vehicleId, salePrice) {
      const vehicle = lotVehicles.get(vehicleId);
      if (!vehicle) throw new Error(`No lot vehicle "${vehicleId}"`);
      relieveCostOfSale(vehicle);
      lotVehicles.delete(vehicleId);
      bus.publish('inventory:vehicle_sold', {
        day: currentDay,
        vehicleId,
        salePrice: salePrice ?? vehicle.askingPrice,
        templateId: vehicle.templateId,
        brand: vehicle.brand,
        make: vehicle.make,
        year: vehicle.year,
        mileage: vehicle.mileage,
        condition: vehicle.condition,
        category: vehicle.category,
        purchasePrice: vehicle.purchasePrice,
        reconCost: vehicle.reconCost,
        powertrain: DEFAULT_POWERTRAIN,
      });
      return vehicle;
    },

    acquireFromTrade,

    setAskingPrice(vehicleId, askingPrice) {
      const vehicle = lotVehicles.get(vehicleId);
      if (!vehicle) return;
      lotVehicles.set(vehicleId, {
        ...vehicle,
        askingPrice: Math.max(0, Math.round(askingPrice)),
      });
    },

    authorizeReconSpend(vehicleId) {
      const v = lotVehicles.get(vehicleId);
      if (!v || v.reconStatus !== 'paused_for_decision') return;
      // Re-amortize the remaining shortfall across the original day count's
      // tail. If reconDaysRemaining hit 0, give it one more day so the spend
      // resolves cleanly.
      const daysRemaining = Math.max(1, v.reconDaysRemaining);
      lotVehicles.set(vehicleId, {
        ...v,
        reconStatus: 'in_progress',
        reconDaysRemaining: daysRemaining,
      });
    },

    requestInspection(listingId) {
      if (pendingInspections.has(listingId)) return;
      const idx = auctionListings.findIndex((l) => l.id === listingId);
      if (idx === -1) throw new Error(`No auction listing "${listingId}"`);
      const listing = auctionListings[idx];

      economy.postExpense(
        inventoryConfig.inspection.cost,
        `Inspection: ${listing.id}`,
      );

      const availableDay =
        currentDay + inventoryConfig.inspection.daysToComplete;
      const updated: AuctionListing = {
        ...listing,
        inspectionStatus: 'pending',
        inspectionAvailableDay: availableDay,
      };
      auctionListings = auctionListings.filter((_, i) => i !== idx);
      pendingInspections.set(listingId, updated);
    },

    snapshot() {
      return {
        schemaVersion: 1,
        currentDay,
        lastPreparedDay,
        auctionListings: [...auctionListings],
        pendingInspections: [...pendingInspections.values()],
        lotVehicles: [...lotVehicles.values()],
      };
    },

    restore(snap) {
      currentDay = snap.currentDay;
      lastPreparedDay = snap.lastPreparedDay;
      auctionListings = [...snap.auctionListings];
      pendingInspections.clear();
      for (const listing of snap.pendingInspections) {
        pendingInspections.set(listing.id, listing);
      }
      lotVehicles.clear();
      for (const vehicle of snap.lotVehicles) {
        // #295 migration: pre-frontline-hold saves carry no `frontlineDay`.
        // Those units were already sellable, so default to `arrivalDay` (no
        // retroactive hold) rather than leaving it undefined (which the
        // StaffDispatch `<=` filter would read as permanently held).
        lotVehicles.set(vehicle.id, {
          ...vehicle,
          frontlineDay: vehicle.frontlineDay ?? vehicle.arrivalDay,
        });
      }
    },

    abandonRecon(vehicleId) {
      const v = lotVehicles.get(vehicleId);
      if (!v || v.reconStatus !== 'paused_for_decision') return;
      // AC: wholesale at current book − reconCostToDate. The loss vs. cost
      // basis lands naturally via revenue post: book−sunk in, purchase+sunk
      // out, net P/L = book − purchase − 2·sunk. The double-count reflects
      // that the abandon path means the unit is unretailable as-is and the
      // wholesale buyer prices in the unfinished recon.
      const book = bookValueFn(v);
      const proceeds = Math.max(0, Math.round(book - v.reconCost));
      // #362: the abandon path publishes `inventory:vehicle_wholesaled` like
      // the voluntary valve does, NOT `inventory:vehicle_sold`. It never was a
      // retail sale — MarketEconomy was recording a wholesale dump as a retail
      // comp and dragging the segment's price index down with it. The price
      // rule below stays #162's (a car with its guts on the floor is worth less
      // than a finished one); only which event it is stops being a lie.
      const costBasis = costBasisOf(v);
      wholesaleOut(
        v,
        { vehicleId: v.id, bookValue: book, proceeds, costBasis, gain: proceeds - costBasis },
        'recon_abandoned',
        `Wholesale dump (recon abandoned): ${v.year} ${v.make} ${v.model}`,
      );
    },
  };
}
