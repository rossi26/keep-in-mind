<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { taskSheetOpen, taskSheetMode, taskSheetTask, closeTaskSheet, addToast } from '../stores/ui';
  import { sortedLists } from '../stores/lists';
  import { tasks, createTask, updateTask } from '../stores/tasks';
  import { generateId, dateInputToISO, isoToDateInput } from '../lib/utils';
  import type { TaskStatus, RecurringInterval } from '../types';
  import Icon from './Icon.svelte';

  const taskSheetOpenStore = store(taskSheetOpen);
  const taskSheetModeStore = store(taskSheetMode);
  const taskSheetTaskStore = store(taskSheetTask);
  const listsStore = store(sortedLists);

  // Form state (Svelte 5 runes)
  let title = $state('');
  let notes = $state('');
  let listId = $state('');
  let status = $state<TaskStatus>('todo');
  let dueDate = $state('');
  let isRecurring = $state(false);
  let recurringInterval = $state<RecurringInterval>('daily');
  let boomerangDays = $state<number | null>(null);
  let subtasks = $state<{ id: string; title: string; done: boolean }[]>([]);
  let newSubtaskTitle = $state('');
  let startY = $state(0);
  let dragOffset = $state(0);
  let isDragging = $state(false);

  // Boomerang checkbox state
  let boomerangEnabled = $state(false);

  // Reset form when sheet opens
  $effect(() => {
    if ($taskSheetOpenStore) {
      const task = $taskSheetTaskStore;
      if (task) {
        title = task.title;
        notes = task.notes ?? '';
        listId = task.listId;
        dueDate = isoToDateInput(task.dueDate);
        isRecurring = task.isRecurring;
        recurringInterval = task.recurringInterval ?? 'daily';
        boomerangDays = task.boomerangDays;
        boomerangEnabled = task.boomerangDays !== null;
        subtasks = task.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done }));
      } else {
        title = '';
        notes = '';
        listId = $listsStore[0]?.id ?? '';
        status = 'todo';
        dueDate = '';
        isRecurring = false;
        recurringInterval = 'daily';
        boomerangDays = null;
        boomerangEnabled = false;
        subtasks = [];
      }
    }
  });

  // Swipe down to dismiss
  function onPointerDown(event: PointerEvent) {
    if (event.target.closest('input, button, select, textarea')) return;
    startY = event.clientY;
    dragOffset = 0;
    isDragging = true;
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging) return;
    const delta = event.clientY - startY;
    if (delta > 0) {
      dragOffset = delta;
    }
  }

  function onPointerEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffset > 100) {
      closeTaskSheet();
    }
    dragOffset = 0;
  }

  function addSubtask() {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    subtasks = [...subtasks, { id: generateId(), title: trimmed, done: false }];
    newSubtaskTitle = '';
  }

  function removeSubtask(id: string) {
    subtasks = subtasks.filter((s) => s.id !== id);
  }

  function toggleBoomerang() {
    boomerangEnabled = !boomerangEnabled;
    if (!boomerangEnabled) {
      boomerangDays = null;
    } else if (boomerangDays === null) {
      boomerangDays = 3;
    }
  }

  function saveTask() {
    if (!title.trim()) return;

    const taskData = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      listId,
      status,
      dueDate: dateInputToISO(dueDate || null),
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : null,
      boomerangDays: boomerangEnabled ? boomerangDays : null,
      subtasks: subtasks.map((s, i) => ({
        id: s.id,
        title: s.title,
        done: s.done,
        order: i,
      })),
    };

    if ($taskSheetModeStore === 'edit' && $taskSheetTaskStore) {
      updateTask($taskSheetTaskStore.id, taskData);
      addToast('Task updated');
    } else {
      const listTasks = tasks.get().filter((t) => t.listId === listId);
      createTask({
        ...taskData,
        order: listTasks.length,
      });
      addToast('Task created');
    }

    closeTaskSheet();
  }
</script>

{#if $taskSheetOpenStore}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
    onclick={closeTaskSheet}
    role="button"
    aria-label="Close"
  ></div>

  <!-- Bottom sheet -->
  <div
    class="fixed bottom-0 inset-x-0 z-50 mx-auto max-w-lg bg-white dark:bg-neutral-900 rounded-t-2xl shadow-2xl safe-bottom"
    style={`transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.3s ease-out'};`}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerEnd}
    onpointercancel={onPointerEnd}
    role="dialog"
    aria-modal="true"
  >
    <!-- Drag handle -->
    <div class="flex justify-center pt-3 pb-1">
      <div class="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600"></div>
    </div>

    <div class="px-5 pb-6 max-h-[80vh] overflow-y-auto">
      <h2 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
        {$taskSheetModeStore === 'edit' ? 'Edit Task' : 'New Task'}
      </h2>

      <!-- Title input -->
      <input
        type="text"
        bind:value={title}
        placeholder="What needs to be done?"
        class="w-full px-4 py-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3"
      />

      <!-- Notes -->
      <textarea
        bind:value={notes}
        placeholder="Add notes..."
        rows="2"
        class="w-full px-4 py-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3 resize-none"
      ></textarea>

      <!-- List selector -->
      <div class="mb-3">
        <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block" for="task-list">List</label>
        <div class="flex flex-wrap gap-2" id="task-list">
          {#each $listsStore as list}
            <button
              type="button"
              onclick={() => (listId = list.id)}
              class={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                listId === list.id
                  ? 'text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
              style={listId === list.id ? `background-color: ${list.color}` : ''}
            >
              {list.name}
            </button>
          {/each}
        </div>
      </div>

      <!-- Due date -->
      <div class="mb-3">
        <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block" for="task-due">Due Date</label>
        <input
          id="task-due"
          type="date"
          bind:value={dueDate}
          class="w-full px-4 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <!-- Recurring -->
      <div class="mb-3">
        <label class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
          <input type="checkbox" bind:checked={isRecurring} class="accent-primary" />
          Recurring
        </label>
        {#if isRecurring}
          <div class="flex gap-2 mt-2">
            {#each ['daily', 'weekly', 'monthly'] as interval}
              <button
                type="button"
                onclick={() => (recurringInterval = interval)}
                class={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  recurringInterval === interval
                    ? 'bg-primary text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {interval}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Boomerang -->
      <div class="mb-3">
        <label class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
          <input type="checkbox" checked={boomerangEnabled} onchange={toggleBoomerang} class="accent-primary" />
          🪃 Boomerang
        </label>
        {#if boomerangEnabled}
          <div class="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="1"
              max="30"
              bind:value={boomerangDays}
              class="w-20 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">days</span>
          </div>
        {/if}
      </div>

      <!-- Status -->
      <div class="mb-3">
        <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block">Status</label>
        <div class="flex gap-2">
          <button
            type="button"
            onclick={() => (status = 'todo')}
            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === 'todo'
                ? 'bg-primary text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            To-do
          </button>
          <button
            type="button"
            onclick={() => (status = 'later')}
            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === 'later'
                ? 'bg-primary text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            Do it later
          </button>
        </div>
      </div>

      <!-- Subtasks -->
      <div class="mb-4">
        <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block">Subtasks</label>
        <div class="space-y-1.5 mb-2">
          {#each subtasks as subtask}
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => {
                  subtasks = subtasks.map((s) =>
                    s.id === subtask.id ? { ...s, done: !s.done } : s
                  );
                }}
                class={`w-4 h-4 rounded border flex items-center justify-center ${
                  subtask.done ? 'bg-primary border-primary' : 'border-neutral-300 dark:border-neutral-600'
                }`}
              >
                {#if subtask.done}
                  <Icon name="check" size={10} class="text-white" />
                {/if}
              </button>
              <span class={`flex-1 text-sm ${subtask.done ? 'line-through text-neutral-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                {subtask.title}
              </span>
              <button
                type="button"
                onclick={() => removeSubtask(subtask.id)}
                class="text-neutral-400 hover:text-red-500"
                aria-label="Remove subtask"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          {/each}
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newSubtaskTitle}
            placeholder="Add subtask..."
            class="flex-1 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSubtask();
              }
            }}
          />
          <button
            type="button"
            onclick={addSubtask}
            class="px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium"
          >
            Add
          </button>
        </div>
      </div>

      <!-- Save button -->
      <button
        type="button"
        onclick={saveTask}
        class="w-full py-3 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition-colors"
      >
        {$taskSheetModeStore === 'edit' ? 'Save Changes' : 'Create Task'}
      </button>
    </div>
  </div>
{/if}