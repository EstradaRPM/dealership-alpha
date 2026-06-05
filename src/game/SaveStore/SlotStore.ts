import { createSaveStore } from './SaveStore';
import type {
  DriverFactory,
  MidDayCheckpoint,
  MultiSlotSaveStore,
  SaveState,
  SlotMetadata,
  StorageDriver,
} from './types';

const DEFAULT_MAX_SLOTS = 3;
const INDEX_KEY = 'index';

interface SlotIndex {
  v: 1;
  seq: number;
  activeSlotId: string | null;
  slots: SlotMetadata[];
}

const EMPTY_INDEX: SlotIndex = { v: 1, seq: 0, activeSlotId: null, slots: [] };

function slotKey(id: string): string {
  return `slot:${id}`;
}

// Checkpoint lives in its own isolated cell, separate from the slot's main
// save blob, so a mid-day checkpoint never collides with a full save and is
// independent across slots (each id → its own driver cell).
function checkpointKey(id: string): string {
  return `checkpoint:${id}`;
}

export interface MultiSlotOptions {
  maxSlots?: number;
  /** Injectable clock for deterministic lastPlayed timestamps in tests. */
  now?: () => string;
}

export function createMultiSlotSaveStore(
  driverFactory: DriverFactory,
  options: MultiSlotOptions = {},
): MultiSlotSaveStore {
  const maxSlots = options.maxSlots ?? DEFAULT_MAX_SLOTS;
  const now = options.now ?? (() => new Date().toISOString());
  const indexDriver: StorageDriver = driverFactory(INDEX_KEY);

  async function readIndex(): Promise<SlotIndex> {
    const raw = await indexDriver.read();
    if (raw === null) return { ...EMPTY_INDEX, slots: [] };
    return JSON.parse(raw) as SlotIndex;
  }

  async function writeIndex(index: SlotIndex): Promise<void> {
    await indexDriver.write(JSON.stringify(index));
  }

  return {
    async createSlot(name) {
      const index = await readIndex();
      if (index.slots.length >= maxSlots) {
        throw new Error(`Cannot create slot: max of ${maxSlots} slots reached`);
      }
      const seq = index.seq + 1;
      const meta: SlotMetadata = {
        id: `slot-${seq}`,
        name,
        day: 0,
        tier: 1,
        lastPlayed: now(),
      };
      const next: SlotIndex = {
        v: 1,
        seq,
        // First slot created becomes active by default.
        activeSlotId: index.activeSlotId ?? meta.id,
        slots: [...index.slots, meta],
      };
      await writeIndex(next);
      return meta;
    },

    async listSlots() {
      const index = await readIndex();
      return index.slots;
    },

    async selectSlot(id) {
      const index = await readIndex();
      if (!index.slots.some((s) => s.id === id)) {
        throw new Error(`Cannot select unknown slot: ${id}`);
      }
      await writeIndex({ ...index, activeSlotId: id });
    },

    async getActiveSlotId() {
      const index = await readIndex();
      return index.activeSlotId;
    },

    async deleteSlot(id) {
      const index = await readIndex();
      if (!index.slots.some((s) => s.id === id)) return;
      // Wipe only this slot's blob + checkpoint — other slots use
      // independent drivers, so siblings are untouched.
      await createSaveStore(driverFactory(slotKey(id))).clear();
      await driverFactory(checkpointKey(id)).clear();
      const slots = index.slots.filter((s) => s.id !== id);
      await writeIndex({
        ...index,
        slots,
        activeSlotId: index.activeSlotId === id ? null : index.activeSlotId,
      });
    },

    async save(state: SaveState, meta: { day: number; tier: number }) {
      const index = await readIndex();
      const activeId = index.activeSlotId;
      if (activeId === null) {
        throw new Error('Cannot save: no active slot selected');
      }
      const slot = index.slots.find((s) => s.id === activeId);
      if (!slot) {
        throw new Error(`Active slot ${activeId} no longer exists`);
      }
      await createSaveStore(driverFactory(slotKey(activeId))).save(state);
      const updated: SlotMetadata = {
        ...slot,
        day: meta.day,
        tier: meta.tier,
        lastPlayed: now(),
      };
      await writeIndex({
        ...index,
        slots: index.slots.map((s) => (s.id === activeId ? updated : s)),
      });
    },

    async load() {
      const index = await readIndex();
      if (index.activeSlotId === null) return null;
      return createSaveStore(driverFactory(slotKey(index.activeSlotId))).load();
    },

    async writeCheckpoint(checkpoint: MidDayCheckpoint) {
      const index = await readIndex();
      if (index.activeSlotId === null) {
        throw new Error('Cannot write checkpoint: no active slot selected');
      }
      await driverFactory(checkpointKey(index.activeSlotId)).write(
        JSON.stringify(checkpoint),
      );
    },

    async readCheckpoint() {
      const index = await readIndex();
      if (index.activeSlotId === null) return null;
      const raw = await driverFactory(
        checkpointKey(index.activeSlotId),
      ).read();
      return raw === null ? null : (JSON.parse(raw) as MidDayCheckpoint);
    },

    async clearCheckpoint() {
      const index = await readIndex();
      if (index.activeSlotId === null) return;
      await driverFactory(checkpointKey(index.activeSlotId)).clear();
    },
  };
}
