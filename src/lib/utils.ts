import type { Task, Subtask } from '../types';

/** Generate a unique ID */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Get today's date at start of day as an ISO string */
export function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Format a date using the user's browser locale */
export function formatDate(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Format a date with the year included */
export function formatDateFull(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Format a relative date like "Today", "Tomorrow", "Yesterday", or a short date */
export function formatRelativeDate(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
  }
  return formatDateFull(isoString);
}

/** Check if a task's due date is in the past */
export function isPastDue(isoString: string | null): boolean {
  if (!isoString) return false;
  const due = new Date(isoString);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Calculate days between a date and today */
export function daysFromToday(isoString: string): number {
  const date = new Date(isoString);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Get subtask completion count */
export function getSubtaskProgress(task: Task): { completed: number; total: number } {
  const total = task.subtasks.length;
  const completed = task.subtasks.filter((s) => s.done).length;
  return { completed, total };
}

/** Get subtask completion percentage */
export function getSubtaskPercentage(task: Task): number {
  const { completed, total } = getSubtaskProgress(task);
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/** Create a subtask */
export function createSubtask(title: string, order: number): Subtask {
  return {
    id: generateId(),
    title,
    done: false,
    order,
  };
}

/** Create a new task factory */
export function createTask(partial: Partial<Task>): Task {
  return {
    id: generateId(),
    title: partial.title ?? '',
    notes: partial.notes ?? '',
    listId: partial.listId ?? '',
    status: partial.status ?? 'todo',
    dueDate: partial.dueDate ?? null,
    isRecurring: partial.isRecurring ?? false,
    recurringInterval: partial.recurringInterval ?? null,
    boomerangDays: partial.boomerangDays ?? null,
    subtasks: partial.subtasks ?? [],
    createdAt: partial.createdAt ?? new Date().toISOString(),
    order: partial.order ?? 0,
  };
}

/** Parse a date input value (YYYY-MM-DD) into an ISO string at local midnight */
export function dateInputToISO(dateStr: string | null): string | null {
  if (!dateStr) return null;
  // dateStr is like "2025-05-08"
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toISOString();
}

/** Format an ISO string to a date input value (YYYY-MM-DD) */
export function isoToDateInput(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Escape HTML for safety */
export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Start of day (local) for a Date */
export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Compare two dates by calendar day */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** Monday of the week containing the given date */
export function startOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/** 7 days starting from the given date (Monday-first) */
export function getWeekDays(start: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Local date key YYYY-MM-DD for lookups */
export function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get all occurrence dates for a recurring task within a given range.
 * Returns an array of Date objects (start-of-day) where the task recurs.
 *
 * Rules:
 *  - Future occurrences start from the due date (or today if the due date
 *    is in the past) and expand forward through the range.
 *  - Past occurrences are only included if they are in the task's
 *    completedDates (so completed occurrences remain visible as "done").
 *  - Uncompleted past occurrences are excluded (they are not shown).
 *
 * If the task is not recurring or has no dueDate, returns an empty array.
 */
export function getRecurringOccurrences(
  task: Task,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (!task.isRecurring || !task.recurringInterval || !task.dueDate) {
    return [];
  }

  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const due = startOfDay(new Date(task.dueDate));
  const today = startOfDay(new Date());

  // The earliest occurrence to consider: the due date, but never before today
  // (past uncompleted occurrences are not shown).
  const earliest = due.getTime() > today.getTime() ? due : today;

  // If the range is entirely before the earliest occurrence, no occurrences
  if (end.getTime() < earliest.getTime()) return [];

  const completedSet = new Set(task.completedDates ?? []);
  const occurrences: Date[] = [];
  const interval = task.recurringInterval;

  if (interval === 'daily') {
    // Every day from earliest onward
    const cursor = new Date(earliest);
    while (cursor.getTime() <= end.getTime()) {
      const key = toDateKey(cursor);
      // Include if within range AND (future OR completed)
      if (cursor.getTime() >= start.getTime() && (cursor.getTime() >= today.getTime() || completedSet.has(key))) {
        occurrences.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (interval === 'weekly') {
    // Every 7 days from earliest onward
    const cursor = new Date(earliest);
    while (cursor.getTime() <= end.getTime()) {
      const key = toDateKey(cursor);
      if (cursor.getTime() >= start.getTime() && (cursor.getTime() >= today.getTime() || completedSet.has(key))) {
        occurrences.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  } else if (interval === 'monthly') {
    // Same day-of-month each month from earliest onward
    const cursor = new Date(earliest);
    const dayOfMonth = earliest.getDate();
    while (cursor.getTime() <= end.getTime()) {
      const key = toDateKey(cursor);
      if (cursor.getTime() >= start.getTime() && (cursor.getTime() >= today.getTime() || completedSet.has(key))) {
        occurrences.push(new Date(cursor));
      }
      // Move to next month, clamping day-of-month
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1; // next month
      const lastDay = new Date(year, month + 1, 0).getDate();
      const nextDay = Math.min(dayOfMonth, lastDay);
      cursor.setFullYear(year, month, nextDay);
      cursor.setHours(0, 0, 0, 0);
    }
  }

  return occurrences;
}

/**
 * Get the next non-completed occurrence date (YYYY-MM-DD) of a recurring task,
 * searching from today forward within the given horizon (default 365 days).
 * Returns null if the task is not recurring, has no dueDate, or all upcoming
 * occurrences within the horizon are completed.
 */
export function getNextOccurrenceDate(
  task: Task,
  horizonDays = 365
): string | null {
  if (!task.isRecurring || !task.dueDate) return null;

  const today = startOfDay(new Date());
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + horizonDays);

  const occurrences = getRecurringOccurrences(task, today, horizon);
  const completed = new Set(task.completedDates ?? []);
  const next = occurrences.find((d) => !completed.has(toDateKey(d)));
  return next ? toDateKey(next) : null;
}
