<script lang="ts">
  import type { Task } from '../types';
  import { store } from '../lib/svelteStore';
  import {
    tasks,
    setTaskStatus,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleRecurringOccurrence,
  } from '../stores/tasks';
  import { openEditSheet } from '../stores/ui';
  import {
    formatRelativeDate,
    getSubtaskProgress,
    getSubtaskPercentage,
  } from '../lib/utils';
  import Icon from './Icon.svelte';

  let {
    task,
    compact = false,
    occurrenceDate,
    showOccurrenceDate,
  }: {
    task: Task;
    compact?: boolean;
    occurrenceDate?: string;
    /** Display-only: next occurrence date for the badge (Board/List views).
     *  Does NOT affect done state or toggle behaviour. */
    showOccurrenceDate?: string;
  } = $props();

  // A "single occurrence" (recurring task with occurrenceDate) is done when its
  // dateKey is in completedDates. For non-recurring tasks (or without
  // occurrenceDate), the done state is simply the task's status — so completing
  // a task from the calendar also updates Board/List views.
  const isOccurrenceDone = $derived(
    task.isRecurring && occurrenceDate
      ? (task.completedDates ?? []).includes(occurrenceDate)
      : task.status === 'done'
  );

  // Swipe state (Svelte 5 runes)
  let startX = $state(0);
  let currentX = $state(0);
  let isDragging = $state(false);
  let isSwiping = $state(false);
  let swipeThreshold = $state(80);
  let swipeAction = $state<'none' | 'left' | 'right' | 'confirmed-left' | 'confirmed-right'>('none');
  let showSubtasks = $state(false);

  // Some Android WebViews / Samsung Internet don't reliably fire pointer events
  // during horizontal swipes (touch-action allows the browser to take over the
  // gesture). We use native touch events on touch devices and fall back to
  // pointer events on mouse/trackpad. `isTouchActive` prevents double-handling
  // on devices that fire both event families.
  let isTouchActive = $state(false);

  // Haptic feedback simulation: a brief CSS scale pulse when the task
  // transitions from not-done → done (checkbox tap or swipe-right).
  let isPulsing = $state(false);
  let prevDone = false;

  $effect(() => {
    const done = isOccurrenceDone;
    if (done && !prevDone) {
      isPulsing = true;
      const t = setTimeout(() => {
        isPulsing = false;
      }, 350);
      return () => clearTimeout(t);
    }
    prevDone = done;
  });

  const tasksStore = store(tasks);

  // Shared swipe logic (called from both pointer and touch end handlers)
  function resolveSwipeAction(): void {
    if (swipeAction === 'confirmed-left') {
      deleteTask(task.id);
      swipeAction = 'none';
      return;
    } else if (swipeAction === 'confirmed-right') {
      if (task.isRecurring && occurrenceDate) {
        // Single occurrence (Calendar/Combined views)
        toggleRecurringOccurrence(task.id, occurrenceDate);
      } else {
        setTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done');
      }
      swipeAction = 'none';
      return;
    }

    swipeAction = 'none';
  }

  // --- Pointer events (mouse / trackpad / modern touch browsers) ---
  function onPointerDown(event: PointerEvent) {
    if (compact) return;
    if (isTouchActive) return; // touch handler already took over
    const target = event.target as HTMLElement;
    if (target?.closest('input, button, a, [data-no-swipe]')) return;
    startX = event.clientX;
    currentX = event.clientX;
    isDragging = true;
    isSwiping = false;
    swipeAction = 'none';
  }

  function onPointerMove(event: PointerEvent) {
    if (compact) return;
    if (isTouchActive) return; // touch handler already took over
    if (!isDragging) return;
    currentX = event.clientX;
    updateSwipeState();
  }

  function onPointerEnd() {
    if (compact) return;
    if (isTouchActive) return;
    if (!isDragging) return;
    isDragging = false;

    if (!isSwiping) return;
    isSwiping = false;

    resolveSwipeAction();
  }

  // --- Native touch events (Samsung Internet / Android WebView fallback) ---
  function onTouchStart(event: TouchEvent) {
    if (compact) return;
    const target = event.target as HTMLElement;
    if (target?.closest('input, button, a, [data-no-swipe]')) return;
    isTouchActive = true;
    const touch = event.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    currentX = touch.clientX;
    isDragging = true;
    isSwiping = false;
    swipeAction = 'none';
  }

  function onTouchMove(event: TouchEvent) {
    if (compact) return;
    if (!isDragging) return;
    const touch = event.touches[0];
    if (!touch) return;
    currentX = touch.clientX;
    updateSwipeState();

    // Prevent the browser from scrolling horizontally while swiping.
    // Vertical scrolling remains allowed (touch-action: pan-y on the card).
    if (isSwiping) {
      event.preventDefault();
    }
  }

  function onTouchEnd() {
    if (compact) return;
    isTouchActive = false;
    if (!isDragging) return;
    isDragging = false;

    if (!isSwiping) return;
    isSwiping = false;

    resolveSwipeAction();
  }

  function updateSwipeState(): void {
    const delta = currentX - startX;

    if (Math.abs(delta) > 8) {
      isSwiping = true;
    }

    if (delta < -swipeThreshold) {
      swipeAction = 'confirmed-left';
    } else if (delta > swipeThreshold) {
      swipeAction = 'confirmed-right';
    } else if (delta < 0) {
      swipeAction = 'left';
    } else if (delta > 0) {
      swipeAction = 'right';
    } else {
      swipeAction = 'none';
    }
  }

  function getSwipeStyle(): string {
    if (swipeAction === 'none') return '';
    let offset = 0;
    if (swipeAction === 'left') offset = -swipeThreshold * 0.5;
    if (swipeAction === 'right') offset = swipeThreshold * 0.5;
    if (swipeAction === 'confirmed-left') offset = -swipeThreshold;
    if (swipeAction === 'confirmed-right') offset = swipeThreshold;
    return `transform: translateX(${offset}px); transition: transform 0.2s ease-out;`;
  }

  function getLiveSwipeTransform(): string {
    if (!isDragging) return '';
    const delta = currentX - startX;
    const max = 120;
    const clamped = Math.max(-max, Math.min(max, delta));
    return `transform: translateX(${clamped}px); transition: none;`;
  }

  // Opacity of the revealed red (left swipe) / green (right swipe) background,
  // proportional to how far the card has been swiped. Returns 0..1.
  function getRevealOpacity(): number {
    if (isDragging) {
      const delta = currentX - startX;
      return Math.min(Math.abs(delta) / swipeThreshold, 1);
    }
    // Not dragging: keep the confirmed action's background fully revealed
    return swipeAction === 'confirmed-left' || swipeAction === 'confirmed-right'
      ? 1
      : 0;
  }

  function toggleSubtask(subtaskId: string) {
    const currentTask = tasks.get().find((t) => t.id === task.id);
    if (!currentTask) return;
    updateTask(currentTask.id, {
      subtasks: currentTask.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, done: !s.done } : s
      ),
    });
  }

  // Derived values (reactive)
  const { completed, total } = $derived(
    task.subtasks.length > 0
      ? getSubtaskProgress(task)
      : { completed: 0, total: 0 }
  );
  const percent = $derived(getSubtaskPercentage(task));

  // Effective due date for the badge:
  //  - single occurrence views (Calendar/Combined) pass occurrenceDate
  //  - Board/List views pass showOccurrenceDate (next occurrence) for
  //    recurring tasks, purely as a visual cue
  //  - otherwise the task's own dueDate
  const effectiveDueDate = $derived(
    task.isRecurring && occurrenceDate
      ? occurrenceDate
      : task.isRecurring && showOccurrenceDate
        ? showOccurrenceDate
        : task.dueDate
  );
  const isOverdue = $derived(
    effectiveDueDate && new Date(effectiveDueDate) < new Date() && !isOccurrenceDone
  );

  function handleClick() {
    if (isSwiping) return;
    openEditSheet(task);
  }

  function handleDragStart(e: DragEvent) {
    if (!compact) return;
    e.stopPropagation();
  }

  function handleSubtaskToggle(subtaskId: string) {
    toggleSubtask(subtaskId);
  }

  function handleToggleStatus() {
    if (task.isRecurring && occurrenceDate) {
      // Toggle only this single occurrence (Calendar/Combined views)
      toggleRecurringOccurrence(task.id, occurrenceDate);
    } else {
      // Toggle the task as a whole (affects Board/List/Combined views too)
      toggleTaskStatus(task.id);
    }
  }
</script>

<div class="relative swipe-container">
  <!-- Left action (delete) -->
  <div class="absolute inset-y-0 left-0 w-full flex justify-end items-stretch" style="pointer-events: none;">
    <div class="w-20 bg-red-500 flex items-center justify-center transition-opacity duration-150" style={`opacity: ${getRevealOpacity()}`}>
      <Icon name="trash-2" size={20} class="text-white" />
    </div>
  </div>

  <!-- Right action (done) -->
  <div class="absolute inset-y-0 right-0 w-full flex justify-start items-stretch" style="pointer-events: none;">
    <div class="w-20 bg-green-500 flex items-center justify-center transition-opacity duration-150" style={`opacity: ${getRevealOpacity()}`}>
      <Icon name="check" size={22} class="text-white" />
    </div>
  </div>

  <!-- Task card -->
  <div
    class={`relative bg-white dark:bg-neutral-900 rounded-card shadow-card ${compact ? 'p-3' : 'p-4'} no-select cursor-pointer touch-manipulation ${isPulsing ? 'task-pulse' : ''} ${isOccurrenceDone ? 'opacity-60' : ''}`}
    style={`touch-action: pan-y; ${isDragging ? getLiveSwipeTransform() : getSwipeStyle()}`}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerEnd}
    onpointercancel={onPointerEnd}
    onpointerleave={onPointerEnd}
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
    ontouchcancel={onTouchEnd}
    onclick={handleClick}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    }}
  >
    <div class="flex items-start gap-3">
      <!-- Checkbox toggle -->
      <button
        type="button"
        data-no-swipe
        onclick={(e) => { e.stopPropagation(); handleToggleStatus(); }}
        class={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isOccurrenceDone
            ? 'bg-green-500 border-green-500'
            : 'border-neutral-300 dark:border-neutral-600 hover:border-primary'
        }`}
        aria-label={isOccurrenceDone ? 'Mark as not done' : 'Mark as done'}
      >
        {#if isOccurrenceDone}
          <Icon name="check" size={12} class="text-white" />
        {/if}
      </button>

      <!-- Task content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <p
            class={`text-sm font-medium break-words ${
              isOccurrenceDone
                ? 'line-through text-neutral-400 dark:text-neutral-500'
                : 'text-neutral-800 dark:text-neutral-100'
            }`}
          >
            {task.title}
          </p>

          <!-- Drag handle -->
          <span
            class="shrink-0 text-neutral-300 dark:text-neutral-600 cursor-grab touch-none"
            data-no-swipe
            aria-label="Drag to reorder"
          >
            <Icon name="grip-vertical" size={16} />
          </span>
        </div>

        <!-- Meta row: due date, boomerang, recurring -->
        {#if effectiveDueDate || task.boomerangDays || task.isRecurring}
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            {#if effectiveDueDate}
              <span
                class={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  isOverdue
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : isOccurrenceDone
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      : 'bg-primary/10 text-primary dark:text-primary-light'
                }`}
              >
                <Icon name="clock" size={11} />
                {formatRelativeDate(effectiveDueDate)}
              </span>
            {/if}

            {#if task.boomerangDays}
              <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                🪃 {task.boomerangDays}d
              </span>
            {/if}

            {#if task.isRecurring}
              <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                <span aria-hidden="true">🔁</span>
                {task.recurringInterval}
              </span>
            {/if}
          </div>
        {/if}

        <!-- Subtasks section -->
        {#if task.subtasks.length > 0}
          <!-- Progress bar -->
          <div class="mt-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                {completed}/{total} subtasks
              </span>
              <span class="text-xs font-medium text-primary">{percent}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar-fill" style={`width: ${percent}%`}></div>
            </div>
          </div>

          <!-- Collapsed/expanded subtasks -->
          <div class="mt-2 space-y-1">
            {#each (showSubtasks ? task.subtasks : task.subtasks.slice(0, 2)) as subtask}
              <div class="flex items-center gap-2 pl-1">
                <button
                  type="button"
                  data-no-swipe
                  onclick={(e) => { e.stopPropagation(); handleSubtaskToggle(subtask.id); }}
                  class={`w-4 h-4 rounded border flex items-center justify-center ${
                    subtask.done
                      ? 'bg-primary border-primary'
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                >
                  {#if subtask.done}
                    <Icon name="check" size={10} class="text-white" />
                  {/if}
                </button>
                <span
                  class={`text-xs ${subtask.done ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'}`}
                >
                  {subtask.title}
                </span>
              </div>
            {/each}

            {#if task.subtasks.length > 2}
              <button
                type="button"
                data-no-swipe
                onclick={(e) => { e.stopPropagation(); showSubtasks = !showSubtasks; }}
                class="text-xs font-medium text-primary flex items-center gap-1 pl-0.5 pt-1"
              >
                <Icon name={showSubtasks ? 'chevron-down' : 'chevron-right'} size={12} />
                {showSubtasks ? 'Show less' : `Show ${task.subtasks.length - 2} more`}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>