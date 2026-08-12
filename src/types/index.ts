export type TaskStatus = 'todo' | 'done' | 'later';

export type RecurringInterval = 'daily' | 'weekly' | 'monthly' | null;

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  order: number;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  listId: string;
  status: TaskStatus;
  dueDate: string | null; // ISO format (may include time)
  isRecurring: boolean;
  recurringInterval: RecurringInterval;
  boomerangDays: number | null;
  /** Reschedule to today after N days overdue (in addition to boomerangDays) */
  boomerangHours?: number | null;
  subtasks: Subtask[];
  createdAt: string; // ISO format
  order: number;
  /** Dates (YYYY-MM-DD) of completed recurring occurrences */
  completedDates?: string[];
}

export interface List {
  id: string;
  name: string;
  color: string; // hex
  icon: string; // lucide icon name
  order: number;
}

export type View = 'lists' | 'calendar' | 'board' | 'combined';

export type TaskSheetMode = 'create' | 'edit';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error';
}