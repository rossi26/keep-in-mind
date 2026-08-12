import type { List, Task } from '../types';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export const seedLists: List[] = [
  {
    id: 'list-personal',
    name: 'Personal',
    color: '#01696f',
    icon: 'user',
    order: 0,
  },
  {
    id: 'list-work',
    name: 'Work',
    color: '#4f46e5',
    icon: 'briefcase',
    order: 1,
  },
  {
    id: 'list-shopping',
    name: 'Shopping',
    color: '#ea580c',
    icon: 'shopping-bag',
    order: 2,
  },
];

export const seedTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Buy groceries for the week',
    notes: 'Milk, eggs, bread, and some veggies',
    listId: 'list-shopping',
    status: 'todo',
    dueDate: isoDaysFromNow(2),
    isRecurring: true,
    recurringInterval: 'weekly',
    boomerangDays: 2,
    boomerangHours: null,
    subtasks: [
      { id: 'sub-1-1', title: 'Milk', done: false, order: 0 },
      { id: 'sub-1-2', title: 'Eggs', done: false, order: 1 },
      { id: 'sub-1-3', title: 'Bread', done: true, order: 2 },
    ],
    createdAt: isoDaysFromNow(-7),
    order: 0,
    completedDates: [isoDaysFromNow(-5).slice(0, 10)],
  },
  {
    id: 'task-2',
    title: 'Prepare project presentation',
    notes: 'Slides for the quarterly review',
    listId: 'list-work',
    status: 'todo',
    dueDate: isoDaysFromNow(1),
    isRecurring: false,
    recurringInterval: null,
    boomerangDays: null,
    boomerangHours: null,
    subtasks: [],
    createdAt: isoDaysFromNow(-3),
    order: 1,
  },
  {
    id: 'task-3',
    title: 'Call mom',
    notes: '',
    listId: 'list-personal',
    status: 'later',
    dueDate: isoDaysFromNow(5),
    isRecurring: false,
    recurringInterval: null,
    boomerangDays: 3,
    boomerangHours: null,
    subtasks: [
      { id: 'sub-3-1', title: 'Talk about weekend plans', done: false, order: 0 },
    ],
    createdAt: isoDaysFromNow(-2),
    order: 2,
  },
  {
    id: 'task-4',
    title: 'Update resume',
    notes: 'Add recent project experience',
    listId: 'list-work',
    status: 'todo',
    dueDate: isoDaysFromNow(-1),
    isRecurring: false,
    recurringInterval: null,
    boomerangDays: 2,
    boomerangHours: null,
    subtasks: [],
    createdAt: isoDaysFromNow(-10),
    order: 3,
  },
  {
    id: 'task-5',
    title: 'Water the plants',
    notes: '',
    listId: 'list-personal',
    status: 'todo',
    dueDate: isoDaysFromNow(0),
    isRecurring: true,
    recurringInterval: 'daily',
    boomerangDays: null,
    boomerangHours: null,
    subtasks: [
      { id: 'sub-5-1', title: 'Living room', done: true, order: 0 },
      { id: 'sub-5-2', title: 'Bedroom', done: true, order: 1 },
    ],
    createdAt: isoDaysFromNow(-1),
    order: 4,
    completedDates: [isoDaysFromNow(-1).slice(0, 10)],
  },
  {
    id: 'task-6',
    title: 'Read 20 pages of book',
    notes: 'Currently reading "Atomic Habits"',
    listId: 'list-personal',
    status: 'done',
    dueDate: isoDaysFromNow(-2),
    isRecurring: false,
    recurringInterval: null,
    boomerangDays: null,
    boomerangHours: null,
    subtasks: [
      { id: 'sub-6-1', title: 'Chapter 5', done: true, order: 0 },
      { id: 'sub-6-2', title: 'Chapter 6', done: false, order: 1 },
    ],
    createdAt: isoDaysFromNow(-4),
    order: 5,
  },
];