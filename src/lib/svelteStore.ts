import type { Readable } from 'svelte/store';

/**
 * Converts a nanostore (which follows the Svelte store contract)
 * into a properly-typed Svelte-readable store.
 */
export function store<T>(nanostore: { subscribe: (fn: (value: T) => void) => () => void }): Readable<T> {
  return {
    subscribe(run: (value: T) => void): () => void {
      return nanostore.subscribe((value) => run(value));
    },
  };
}