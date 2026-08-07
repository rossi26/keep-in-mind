import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type { View, TaskSheetMode, ToastMessage, Task } from '../types';

// Current view (navigation)
export const currentView = atom<View>('lists');

// Active list id (when viewing tasks inside a list)
export const activeListId = atom<string | null>(null);

// Task sheet visibility
export const taskSheetOpen = atom<boolean>(false);
export const taskSheetMode = atom<TaskSheetMode>('create');
export const taskSheetTask = atom<Task | null>(null);

// Toast notifications
export const toasts = atom<ToastMessage[]>([]);

// Dark mode
export const darkMode = atom<boolean>(
  typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark') ||
        localStorage.getItem('dark-mode') === 'true'
    : false
);

// Settings modal visibility
export const settingsOpen = atom<boolean>(false);

// Auth modal visibility
export const authModalOpen = atom<boolean>(false);

// Global default boomerang days (used as the default when creating a task)
export const defaultBoomerangDays = persistentAtom<number>('kmm-boomerang-default', 3, {
  encode: (v) => String(v),
  decode: (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 3;
  },
});

/** Open the settings modal */
export function openSettings(): void {
  settingsOpen.set(true);
}

/** Open the auth modal */
export function openAuthModal(): void {
  authModalOpen.set(true);
}

/** Close the auth modal */
export function closeAuthModal(): void {
  authModalOpen.set(false);
}

/** Close the settings modal */
export function closeSettings(): void {
  settingsOpen.set(false);
}

darkMode.subscribe((isDark) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('dark-mode', String(isDark));
});

// Derived helper
export const isTaskSheetOpen = computed(taskSheetOpen, (open) => open);

/** Add a toast notification */
export function addToast(text: string, type: ToastMessage['type'] = 'info'): void {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: ToastMessage = { id, text, type };
  toasts.set([...toasts.get(), toast]);

  // Auto-remove after 4s
  setTimeout(() => {
    toasts.set(toasts.get().filter((t) => t.id !== id));
  }, 4000);
}

/** Remove a toast */
export function removeToast(id: string): void {
  toasts.set(toasts.get().filter((t) => t.id !== id));
}

/** Open task sheet in create mode */
export function openCreateSheet(): void {
  taskSheetMode.set('create');
  taskSheetTask.set(null);
  taskSheetOpen.set(true);
}

/** Open task sheet in edit mode */
export function openEditSheet(task: Task): void {
  taskSheetMode.set('edit');
  taskSheetTask.set(task);
  taskSheetOpen.set(true);
}

/** Close the task sheet */
export function closeTaskSheet(): void {
  taskSheetOpen.set(false);
  taskSheetTask.set(null);
}

/** Set the current view and clear active list when switching to non-lists views */
export function setView(view: View): void {
  currentView.set(view);
  if (view === 'lists') {
    activeListId.set(null);
  } else {
    activeListId.set(null);
  }
}