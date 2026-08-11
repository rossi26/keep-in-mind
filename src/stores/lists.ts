import { persistentAtom } from '@nanostores/persistent';
import { computed } from 'nanostores';
import type { List } from '../types';
import { seedLists } from '../lib/seed';
import { generateId } from '../lib/utils';
import { tasks } from './tasks';

// Helper to parse JSON with fallback
function parseLists(value: string): List[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyLists(lists: List[]): string {
  return JSON.stringify(lists);
}

export const lists = persistentAtom<List[]>('kmm-lists', seedLists, {
  encode: stringifyLists,
  decode: parseLists,
});

export const sortedLists = computed(lists, ($lists) =>
  [...$lists].sort((a, b) => a.order - b.order)
);

/** Get a list by ID */
export function getListById(id: string): List | undefined {
  return lists.get().find((l) => l.id === id);
}

/** Create a new list */
export function createList(name: string, color: string, icon: string): List {
  const current = lists.get();
  const newList: List = {
    id: generateId(),
    name,
    color,
    icon,
    order: current.length,
  };
  lists.set([...current, newList]);
  return newList;
}

/** Rename a list */
export function renameList(id: string, name: string): void {
  lists.set(
    lists.get().map((l) => (l.id === id ? { ...l, name } : l))
  );
}

/** Update list appearance (color/icon) */
export function updateListAppearance(
  id: string,
  patch: Partial<Pick<List, 'color' | 'icon'>>
): void {
  lists.set(
    lists.get().map((l) => (l.id === id ? { ...l, ...patch } : l))
  );
}

/** Delete a list and its tasks */
export function deleteList(id: string): void {
  lists.set(lists.get().filter((l) => l.id !== id));
  // Also remove tasks belonging to the deleted list
  tasks.set(tasks.get().filter((t) => t.listId !== id));
}

/** Reorder lists */
export function reorderLists(orderedIds: string[]): void {
  const current = lists.get();
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  lists.set(
    [...current]
      .map((l) => {
        const order = orderMap.get(l.id);
        return order !== undefined ? { ...l, order } : l;
      })
      .sort((a, b) => a.order - b.order)
  );
}