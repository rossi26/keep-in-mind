<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { tasks } from '../stores/tasks';
  import {
    startOfDay,
    isSameDay,
    startOfWeek,
    getWeekDays,
    toDateKey,
    getRecurringOccurrences,
  } from '../lib/utils';
  import type { Task } from '../types';
  import TaskCard from './TaskCard.svelte';
  import Icon from './Icon.svelte';

  const tasksStore = store(tasks);

  // Reactive calendar state (Svelte 5 runes)
  let selectedDate = $state(startOfDay(new Date()));
  let weekStart = $state(startOfWeek(new Date()));
  let monthViewDate = $state(new Date());
  let touchStartX = $state(0);
  let isTouching = $state(false);

  // Static weekday headers for the desktop month grid (any Monday)
  const weekdayHeaderDates = getWeekDays(startOfWeek(new Date(2026, 0, 5)));

  // 7-day strip for mobile week view
  const weekDays = $derived(getWeekDays(weekStart));

  // Month grid cells for desktop (Monday-first, with leading/trailing blanks)
  const monthCells = $derived.by(() => {
    const year = monthViewDate.getFullYear();
    const month = monthViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7; // Monday-first offset
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  });

  // A single occurrence of a task on a specific date
  type Occurrence = { task: Task; dateKey: string };

  // Visible ranges for recurring expansion (week strip + month grid)
  const weekRangeStart = $derived(startOfDay(weekStart));
  const weekRangeEnd = $derived(
    startOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6))
  );
  const monthRangeStart = $derived.by(() => {
    const firstCell = monthCells.find((c) => c !== null);
    return firstCell ? startOfDay(firstCell) : startOfDay(new Date());
  });
  const monthRangeEnd = $derived.by(() => {
    const lastCell = [...monthCells].reverse().find((c) => c !== null);
    return lastCell ? startOfDay(lastCell) : startOfDay(new Date());
  });

  // Expand recurring tasks into their occurrence dates across the visible ranges.
  // Each occurrence lands on ITS OWN day (never all on the original dueDate).
  const recurringOccurrencesByDate = $derived.by(() => {
    const map = new Map<string, Occurrence[]>();
    for (const task of $tasksStore) {
      if (!task.isRecurring || !task.dueDate) continue;
      const weekDates = getRecurringOccurrences(task, weekRangeStart, weekRangeEnd);
      const monthDates = getRecurringOccurrences(task, monthRangeStart, monthRangeEnd);
      const allDates = new Set<number>([
        ...weekDates.map((d) => d.getTime()),
        ...monthDates.map((d) => d.getTime()),
      ]);
      for (const ts of allDates) {
        const key = toDateKey(new Date(ts));
        const arr = map.get(key) ?? [];
        arr.push({ task, dateKey: key });
        map.set(key, arr);
      }
    }
    return map;
  });

  // Group ALL tasks by local date key (YYYY-MM-DD):
  //  - non-recurring tasks: only on their exact dueDate
  //  - recurring tasks: on every occurrence date in the visible ranges
  const tasksByDate = $derived.by(() => {
    const map = new Map<string, Occurrence[]>();

    // Non-recurring tasks: direct due date
    for (const task of $tasksStore) {
      if (task.isRecurring || !task.dueDate) continue;
      const key = toDateKey(task.dueDate);
      const arr = map.get(key) ?? [];
      arr.push({ task, dateKey: key });
      map.set(key, arr);
    }

    // Merge recurring occurrence entries
    for (const [key, occs] of recurringOccurrencesByDate) {
      const arr = map.get(key) ?? [];
      arr.push(...occs);
      map.set(key, arr);
    }

    // Sort each day's occurrences by task order
    for (const [key, arr] of map) {
      arr.sort((a, b) => a.task.order - b.task.order);
    }

    return map;
  });

  // Helper: is a given occurrence done?
  // - Recurring tasks: done if that specific date is in completedDates
  //   (so marking an occurrence done from the calendar does NOT affect the
  //   single active card in Board/List/Combined views).
  // - Non-recurring tasks: done if the task status itself is 'done'
  //   (completing them from the calendar syncs with Board/List/Combined).
  function isOccurrenceDone(occ: Occurrence): boolean {
    if (occ.task.isRecurring) {
      return (occ.task.completedDates ?? []).includes(occ.dateKey);
    }
    return occ.task.status === 'done';
  }

  // Occurrences on the selected day (lookup on the merged map)
  const selectedOccurrences = $derived(
    tasksByDate.get(toDateKey(selectedDate)) ?? []
  );

  // Split selected day occurrences into active and completed
  const selectedActiveTasks = $derived(
    selectedOccurrences.filter((occ) => !isOccurrenceDone(occ))
  );

  // Completed occurrences of the selected day only (recurring with the dateKey
  // in completedDates, or non-recurring with status === 'done').
  const selectedCompletedTasks = $derived(
    selectedOccurrences.filter((occ) => isOccurrenceDone(occ))
  );

  // Active (non-done) occurrences by date — used for the dots on the calendar
  const activeOccurrencesByDate = $derived.by(() => {
    const map = new Map<string, Occurrence[]>();
    for (const [key, occs] of tasksByDate) {
      const active = occs.filter((occ) => !isOccurrenceDone(occ));
      if (active.length > 0) map.set(key, active);
    }
    return map;
  });

  // Tasks without a due date (shown in "Unscheduled" section).
  // Only ACTIVE unscheduled tasks appear here; completed unscheduled tasks
  // are removed from the calendar view (they stay in Board/List/Combined).
  const unscheduledActiveTasks = $derived(
    [...$tasksStore]
      .filter((t) => !t.dueDate && t.status !== 'done')
      .sort((a, b) => a.order - b.order)
  );

  // Labels (browser-locale aware)
  const monthLabel = $derived(
    new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthViewDate)
  );
  const weekLabel = $derived(
    new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(weekStart)
  );
  const selectedDateLabel = $derived(
    new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(selectedDate)
  );
  const isTodaySelected = $derived(isSameDay(selectedDate, new Date()));

  // Helpers
  function dayTaskCount(date: Date): number {
    return activeOccurrencesByDate.get(toDateKey(date))?.length ?? 0;
  }

  function formatWeekdayNarrow(date: Date): string {
    return new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date);
  }

  function formatWeekdayShort(date: Date): string {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  }

  function selectDate(date: Date): void {
    selectedDate = startOfDay(date);
  }

  function navigateWeek(direction: number): void {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + direction * 7);
    weekStart = d;
  }

  function navigateMonth(direction: number): void {
    monthViewDate = new Date(
      monthViewDate.getFullYear(),
      monthViewDate.getMonth() + direction,
      1
    );
  }

  function jumpToToday(): void {
    const now = new Date();
    selectedDate = startOfDay(now);
    weekStart = startOfWeek(now);
    monthViewDate = now;
  }

  // Touch swipe for the mobile week strip
  function onTouchStart(e: TouchEvent): void {
    touchStartX = e.touches[0].clientX;
    isTouching = true;
  }

  function onTouchEnd(e: TouchEvent): void {
    if (!isTouching) return;
    isTouching = false;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 50) {
      navigateWeek(delta < 0 ? 1 : -1);
    }
  }
</script>

<div class="safe-area-header p-4 md:p-8 max-w-5xl mx-auto w-full">
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Calendar</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Plan your schedule</p>
    </div>
    <button
      type="button"
      onclick={jumpToToday}
      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
    >
      Today
    </button>
  </div>

  <!-- Mobile: Compact horizontal week strip (swipeable) -->
  <div
    class="md:hidden bg-white dark:bg-neutral-900 rounded-card shadow-card p-3 touch-pan-y"
    ontouchstart={onTouchStart}
    ontouchend={onTouchEnd}
  >
    <div class="flex items-center justify-between mb-2">
      <button
        type="button"
        onclick={() => navigateWeek(-1)}
        class="p-1.5 text-neutral-400 hover:text-primary transition-colors"
        aria-label="Previous week"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">{weekLabel}</span>
      <button
        type="button"
        onclick={() => navigateWeek(1)}
        class="p-1.5 text-neutral-400 hover:text-primary transition-colors"
        aria-label="Next week"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>

    <!-- Week days -->
    <div class="grid grid-cols-7 gap-1">
      {#each weekDays as day}
        {@const isToday = isSameDay(day, new Date())}
        {@const isSelected = isSameDay(day, selectedDate)}
        {@const taskCount = dayTaskCount(day)}
        <button
          type="button"
          onclick={() => selectDate(day)}
          class={`flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
            isSelected
              ? 'bg-primary text-white'
              : isToday
                ? 'bg-primary/10 text-primary'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <span class="text-[10px] font-medium uppercase opacity-70">
            {formatWeekdayNarrow(day)}
          </span>
          <span class="text-sm font-semibold leading-none">{day.getDate()}</span>
          {#if taskCount > 0}
            <span class="flex items-center gap-0.5 h-1.5">
              {#each Array(Math.min(taskCount, 3)) as _}
                <span class={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`}></span>
              {/each}
              {#if taskCount > 3}
                <span class={`text-[8px] font-bold leading-none ${isSelected ? 'text-white' : 'text-primary'}`}>
                  +{taskCount - 3}
                </span>
              {/if}
            </span>
          {:else}
            <span class="h-1.5"></span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Desktop: Compact monthly grid -->
  <div class="hidden md:block bg-white dark:bg-neutral-900 rounded-card shadow-card p-5">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{monthLabel}</h2>
      <div class="flex items-center gap-1">
        <button
          type="button"
          onclick={() => navigateMonth(-1)}
          class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Previous month"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <button
          type="button"
          onclick={jumpToToday}
          class="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onclick={() => navigateMonth(1)}
          class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Next month"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </div>

    <!-- Weekday headers -->
    <div class="grid grid-cols-7 gap-1 mb-1">
      {#each weekdayHeaderDates as day}
        <div class="text-center text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase py-1">
          {formatWeekdayShort(day)}
        </div>
      {/each}
    </div>

    <!-- Day cells -->
    <div class="grid grid-cols-7 gap-1">
      {#each monthCells as cell}
        {#if cell}
          {@const isToday = isSameDay(cell, new Date())}
          {@const isSelected = isSameDay(cell, selectedDate)}
          {@const taskCount = dayTaskCount(cell)}
          {@const isOtherMonth = cell.getMonth() !== monthViewDate.getMonth()}
          <button
            type="button"
            onclick={() => selectDate(cell)}
            class={`relative h-14 rounded-lg flex flex-col items-center justify-center gap-1.5 transition-colors ${
              isSelected
                ? 'bg-primary text-white'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <span
              class={`text-sm font-medium leading-none ${
                isOtherMonth ? 'opacity-40' : ''
              } ${isToday && !isSelected ? 'text-primary font-bold' : ''}`}
            >
              {cell.getDate()}
            </span>
            {#if taskCount > 0}
              <span class="flex items-center gap-1 h-1.5">
                {#each Array(Math.min(taskCount, 3)) as _}
                  <span class={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`}></span>
                {/each}
                {#if taskCount > 3}
                  <span class={`text-[9px] font-bold leading-none ${isSelected ? 'text-white' : 'text-primary'}`}>
                    +{taskCount - 3}
                  </span>
                {/if}
              </span>
            {/if}
          </button>
        {:else}
          <div class="h-14"></div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Tasks for the selected day -->
  <div class="mt-6">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
        {selectedDateLabel}
      </h2>
      {#if isTodaySelected}
        <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          Today
        </span>
      {/if}
    </div>

    {#if selectedActiveTasks.length > 0}
      <div class="space-y-2">
        {#each selectedActiveTasks as occ}
          <TaskCard task={occ.task} occurrenceDate={occ.dateKey} />
        {/each}
      </div>
    {:else}
      <div class="text-center py-8 bg-white/50 dark:bg-neutral-900/50 rounded-card border border-dashed border-neutral-200 dark:border-neutral-700">
        <Icon name="calendar" size={24} class="text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">No active tasks this day</p>
      </div>
    {/if}

    <!-- Completed tasks for the selected day ONLY -->
    <div class="mt-6">
      <div class="flex items-center gap-2 mb-3">
        <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></div>
        <span class="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
          Completed
        </span>
        <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></div>
      </div>
      {#if selectedCompletedTasks.length > 0}
        <div class="space-y-2">
          {#each selectedCompletedTasks as occ}
            <TaskCard task={occ.task} occurrenceDate={occ.dateKey} />
          {/each}
        </div>
      {:else}
        <div class="text-center py-6 bg-white/50 dark:bg-neutral-900/50 rounded-card border border-dashed border-neutral-200 dark:border-neutral-700">
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No completed tasks this day</p>
        </div>
      {/if}
    </div>

    <!-- Unscheduled section (always visible) -->
    <div class="mt-8">
      <div class="flex items-center gap-2 mb-3">
        <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></div>
        <span class="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
          Unscheduled
        </span>
        <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></div>
      </div>
      {#if unscheduledActiveTasks.length > 0}
        <div class="space-y-2">
          {#each unscheduledActiveTasks as task}
            <TaskCard {task} />
          {/each}
        </div>
      {:else}
        <div class="text-center py-6 bg-white/50 dark:bg-neutral-900/50 rounded-card border border-dashed border-neutral-200 dark:border-neutral-700">
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No unscheduled tasks</p>
        </div>
      {/if}
    </div>
  </div>
</div>
