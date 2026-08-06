<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { tasks } from '../stores/tasks';
  import { sortedLists } from '../stores/lists';
  import type { Task, TaskStatus } from '../types';
  import {
    isSameDay,
    startOfWeek,
    startOfDay,
    toDateKey,
    getNextOccurrenceDate,
  } from '../lib/utils';
  import TaskCard from './TaskCard.svelte';
  import Icon from './Icon.svelte';

  const tasksStore = store(tasks);
  const listsStore = store(sortedLists);

  // ---- Filter state ----
  let selectedListIds = $state<string[]>([]);
  let selectedDates = $state<string[]>([]);
  let selectedStatuses = $state<string[]>([]);
  let searchQuery = $state('');

  // Date filter options
  const dateOptions = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'nodate', label: 'No Date' },
  ];

  // Status filter options
  const statusOptions: { id: TaskStatus; label: string }[] = [
    { id: 'todo', label: 'To-Do' },
    { id: 'later', label: 'Do It Later' },
    { id: 'done', label: 'Done' },
  ];

  // ---- Helpers ----
  function getListName(listId: string): string {
    return $listsStore.find((l) => l.id === listId)?.name ?? 'Unknown';
  }

  function getListColor(listId: string): string {
    return $listsStore.find((l) => l.id === listId)?.color ?? '#01696f';
  }

  // A displayed task: either a plain task, or a recurring task pinned to its
  // next available occurrence date.
  type DisplayTask = { task: Task; occurrenceDate?: string };


  // Effective date key for date filters: the occurrence date for recurring
  // tasks, otherwise the task's own due date.
  function getEffectiveDateKey(dt: DisplayTask): string | null {
    if (dt.occurrenceDate) return dt.occurrenceDate;
    return dt.task.dueDate ? toDateKey(dt.task.dueDate) : null;
  }

  // All display tasks:
  //  - non-recurring: shown as-is
  //  - recurring active (status !== 'done'): pinned to their next available
  //    occurrence (one card per task, never all occurrences)
  const displayTasks = $derived<DisplayTask[]>(
    $tasksStore.map((task) => {
      if (task.isRecurring && task.status !== 'done') {
        return { task, occurrenceDate: getNextOccurrenceDate(task) ?? undefined };
      }
      return { task };
    })
  );

  function matchDateFilter(dt: DisplayTask): boolean {
    const dateKey = getEffectiveDateKey(dt);
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    if (!dateKey) {
      return selectedDates.includes('nodate');
    }

    const due = new Date(`${dateKey}T00:00:00`);

    for (const d of selectedDates) {
      if (d === 'today' && isSameDay(due, today)) return true;
      if (d === 'week' && due >= weekStart && due <= weekEnd) return true;
      if (d === 'overdue' && due.getTime() < startOfDay(today).getTime()) return true;
      if (d === 'nodate') return true;
    }
    return false;
  }

  function matchesFilters(dt: DisplayTask): boolean {
    const task = dt.task;
    // Search by title or notes (case-insensitive)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(q);
      const notesMatch = (task.notes ?? '').toLowerCase().includes(q);
      const subtaskMatch = task.subtasks.some((s) => s.title.toLowerCase().includes(q));
      if (!titleMatch && !notesMatch && !subtaskMatch) {
        return false;
      }
    }
    // List filter (OR within category)
    if (selectedListIds.length > 0 && !selectedListIds.includes(task.listId)) {
      return false;
    }
    // Date filter (OR within category) — uses the effective occurrence date
    if (selectedDates.length > 0 && !matchDateFilter(dt)) {
      return false;
    }
    // Status filter (OR within category)
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(task.status)) {
      return false;
    }
    return true;
  }

  function toggleChip(category: 'lists' | 'dates' | 'statuses', id: string): void {
    if (category === 'lists') {
      selectedListIds = selectedListIds.includes(id)
        ? selectedListIds.filter((x) => x !== id)
        : [...selectedListIds, id];
    } else if (category === 'dates') {
      selectedDates = selectedDates.includes(id)
        ? selectedDates.filter((x) => x !== id)
        : [...selectedDates, id];
    } else {
      selectedStatuses = selectedStatuses.includes(id)
        ? selectedStatuses.filter((x) => x !== id)
        : [...selectedStatuses, id];
    }
  }

  function clearAll(): void {
    selectedListIds = [];
    selectedDates = [];
    selectedStatuses = [];
    searchQuery = '';
  }

  function removeActiveFilter(category: 'lists' | 'dates' | 'statuses', id: string): void {
    toggleChip(category, id);
  }

  const activeCount = $derived(
    selectedListIds.length + selectedDates.length + selectedStatuses.length
  );

  const filteredTasks = $derived(
    displayTasks
      .filter(matchesFilters)
      .sort((a, b) => {
        // Done tasks at the bottom
        if (a.task.status === 'done' && b.task.status !== 'done') return 1;
        if (b.task.status === 'done' && a.task.status !== 'done') return -1;
        // Sort by order
        return a.task.order - b.task.order;
      })
  );
</script>

<div class="px-4 md:px-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold text-neutral-800 dark:text-neutral-100">Combined</h1>
    <span class="text-sm text-neutral-500 dark:text-neutral-400">
      {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
    </span>
  </div>

  <!-- Search bar -->
  <div class="relative mb-4">
    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
      <Icon name="search" size={16} />
    </span>
    <input
      type="text"
      placeholder="Search tasks by title, notes, or subtasks..."
      bind:value={searchQuery}
      class="w-full pl-9 pr-8 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow"
    />
    {#if searchQuery}
      <button
        type="button"
        onclick={() => (searchQuery = '')}
        class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        aria-label="Clear search"
      >
        <Icon name="x" size={16} />
      </button>
    {/if}
  </div>

  <!-- Filter chips section -->
  <div class="space-y-3 mb-4">
    <!-- By List -->
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">List</p>
      <div class="flex flex-wrap gap-1.5">
        {#each $listsStore as list}
          <button
            type="button"
            onclick={() => toggleChip('lists', list.id)}
            class={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              selectedListIds.includes(list.id)
                ? 'bg-primary text-white border-primary'
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-primary/50'
            }`}
          >
            <span class="inline-block w-2 h-2 rounded-full mr-1.5 border" style={`background: ${list.color}; border-color: ${list.color}`}></span>
            {list.name}
          </button>
        {/each}
      </div>
    </div>

    <!-- By Date -->
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">Date</p>
      <div class="flex flex-wrap gap-1.5">
        {#each dateOptions as opt}
          <button
            type="button"
            onclick={() => toggleChip('dates', opt.id)}
            class={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              selectedDates.includes(opt.id)
                ? 'bg-primary text-white border-primary'
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- By Status -->
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">Status</p>
      <div class="flex flex-wrap gap-1.5">
        {#each statusOptions as opt}
          <button
            type="button"
            onclick={() => toggleChip('statuses', opt.id)}
            class={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              selectedStatuses.includes(opt.id)
                ? 'bg-primary text-white border-primary'
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Active filters summary bar -->
  {#if activeCount > 0}
    <div class="flex items-start justify-between gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card px-3 py-2.5 mb-4">
      <div class="flex flex-wrap gap-1.5">
        {#each selectedListIds as listId}
          <button
            type="button"
            onclick={() => removeActiveFilter('lists', listId)}
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary dark:text-primary-light"
          >
            <span class="inline-block w-1.5 h-1.5 rounded-full" style={`background: ${getListColor(listId)}`}></span>
            {getListName(listId)}
            <Icon name="x" size={12} />
          </button>
        {/each}
        {#each selectedDates as dateId}
          <button
            type="button"
            onclick={() => removeActiveFilter('dates', dateId)}
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary dark:text-primary-light"
          >
            {dateOptions.find((o) => o.id === dateId)?.label}
            <Icon name="x" size={12} />
          </button>
        {/each}
        {#each selectedStatuses as statusId}
          <button
            type="button"
            onclick={() => removeActiveFilter('statuses', statusId)}
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary dark:text-primary-light"
          >
            {statusOptions.find((o) => o.id === statusId)?.label}
            <Icon name="x" size={12} />
          </button>
        {/each}
      </div>
      <button
        type="button"
        onclick={clearAll}
        class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary-light whitespace-nowrap pt-0.5"
      >
        Clear all
      </button>
    </div>
  {/if}

  <!-- Results -->
  {#if filteredTasks.length > 0}
    <div class="space-y-2">
      {#each filteredTasks as dt}
        <TaskCard task={dt.task} occurrenceDate={dt.occurrenceDate} />
      {/each}
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <Icon name="filter" size={36} class="text-neutral-300 dark:text-neutral-600 mb-3" />
      <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {activeCount > 0 ? 'No tasks match your filters' : 'No tasks yet'}
      </p>
      {#if activeCount > 0}
        <button
          type="button"
          onclick={clearAll}
          class="mt-2 text-xs font-semibold text-primary dark:text-primary-light"
        >
          Clear all filters
        </button>
      {/if}
    </div>
  {/if}
</div>