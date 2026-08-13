import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabase';
import { tasks } from '../stores/tasks';
import { lists } from '../stores/lists';
import {
  deletedTaskIds,
  deletedListIds,
  clearTaskDeleted,
  clearListDeleted,
  isTaskDeleted,
  isListDeleted,
} from '../stores/tombstones';
import {
  currentUser,
  setSyncStatus,
  setSyncEnabled,
  setSyncReady,
  setCurrentUser,
} from '../stores/sync';
import type { Task, List } from '../types';

// ---------------------------------------------------------------------------
// Metadata store for sync versions (clientId -> updatedAt)
// Kept separate from task/list data so existing types don't change.
// ---------------------------------------------------------------------------
type SyncMeta = Record<string, string>; // clientId -> ISO timestamp

const META_KEY = 'kmm-sync-meta';

function loadMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let meta: SyncMeta = loadMeta();

function saveMeta(): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // storage full/unavailable — ignore
  }
}

function bumpMeta(clientId: string): string {
  const now = new Date().toISOString();
  meta[clientId] = now;
  saveMeta();
  return now;
}

function getMeta(clientId: string): string | undefined {
  return meta[clientId];
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------
// True while we're applying remote changes to local stores (to avoid echo push)
let applyingRemote = false;

// True while a push batch is in flight (avoid re-entrant pushes from subscribe)
let pushing = false;

// Pending local operations offline (applied to remote after reconnect)
type PendingOp =
  | { type: 'upsert-task'; task: Task; updatedAt: string }
  | { type: 'delete-task'; id: string }
  | { type: 'upsert-list'; list: List; updatedAt: string }
  | { type: 'delete-list'; id: string };

const QUEUE_KEY = 'kmm-sync-queue';
let pendingQueue: PendingOp[] = [];

// Track previous local ids so we can detect deletions and propagate them remotely
let lastTaskIds = new Set<string>();
let lastListIds = new Set<string>();

function loadQueue(): void {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    pendingQueue = raw ? JSON.parse(raw) : [];
  } catch {
    pendingQueue = [];
  }
}

function persistQueue(): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(pendingQueue));
  } catch {
    // ignore
  }
}

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

function setOnline(online: boolean): void {
  isOnline = online;
  setSyncStatus(online ? 'online' : 'offline');
  if (online) {
    // Flush pending ops and pull remote changes
    void flushQueue();
    void pullAll();
  }
}

// ---------------------------------------------------------------------------
// Mapping: local types <-> Supabase rows
// ---------------------------------------------------------------------------
interface TaskRow {
  id: string;
  user_id: string;
  client_id: string;
  list_client_id: string;
  title: string;
  notes: string | null;
  status: 'todo' | 'done' | 'later';
  due_date: string | null;
  is_recurring: boolean;
  recurring_interval: 'daily' | 'weekly' | 'monthly' | null;
  boomerang_days: number | null;
  boomerang_hours: number | null;
  subtasks: unknown;
  completed_dates: unknown;
  position: number;
  updated_at: string;
  created_at: string;
}

interface ListRow {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  updated_at: string;
  created_at: string;
}

function taskToRow(task: Task, userId: string, updatedAt: string): Record<string, unknown> {
  return {
    user_id: userId,
    client_id: task.id,
    list_client_id: task.listId,
    title: task.title,
    notes: task.notes ?? '',
    status: task.status,
    due_date: task.dueDate,
    is_recurring: task.isRecurring,
    recurring_interval: task.recurringInterval,
    boomerang_days: task.boomerangDays,
    boomerang_hours: task.boomerangHours ?? null,
    subtasks: task.subtasks,
    completed_dates: task.completedDates ?? [],
    position: task.order,
    updated_at: updatedAt,
  };
}

function listToRow(list: List, userId: string, updatedAt: string): Record<string, unknown> {
  return {
    user_id: userId,
    client_id: list.id,
    name: list.name,
    color: list.color,
    icon: list.icon,
    position: list.order,
    updated_at: updatedAt,
  };
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.client_id,
    title: row.title,
    notes: row.notes ?? '',
    listId: row.list_client_id,
    status: row.status,
    dueDate: row.due_date,
    isRecurring: row.is_recurring,
    recurringInterval: row.recurring_interval,
    boomerangDays: row.boomerang_days,
    boomerangHours: row.boomerang_hours ?? null,
    subtasks: Array.isArray(row.subtasks) ? (row.subtasks as Task['subtasks']) : [],
    createdAt: row.created_at,
    order: row.position,
    completedDates: Array.isArray(row.completed_dates)
      ? (row.completed_dates as string[])
      : [],
  };
}

function rowToList(row: ListRow): List {
  return {
    id: row.client_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    order: row.position,
  };
}

// ---------------------------------------------------------------------------
// Auth handling
// ---------------------------------------------------------------------------
async function setupAuth(): Promise<void> {
  if (!supabase) return;

  try {
    // Get current session (restore persisted login)
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setCurrentUser(data.session.user);
      // Set up realtime immediately for restored sessions
      setupRealtime();
    }
  } catch (err) {
    console.error('[sync] getSession failed:', err);
    // Continue without session — app runs local-only
    setSyncReady(true);
    setSyncStatus('error');
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    setCurrentUser(session?.user ?? null);
    if (session?.user) {
      void pullAll();
      setupRealtime();
    } else {
      // Logged out: clear sync state, keep local data cached
      if (supabase && realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
        realtimeChannelUserId = null;
      }
      setSyncReady(false);
      setSyncStatus('idle');
    }
  });
}

// ---------------------------------------------------------------------------
// Remote operations
// ---------------------------------------------------------------------------
async function pullAll(): Promise<void> {
  if (!supabase || applyingRemote || !currentUser.get()) {
    console.log('[sync] pullAll skipped:', { supabase: !!supabase, applyingRemote, user: !!currentUser.get() });
    return;
  }

  const userId = currentUser.get()!.id;
  console.log('[sync] pullAll starting for user:', userId);
  setSyncStatus('syncing');
  setSyncReady(false);

  try {
    // Pull lists
    const { data: listRows, error: listsErr } = await supabase
      .from('lists')
      .select('*')
      .eq('user_id', userId);

    if (listsErr) throw listsErr;

    // Pull tasks
    const { data: taskRows, error: tasksErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (tasksErr) throw tasksErr;

    console.log('[sync] pullAll data received:', { lists: listRows?.length, tasks: taskRows?.length });

    applyingRemote = true;

    const remoteLists: List[] = (listRows ?? []).map((row) =>
      rowToList(row as ListRow)
    );
    const remoteTasks: Task[] = (taskRows ?? []).map((row) =>
      rowToTask(row as TaskRow)
    );

    // Merge strategy (Last-Write-Wins):
    // For each remote record, compare updatedAt with local meta.
    // If remote is newer or no local meta exists, apply remote.
    // Local-only records (not in remote) are kept and will be pushed on next sync.

    const localTasks = tasks.get();
    const localLists = lists.get();

    // --- Lists merge ---
    const localListMap = new Map(localLists.map((l) => [l.id, l]));
    const remoteListMap = new Map(remoteLists.map((l) => [l.id, l]));

    const mergedLists: List[] = [];
    const remoteListRowsById = new Map(
      (listRows ?? []).map((row) => [(row as ListRow).client_id, row as ListRow])
    );
    for (const remoteList of remoteLists) {
      const row = remoteListRowsById.get(remoteList.id);
      const rowUpdatedAt = row?.updated_at ?? '';
      const localList = localListMap.get(remoteList.id);
      const localMeta = getMeta(remoteList.id) ?? '';

      // Local record exists and local meta >= server updated_at → keep local
      if (localList && localMeta && rowUpdatedAt && localMeta >= rowUpdatedAt) {
        mergedLists.push(localList);
      } else {
        // Remote is newer, or no local record, or no local meta → apply remote
        mergedLists.push(remoteList);
      }
    }
    // Add local-only lists (not on remote yet)
    for (const localList of localLists) {
      if (!remoteListMap.has(localList.id)) {
        mergedLists.push(localList);
      }
    }
    mergedLists.sort((a, b) => a.order - b.order);
    lists.set(mergedLists);

    // --- Tasks merge ---
    const localTaskMap = new Map(localTasks.map((t) => [t.id, t]));
    const remoteTaskMap = new Map(remoteTasks.map((t) => [t.id, t]));

    const mergedTasks: Task[] = [];
    const remoteTaskRowsById = new Map(
      (taskRows ?? []).map((row) => [(row as TaskRow).client_id, row as TaskRow])
    );
    for (const remoteTask of remoteTasks) {
      const row = remoteTaskRowsById.get(remoteTask.id);
      const rowUpdatedAt = row?.updated_at ?? '';
      const localTask = localTaskMap.get(remoteTask.id);
      const localMeta = getMeta(remoteTask.id) ?? '';

      // Local record exists and local meta >= server updated_at → keep local
      if (localTask && localMeta && rowUpdatedAt && localMeta >= rowUpdatedAt) {
        mergedTasks.push(localTask);
      } else {
        // Remote is newer, or no local record, or no local meta → apply remote
        mergedTasks.push(remoteTask);
      }
    }
    for (const localTask of localTasks) {
      if (!remoteTaskMap.has(localTask.id)) {
        mergedTasks.push(localTask);
      }
    }
    mergedTasks.sort((a, b) => a.order - b.order);
    tasks.set(mergedTasks);

    // Update meta for all remote records to their server updated_at
    for (const row of listRows ?? []) {
      const r = row as ListRow;
      meta[r.client_id] = r.updated_at;
    }
    for (const row of taskRows ?? []) {
      const r = row as TaskRow;
      meta[r.client_id] = r.updated_at;
    }
    saveMeta();

    // Propagate deletions recorded locally while offline / not signed in
    const listTombstones = deletedListIds.get();
    for (const id of listTombstones) {
      await supabase.from('lists').delete().eq('client_id', id).eq('user_id', userId);
      clearListDeleted(id);
    }
    const taskTombstones = deletedTaskIds.get();
    for (const id of taskTombstones) {
      await supabase.from('tasks').delete().eq('client_id', id).eq('user_id', userId);
      clearTaskDeleted(id);
    }

    setSyncStatus('online');
    setSyncReady(true);
  } catch (err) {
    console.error('[sync] pullAll failed:', err);
    setSyncStatus(isOnline ? 'error' : 'offline');
    setSyncReady(true);
  } finally {
    applyingRemote = false;
  }
}

// ---------------------------------------------------------------------------
// Offline queue
// ---------------------------------------------------------------------------
async function flushQueue(): Promise<void> {
  if (!supabase || pendingQueue.length === 0 || !currentUser.get()) return;
  if (pushing) return;

  pushing = true;
  setSyncStatus('syncing');

  const userId = currentUser.get()!.id;
  const ops = [...pendingQueue];
  pendingQueue = [];
  persistQueue();

  try {
    for (const op of ops) {
      if (op.type === 'upsert-task') {
        await supabase.from('tasks').upsert(
          { ...taskToRow(op.task, userId, op.updatedAt), id: undefined },
          { onConflict: 'client_id' }
        );
      } else if (op.type === 'delete-task') {
        await supabase.from('tasks').delete().eq('client_id', op.id).eq('user_id', userId);
        clearTaskDeleted(op.id);
      } else if (op.type === 'upsert-list') {
        await supabase.from('lists').upsert(
          { ...listToRow(op.list, userId, op.updatedAt), id: undefined },
          { onConflict: 'client_id' }
        );
      } else if (op.type === 'delete-list') {
        await supabase.from('lists').delete().eq('client_id', op.id).eq('user_id', userId);
        clearListDeleted(op.id);
      }
    }
    setSyncStatus(isOnline ? 'online' : 'offline');
  } catch (err) {
    console.error('[sync] flushQueue failed:', err);
    // Re-queue failed ops and mark error
    pendingQueue = [...ops, ...pendingQueue];
    persistQueue();
    setSyncStatus('error');
  } finally {
    pushing = false;
  }
}

// ---------------------------------------------------------------------------
// Push local changes to remote
// ---------------------------------------------------------------------------
// Helper: log detailed Supabase error info (message + code + details)
function logSupabaseError(context: string, err: unknown): void {
  const e = err as { message?: string; code?: string; details?: string; hint?: string };
  console.error(`[sync] ${context}:`, {
    message: e?.message ?? String(err),
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  });
}

async function pushTasks(): Promise<void> {
  console.log('[sync] pushTasks called');
  if (!supabase || pushing || applyingRemote || !currentUser.get()) {
    console.log('[sync] pushTasks skipped:', { supabase: !!supabase, pushing, applyingRemote, user: !!currentUser.get() });
    return;
  }
  const userId = currentUser.get()!.id;

  const batch = tasks.get();
  if (batch.length === 0) return;

  pushing = true;
  setSyncStatus('syncing');

  try {
    // Use a single timestamp for the entire batch to avoid clock skew issues
    // with realtime subscriptions comparing local meta vs server updated_at
    const batchUpdatedAt = new Date().toISOString();
    
    for (const task of batch) {
      meta[task.id] = batchUpdatedAt;
      const { error } = await supabase.from('tasks').upsert(
        { ...taskToRow(task, userId, batchUpdatedAt), id: undefined },
        { onConflict: 'client_id' }
      );
      if (error) throw error;
    }
    saveMeta();
    setSyncStatus(isOnline ? 'online' : 'offline');
  } catch (err) {
    logSupabaseError('pushTasks failed', err);
    if (!isOnline) {
      setSyncStatus('offline');
    } else {
      setSyncStatus('error');
    }
  } finally {
    pushing = false;
  }
}

async function pushLists(): Promise<void> {
  if (!supabase || pushing || applyingRemote || !currentUser.get()) return;
  const userId = currentUser.get()!.id;

  const batch = lists.get();
  if (batch.length === 0) return;

  pushing = true;
  setSyncStatus('syncing');

  try {
    const batchUpdatedAt = new Date().toISOString();
    
    for (const list of batch) {
      meta[list.id] = batchUpdatedAt;
      const { error } = await supabase.from('lists').upsert(
        { ...listToRow(list, userId, batchUpdatedAt), id: undefined },
        { onConflict: 'client_id' }
      );
      if (error) throw error;
    }
    saveMeta();
    setSyncStatus(isOnline ? 'online' : 'offline');
  } catch (err) {
    logSupabaseError('pushLists failed', err);
    if (!isOnline) {
      setSyncStatus('offline');
    } else {
      setSyncStatus('error');
    }
  } finally {
    pushing = false;
  }
}

// ---------------------------------------------------------------------------
// Realtime subscriptions
// ---------------------------------------------------------------------------
interface RealtimePayload {
  eventType: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

let realtimeChannel: RealtimeChannel | null = null;

// Track which user the realtime channel is subscribed for
// (different users need different channels; same user must reuse one channel)
let realtimeChannelUserId: string | null = null;

function setupRealtime(): void {
  if (!supabase || !currentUser.get()) return;
  const userId = currentUser.get()!.id;

  // If we already have a channel for this user, don't create a second one
  if (realtimeChannel && realtimeChannelUserId === userId) return;

  // Remove any pre-existing channel (e.g. after logout/login with different user)
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeChannelUserId = null;
  }

  // Use channel with filter on user_id (RLS restricts anyway)
  const channel = supabase
    .channel(`kmm-realtime-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
      (payload) => {
        console.log('[sync] realtime task change:', payload.eventType);
        void handleRemoteChange('tasks', payload as unknown as RealtimePayload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lists', filter: `user_id=eq.${userId}` },
      (payload) => {
        console.log('[sync] realtime list change:', payload.eventType);
        void handleRemoteChange('lists', payload as unknown as RealtimePayload);
      }
    )
    .subscribe((status) => {
      console.log('[sync] realtime channel status:', status);
      if (status === 'CHANNEL_ERROR') {
        setSyncStatus('error');
      }
    });

  realtimeChannel = channel;
  realtimeChannelUserId = userId;
}

async function handleRemoteChange(
  table: 'tasks' | 'lists',
  payload: RealtimePayload
): Promise<void> {
  console.log('[sync] handleRemoteChange:', table, payload.eventType);
  if (!supabase || applyingRemote || !currentUser.get()) return;

  if (payload.eventType === 'DELETE') {
    const oldRow = payload.old as { client_id?: string };
    if (!oldRow?.client_id) return;
    applyingRemote = true;
    try {
      if (table === 'tasks') {
        tasks.set(tasks.get().filter((t) => t.id !== oldRow.client_id));
        clearTaskDeleted(oldRow.client_id);
      } else {
        lists.set(lists.get().filter((l) => l.id !== oldRow.client_id));
        clearListDeleted(oldRow.client_id);
      }
    } finally {
      applyingRemote = false;
    }
    return;
  }

  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    const newRow = payload.new as unknown as TaskRow;
    if (!newRow?.client_id) return;
    const clientId = newRow.client_id;

    // The row as a typed record (build with the same shape)
    const rowUpdatedAt = typeof newRow.updated_at === 'string' ? newRow.updated_at : '';

    // If this change came from this same device (we just pushed), skip
    // (our meta is already >= this updated_at)
    // Use a small epsilon to handle clock skew between client and server
    const localMeta = getMeta(clientId) ?? '';
    if (localMeta && rowUpdatedAt && localMeta >= rowUpdatedAt) return;
    // Also skip if this is a local-only change (no remote user)
    if (!currentUser.get()) return;

    applyingRemote = true;
    try {
      if (table === 'tasks') {
        const task = rowToTask(newRow);
        // Update or insert in local store
        const current = tasks.get();
        const idx = current.findIndex((t) => t.id === task.id);
        const localUpdated = getMeta(task.id) ?? '';
        // Apply remote if: no local version, or remote is newer than local meta
        if (!localUpdated || rowUpdatedAt > localUpdated) {
          if (idx >= 0) {
            const next = [...current];
            next[idx] = task;
            tasks.set(next.sort((a, b) => a.order - b.order));
          } else {
            tasks.set([...current, task].sort((a, b) => a.order - b.order));
          }
        }
      } else {
        const list = rowToList(newRow as unknown as ListRow);
        const current = lists.get();
        const idx = current.findIndex((l) => l.id === list.id);
        const localUpdated = getMeta(list.id) ?? '';
        if (!localUpdated || rowUpdatedAt > localUpdated) {
          if (idx >= 0) {
            const next = [...current];
            next[idx] = list;
            lists.set(next.sort((a, b) => a.order - b.order));
          } else {
            lists.set([...current, list].sort((a, b) => a.order - b.order));
          }
        }
      }
      // Update meta
      meta[clientId] = rowUpdatedAt;
      saveMeta();
    } finally {
      applyingRemote = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Local store subscriptions (react to local changes)
// ---------------------------------------------------------------------------
function setupLocalSubscriptions(): void {
  // Baseline for deletion tracking (before first subscription callback)
  lastTaskIds = new Set(tasks.get().map((t) => t.id));
  lastListIds = new Set(lists.get().map((l) => l.id));

  // Subscribe to tasks store changes
  tasks.subscribe(() => {
    const currentIds = new Set(tasks.get().map((t) => t.id));

    // When applying remote changes (or no user), just update tracking baseline
    if (applyingRemote || !currentUser.get()) {
      lastTaskIds = currentIds;
      return;
    }

    // Detect local deletions and queue delete ops for the remote
    const removed = Array.from(lastTaskIds).filter((id) => !currentIds.has(id));
    lastTaskIds = currentIds;
    if (removed.length > 0) {
      // Drop any queued upsert for these ids (they no longer exist locally)
      pendingQueue = [
        ...pendingQueue.filter((op) => {
          if (op.type === 'upsert-task' && removed.includes(op.task.id)) return false;
          return true;
        }),
        ...removed.map((id) => ({ type: 'delete-task' as const, id })),
      ];
      persistQueue();
      // If online, flush the deletes right away (offline: flushed on reconnect)
      if (isOnline) {
        void flushQueue();
      }
    }

    if (!isOnline) {
      // Offline: queue the full current state (simplified: queue full batch)
      pendingQueue = [
        ...pendingQueue.filter((op) => op.type !== 'upsert-task'),
        ...tasks.get().map((t) => ({
          type: 'upsert-task' as const,
          task: t,
          updatedAt: new Date().toISOString(),
        })),
      ];
      persistQueue();
      setSyncStatus('offline');
      return;
    }

    // Debounce push to avoid many rapid writes (e.g., drag reorder)
    if (pushDebounce) clearTimeout(pushDebounce);
    pushDebounce = setTimeout(() => {
      void pushTasks();
    }, 800);
  });

  // Subscribe to lists store changes
  lists.subscribe(() => {
    const currentIds = new Set(lists.get().map((l) => l.id));

    // When applying remote changes (or no user), just update tracking baseline
    if (applyingRemote || !currentUser.get()) {
      lastListIds = currentIds;
      return;
    }

    // Detect local deletions and queue delete ops for the remote
    const removed = Array.from(lastListIds).filter((id) => !currentIds.has(id));
    lastListIds = currentIds;
    if (removed.length > 0) {
      // Drop any queued upsert for these ids (they no longer exist locally)
      pendingQueue = [
        ...pendingQueue.filter((op) => {
          if (op.type === 'upsert-list' && removed.includes(op.list.id)) return false;
          return true;
        }),
        ...removed.map((id) => ({ type: 'delete-list' as const, id })),
      ];
      persistQueue();
      // If online, flush the deletes right away (offline: flushed on reconnect)
      if (isOnline) {
        void flushQueue();
      }
    }

    if (!isOnline) {
      pendingQueue = [
        ...pendingQueue.filter((op) => op.type !== 'upsert-list'),
        ...lists.get().map((l) => ({
          type: 'upsert-list' as const,
          list: l,
          updatedAt: new Date().toISOString(),
        })),
      ];
      persistQueue();
      setSyncStatus('offline');
      return;
    }

    if (pushDebounceLists) clearTimeout(pushDebounceLists);
    pushDebounceLists = setTimeout(() => {
      void pushLists();
    }, 800);
  });
}

let pushDebounce: ReturnType<typeof setTimeout> | null = null;
let pushDebounceLists: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
/** Sign out the current user (local data is preserved). */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
    // The auth state change listener will clear currentUser,
    // remove the realtime channel, and reset sync status.
  } catch (err) {
    console.error('[sync] signOut failed:', err);
    throw new Error('Failed to sign out');
  }
}

export function initSync(): void {
  console.log('[sync] initSync called, isConfigured:', isConfigured);
  loadQueue();
  setSyncEnabled(isConfigured);

  if (!isConfigured || !supabase) {
    console.log('[sync] initSync skipped: not configured or no supabase client');
    // No Supabase configured — app runs fully local
    setSyncStatus('idle');
    setSyncReady(true);
    return;
  }

  // Browser-only
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    setOnline(navigator.onLine);
  }

  void setupAuth().then(() => {
    console.log('[sync] setupAuth complete, user:', currentUser.get()?.id);
    // Subscribe to local stores only after auth setup so we don't push
    // while not logged in (sync is no-op when no user anyway)
    setupLocalSubscriptions();
  });
}
