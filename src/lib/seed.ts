import type { List, Task } from '../types';

// Simple seed data for first-time users
// Only one list to start clean, no tasks to let user begin fresh
export const seedLists: List[] = [
  {
    id: 'list-personal',
    name: 'Personal',
    color: '#01696f',
    icon: 'user',
    order: 0,
  },
];

// No seed tasks — user starts with a clean slate
export const seedTasks: Task[] = [];