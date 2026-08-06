<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { activeListId } from '../stores/ui';
  import { lists } from '../stores/lists';
  import { tasks } from '../stores/tasks';
  import { getNextOccurrenceDate } from '../lib/utils';
  import Icon from './Icon.svelte';
  import TaskCard from './TaskCard.svelte';
  import type { Task } from '../types';

  const activeListIdStore = store(activeListId);
  const listsStore = store(lists);
  const tasksStore = store(tasks);

  let list = $derived(
    $listsStore.find((l) => l.id === $activeListIdStore) ?? undefined
  );
  let listTasks = $derived(
    $tasksStore
      .filter((t) => t.listId === $activeListIdStore)
      .sort((a, b) => a.order - b.order)
  );

  function goBack(): void {
    activeListId.set(null);
  }

  // Display-only next occurrence for recurring tasks (badge cue in the list).
  // Toggling a task in the list still treats it as a whole task.
  function getDisplayOccurrence(task: Task): string | undefined {
    if (task.isRecurring && task.status !== 'done') {
      return getNextOccurrenceDate(task) ?? undefined;
    }
    return undefined;
  }
</script>

{#if $activeListIdStore && list}
  <div class="p-4 md:p-8 max-w-3xl mx-auto w-full">
    <!-- Header with back button -->
    <div class="flex items-center gap-3 mb-6">
      <button
        onclick={goBack}
        class="w-9 h-9 rounded-full bg-white dark:bg-neutral-900 shadow-card flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Back to lists"
      >
        <Icon name="chevron-left" size={18} />
      </button>
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center"
          style={`background-color: ${list.color}20; color: ${list.color}`}
        >
          <Icon name={list.icon} size={20} />
        </div>
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-neutral-800 dark:text-neutral-100">{list.name}</h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {listTasks.filter((t) => t.status !== 'done').length} open · {listTasks.filter((t) => t.status === 'done').length} done
          </p>
        </div>
      </div>
    </div>

    <!-- Active tasks -->
    <div class="space-y-2">
      {#each listTasks.filter((t) => t.status !== 'done') as task}
        <TaskCard {task} showOccurrenceDate={getDisplayOccurrence(task)} />
      {/each}
    </div>

    <!-- Completed section -->
    {#if listTasks.some((t) => t.status === 'done')}
      <div class="mt-8">
        <div class="flex items-center gap-2 mb-2">
          <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></div>
          <span class="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Completed</span>
          <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></div>
        </div>
        <div class="space-y-2 opacity-70">
          {#each listTasks.filter((t) => t.status === 'done') as task}
            <TaskCard {task} />
          {/each}
        </div>
      </div>
    {/if}

    {#if listTasks.length === 0}
      <div class="text-center py-16">
        <div class="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Icon name="list-todo" size={28} class="text-primary" />
        </div>
        <p class="text-neutral-500 dark:text-neutral-400">No tasks in this list yet.</p>
      </div>
    {/if}
  </div>
{/if}