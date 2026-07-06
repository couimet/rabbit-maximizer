import type { QueueItem } from '../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Type guard for UUID v4 strings. */
export const isValidUuid = (value: unknown): value is string => typeof value === 'string' && UUID_REGEX.test(value);

/**
 * Resolves an array of UUIDs to their corresponding numeric database IDs.
 * UUIDs that don't match any item in the list are silently dropped —
 * callers that need to surface missing UUIDs should validate upstream.
 */
export const resolveUuidsToIds = (items: QueueItem[], uuids: string[]): number[] => {
  const uuidToId = new Map(items.map((item) => [item.uuid, item.id]));
  return uuids.map((uuid) => uuidToId.get(uuid)).filter((id): id is number => id !== undefined);
};

/**
 * Finds a QueueItem by its UUID. Returns undefined when no item matches.
 */
export const findByUuid = (items: QueueItem[], uuid: string): QueueItem | undefined => items.find((item) => item.uuid === uuid);
