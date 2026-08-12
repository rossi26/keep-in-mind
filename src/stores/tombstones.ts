import { persistentAtom } from '@nanostores/persistent';

// Tombstones record ids that were deleted locally, persisted across sessions.
// They are used to propagate deletions to the remote (Supabase) even when
// the user is offline / not signed in at deletion time.
//
// Once the remote has confirmed a deletion (DELETE event received), the id is
// removed from the tombstone list.

const TASKS_KEY = 'kmm-deleted-tasks';
const LISTS_KEY = 'kmm-deleted-lists';

function parse(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function stringify(ids: string[]): string {
  return JSON.stringify(ids);
}

export const deletedTaskIds = persistentAtom<string[]>(TASKS_KEY, [], {
  encode: stringify,
  decode: parse,
});

export const deletedListIds = persistentAtom<string[]>(LISTS_KEY, [], {
  encode: stringify,
  decode: parse,
});

/** Mark a task as deleted (tombstone). */
export function markTaskDeleted(id: string): void {
  const current = deletedTaskIds.get();
  if (!current.includes(id)) {
    deletedTaskIds.set([...current, id]);
  }
}

/** Mark a list as deleted (tombstone). */
export function markListDeleted(id: string): void {
  const current = deletedListIds.get();
  if (!current.includes(id)) {
    deletedListIds.set([...current, id]);
  }
}

/** Remove a task id from the tombstone list (remote confirmed deletion). */
export function clearTaskDeleted(id: string): void {
  deletedTaskIds.set(deletedTaskIds.get().filter((x) => x !== id));
}

/** Remove a list id from the tombstone list (remote confirmed deletion). */
export function clearListDeleted(id: string): void {
  deletedListIds.set(deletedListIds.get().filter((x) => x !== id));
}

/** Check if a task id is tombstoned. */
export function isTaskDeleted(id: string): boolean {
  return deletedTaskIds.get().includes(id);
}

/** Check if a list id is tombstoned. */
export function isListDeleted(id: string): boolean {
  return deletedListIds.get().includes(id);
}