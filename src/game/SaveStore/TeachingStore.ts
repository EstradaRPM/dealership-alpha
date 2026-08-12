import type { StorageDriver, TeachingStore } from './types';

/**
 * One slot's teaching progress (issue 386): the set of hint ids this player has
 * retired by actually using the control the hint sits under.
 *
 * It is a bare id list on purpose. The registry that says what a hint *says*,
 * and which control it belongs to, is `data/hints.json`; this cell only records
 * which ids are done. A hint deleted from the catalog leaves a harmless orphan
 * id here rather than a dangling copy of retired text.
 */
interface TeachingBank {
  v: 1;
  taught: string[];
}

/**
 * A corrupt or half-written cell reads as "nothing taught yet" rather than
 * throwing. Every hint then draws again — the failure mode of a *teaching*
 * surface must be showing the player too much, never crashing the career it is
 * attached to.
 */
async function readBank(driver: StorageDriver): Promise<string[]> {
  const raw = await driver.read();
  if (raw === null) return [];
  try {
    const bank = JSON.parse(raw) as TeachingBank;
    return Array.isArray(bank.taught) ? bank.taught : [];
  } catch {
    return [];
  }
}

async function writeBank(driver: StorageDriver, taught: string[]): Promise<void> {
  const bank: TeachingBank = { v: 1, taught };
  await driver.write(JSON.stringify(bank));
}

export function createTeachingStore(driver: StorageDriver): TeachingStore {
  return {
    async markTaught(id: string) {
      const taught = await readBank(driver);
      // Marking an already-taught id is a no-op, not a duplicate entry: the
      // player can keep using a control long after its hint retired.
      if (taught.includes(id)) return;
      await writeBank(driver, [...taught, id]);
    },

    async listTaught() {
      return readBank(driver);
    },

    async resetAll() {
      await writeBank(driver, []);
    },

    async clear() {
      await driver.clear();
    },
  };
}
