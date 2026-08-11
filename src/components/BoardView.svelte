<script lang="ts">
  import { onMount } from 'svelte';
  import Sortable from 'sortablejs';
  import { store } from '../lib/svelteStore';
  import { tasks, reorderTasksByStatus, moveTaskToStatus, getTaskById } from '../stores/tasks';
  import { getNextOccurrenceDate } from '../lib/utils';
  import type { Task, TaskStatus } from '../types';
  import TaskCard from './TaskCard.svelte';
  import Icon from './Icon.svelte';

  const tasksStore = store(tasks);

  // Column definitions
  const columns: { status: TaskStatus; title: string; icon: string; accent: string; dot: string }[] = [
    { status: 'todo', title: 'To-Do', icon: 'list-todo', accent: 'text-primary dark:text-primary-light', dot: 'bg-primary' },
    { status: 'later', title: 'Do It Later', icon: 'clock', accent: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
    { status: 'done', title: 'Done', icon: 'check-square', accent: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  ];

  // Mobile accordion state
  let expandedColumn = $state<TaskStatus>('todo');

  // Sortable instances keyed by status
  let sortables = new Map<TaskStatus, Sortable>();

  // Root element ref
  let rootEl: HTMLElement | undefined = $state();

  // Get tasks for a status, sorted by order
  function getTasksByStatus(status: TaskStatus) {
    return $tasksStore
      .filter((t) => t.status === status)
      .sort((a, b) => a.order - b.order);
  }

  function getTaskCount(status: TaskStatus): number {
    return $tasksStore.filter((t) => t.status === status).length;
  }

  // Display-only next occurrence for recurring tasks (badge cue in Board).
  // Toggling/dragging a task in the Board still treats it as a whole task.
  function getDisplayOccurrence(task: Task): string | undefined {
    if (task.isRecurring && task.status !== 'done') {
      return getNextOccurrenceDate(task) ?? undefined;
    }
    return undefined;
  }

  function toggleColumn(status: TaskStatus) {
    // Toggle: if the tapped column is open, close it; otherwise open it (only one open at a time)
    expandedColumn = expandedColumn === status ? null : status;
  }

  function setupSortable(el: HTMLElement, status: TaskStatus) {
    if (!el) return;

    // Destroy existing sortable for this status if any
    const existing = sortables.get(status);
    if (existing) {
      existing.destroy();
      sortables.delete(status);
    }

    const sortable = Sortable.create(el, {
      group: 'board',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      draggable: '.board-task',
      filter: 'input, button, a, [data-no-swipe]',
      delay: 150,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      preventOnFilter: false,
      onEnd: (evt) => {
        const taskId = evt.item.dataset.taskId;
        if (!taskId) return;

        const task = getTaskById(taskId);
        if (!task) return;

        const fromStatus = evt.from.dataset.status as TaskStatus;

        // If the task's real status in the store already differs from fromStatus,
        // its status was changed by another action (e.g. checkbox click, swipe).
        // Don't override it with SortableJS's toStatus.
        if (task.status !== fromStatus) return;

        const toStatus = evt.to.dataset.status as TaskStatus;

        if (fromStatus === toStatus) {
          // Reorder within same column
          const orderedIds = Array.from(evt.to.querySelectorAll('.board-task'))
            .map((el) => (el as HTMLElement).dataset.taskId)
            .filter((id): id is string => !!id);
          reorderTasksByStatus(toStatus, orderedIds);
        } else {
          // Move to different column
          moveTaskToStatus(taskId, toStatus);
        }
      },
    });

    sortables.set(status, sortable);
  }

  // Set up sortables for all visible column bodies
  function setupAllSortables() {
    if (!rootEl) return;

    // Find all visible column bodies (not hidden by CSS)
    const bodies = rootEl.querySelectorAll<HTMLElement>('[data-board-body]');
    bodies.forEach((body) => {
      // Check if the body is actually visible (not display:none)
      const isVisible = body.offsetParent !== null || body.getClientRects().length > 0;
      if (isVisible) {
        const status = body.dataset.status as TaskStatus;
        setupSortable(body, status);
      }
    });
  }

  // Reactively set up sortables when root mounts or expanded column changes
  $effect(() => {
    if (rootEl) {
      setupAllSortables();
    }
  });

  // Also re-setup when expanded column changes (mobile accordion)
  $effect(() => {
    // Reference expandedColumn to make this effect reactive to it
    const _ = expandedColumn;
    if (rootEl) {
      // Small delay to ensure DOM is updated
      setTimeout(() => setupAllSortables(), 0);
    }
  });

  onMount(() => {
    return () => {
      sortables.forEach((s) => s.destroy());
      sortables.clear();
    };
  });
</script>

<div bind:this={rootEl} class="px-4 md:px-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-xl font-semibold text-neutral-800 dark:text-neutral-100">Board</h1>
    <span class="text-sm text-neutral-500 dark:text-neutral-400">
      {getTaskCount('todo') + getTaskCount('later') + getTaskCount('done')} tasks
    </span>
  </div>

  <!-- Desktop: 3 columns side by side -->
  <div class="hidden md:grid md:grid-cols-3 gap-4 items-start">
    {#each columns as col}
      <div class="bg-neutral-100 dark:bg-neutral-800/50 rounded-card p-3">
        <!-- Column header -->
        <div class="flex items-center justify-between mb-3 px-1">
          <div class="flex items-center gap-2">
            <span class={`w-2.5 h-2.5 rounded-full ${col.dot}`}></span>
            <span class={`text-sm font-semibold ${col.accent}`}>{col.title}</span>
          </div>
          <span class="text-xs font-medium bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded-full shadow-sm">
            {getTaskCount(col.status)}
          </span>
        </div>

        <!-- Column body (sortable) -->
        <div
          data-board-body
          data-status={col.status}
          class="space-y-2 min-h-[100px]"
        >
          {#each getTasksByStatus(col.status) as task}
            <div class="board-task" data-task-id={task.id}>
              <TaskCard {task} compact showOccurrenceDate={getDisplayOccurrence(task)} />
            </div>
          {/each}

          {#if getTaskCount(col.status) === 0}
            <div class="text-center py-8 text-xs text-neutral-400 dark:text-neutral-500 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-card">
              Drop tasks here
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Mobile: accordion columns -->
  <div class="md:hidden space-y-2">
    {#each columns as col}
      <div class="bg-neutral-100 dark:bg-neutral-800/50 rounded-card overflow-hidden">
        <!-- Accordion header (tap to expand/collapse) -->
        <button
          type="button"
          onclick={() => toggleColumn(col.status)}
          class="w-full flex items-center justify-between px-4 py-3"
        >
          <div class="flex items-center gap-2">
            <span class={`w-2.5 h-2.5 rounded-full ${col.dot}`}></span>
            <span class={`text-sm font-semibold ${col.accent}`}>{col.title}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded-full shadow-sm">
              {getTaskCount(col.status)}
            </span>
            <Icon
              name={expandedColumn === col.status ? 'chevron-down' : 'chevron-right'}
              size={16}
              class="text-neutral-400 dark:text-neutral-500"
            />
          </div>
        </button>

        <!-- Collapsible body -->
        {#if expandedColumn === col.status}
          <div class="px-3 pb-3">
            <div
              data-board-body
              data-status={col.status}
              class="space-y-2 min-h-[60px]"
            >
              {#each getTasksByStatus(col.status) as task}
                <div class="board-task" data-task-id={task.id}>
                  <TaskCard {task} compact showOccurrenceDate={getDisplayOccurrence(task)} />
                </div>
              {/each}

              {#if getTaskCount(col.status) === 0}
                <div class="text-center py-6 text-xs text-neutral-400 dark:text-neutral-500 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-card">
                  Drop tasks here
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>