import { atom, computed } from 'nanostores';
import type { User } from '@supabase/supabase-js';

export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline' | 'error';

// Current authenticated user (null while logged out)
export const currentUser = atom<User | null>(null);

// Sync status for UI indicators
export const syncStatus = atom<SyncStatus>('idle');

// Whether Supabase is configured (credentials in .env)
export const syncEnabled = atom<boolean>(false);

// Whether the sync service has completed the initial pull
export const syncReady = atom<boolean>(false);

export const isLoggedIn = computed(currentUser, (u) => u !== null);

/** Set the current user */
export function setCurrentUser(user: User | null): void {
  currentUser.set(user);
}

/** Update sync status */
export function setSyncStatus(status: SyncStatus): void {
  syncStatus.set(status);
}

/** Mark sync as enabled/disabled */
export function setSyncEnabled(enabled: boolean): void {
  syncEnabled.set(enabled);
}

/** Mark initial sync complete */
export function setSyncReady(ready: boolean): void {
  syncReady.set(ready);
}