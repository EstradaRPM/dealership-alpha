import type { Economy } from '../Economy';
import { JOB_CATEGORIES } from '../InstalledBase';
import {
  loadServiceMarketingConfig,
  type ServiceMarketingConfig,
} from './serviceMarketingConfig';
import type {
  ConquestBias,
  ConquestSelection,
  ServiceMarketing,
  ServiceMarketingSnapshot,
} from './types';

const NONE = 'none';

function isJobCategory(value: string): value is (typeof JOB_CATEGORIES)[number] {
  return (JOB_CATEGORIES as readonly string[]).includes(value);
}

export interface ServiceMarketingDeps {
  /** The money ledger — each active arm debits its daily cost here. Only
   *  `forceDebit` is needed: a recurring marketing spend posts even on a low
   *  balance (mirrors rent/payroll) rather than throwing mid-day. */
  economy: Pick<Economy, 'forceDebit'>;
  config?: ServiceMarketingConfig;
}

/**
 * ServiceMarketing (#307, parent #297) — the two service-marketing arms,
 * distinct from sales advertising. Holds the player's lever selections and turns
 * them into the influence reads the composition root wires into InstalledBase
 * (retention → return roll) and ServiceDemand (conquest → volume + mix skew),
 * while debiting each active arm's daily cost from Economy. Adds no randomness of
 * its own: the demand/return effects flow through already-seeded math, so a fixed
 * seed replays identically (#122).
 */
export function createServiceMarketing(deps: ServiceMarketingDeps): ServiceMarketing {
  const config = deps.config ?? loadServiceMarketingConfig();
  const campaignById = new Map(config.retentionCampaigns.map((c) => [c.id, c]));

  let retentionId = NONE;
  let conquestCategory: ConquestSelection = NONE;

  return {
    retentionCampaigns: config.retentionCampaigns.map((c) => ({
      id: c.id,
      label: c.label,
      blurb: c.blurb,
    })),

    getRetentionCampaign() {
      return retentionId;
    },
    setRetentionCampaign(id) {
      if (id !== NONE && !campaignById.has(id)) {
        throw new Error(`Unknown retention campaign '${id}'`);
      }
      retentionId = id;
    },
    retentionLift() {
      const campaign = campaignById.get(retentionId);
      return campaign ? campaign.returnLift : 0;
    },

    getConquestSpecial() {
      return conquestCategory;
    },
    setConquestSpecial(category) {
      if (category !== NONE && !isJobCategory(category)) {
        throw new Error(`Unknown conquest category '${category}'`);
      }
      conquestCategory = category;
    },
    conquestVolumeInfluence() {
      return conquestCategory === NONE ? 0 : config.conquestSpecial.volumeBoost;
    },
    conquestBias(): ConquestBias | null {
      if (conquestCategory === NONE) return null;
      return { category: conquestCategory, strength: config.conquestSpecial.categoryBias };
    },

    advanceDay(_day) {
      const retention = campaignById.get(retentionId);
      if (retention && retention.dailyCost > 0) {
        deps.economy.forceDebit(
          retention.dailyCost,
          `Service marketing: retention (${retention.id})`,
        );
      }
      if (conquestCategory !== NONE && config.conquestSpecial.dailyCost > 0) {
        deps.economy.forceDebit(
          config.conquestSpecial.dailyCost,
          `Service marketing: conquest (${conquestCategory})`,
        );
      }
    },

    snapshot() {
      return {
        schemaVersion: 1,
        retentionCampaignId: retentionId,
        conquestCategory,
      };
    },
    restore(snap) {
      // Defensive: a campaign or category that no longer exists in data falls
      // back to 'none' rather than restoring a dangling selection.
      retentionId =
        snap.retentionCampaignId !== NONE && campaignById.has(snap.retentionCampaignId)
          ? snap.retentionCampaignId
          : NONE;
      conquestCategory =
        snap.conquestCategory !== NONE && isJobCategory(snap.conquestCategory)
          ? snap.conquestCategory
          : NONE;
    },
  };
}
