<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { darkMode, settingsOpen, closeSettings, defaultBoomerangDays } from '../stores/ui';
  import { clearCompletedTasks, tasks } from '../stores/tasks';
  import { addToast } from '../stores/ui';
  import Icon from './Icon.svelte';

  const settingsOpenStore = store(settingsOpen);
  const darkModeStore = store(darkMode);
  const defaultBoomerangStore = store(defaultBoomerangDays);
  const tasksStore = store(tasks);

  let confirmClear = $state(false);

  function toggleDarkMode(): void {
    darkMode.set(!$darkModeStore);
  }

  function onBoomerangInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (Number.isFinite(value) && value >= 0) {
      defaultBoomerangDays.set(value);
    }
  }

  function handleClearCompleted(): void {
    if (!confirmClear) {
      confirmClear = true;
      // Reset confirmation after 3s
      setTimeout(() => (confirmClear = false), 3000);
      return;
    }

    const removed = clearCompletedTasks();
    confirmClear = false;
    if (removed > 0) {
      addToast(`${removed} completed ${removed === 1 ? 'task' : 'tasks'} deleted`, 'success');
    } else {
      addToast('No completed tasks to clear', 'info');
    }
  }

  // Close on backdrop click
  function onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      closeSettings();
    }
  }
</script>

{#if $settingsOpenStore}
  <div
    class="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
    onclick={onBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
  >
    <div
      class="w-full md:max-w-md bg-surface-light dark:bg-surface-dark rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header with drag handle on mobile -->
      <div class="pt-3 md:pt-5 px-5 md:px-6 pb-4 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-surface-light dark:bg-surface-dark">
        <div class="md:hidden sheet-handle mb-3"></div>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <Icon name="settings" size={20} class="text-primary" />
            Settings
          </h2>
          <button
            type="button"
            onclick={closeSettings}
            class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close settings"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      <div class="p-5 md:p-6 space-y-6">
        <!-- Appearance -->
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            Appearance
          </h3>
          <button
            type="button"
            onclick={toggleDarkMode}
            class="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-800 rounded-card border border-neutral-200 dark:border-neutral-700 transition-colors hover:border-primary/40"
          >
            <span class="flex items-center gap-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {#if $darkModeStore}
                <Icon name="sun" size={18} class="text-amber-500" />
                Light Mode
              {:else}
                <Icon name="moon" size={18} class="text-primary" />
                Dark Mode
              {/if}
            </span>
            <span class={`w-10 h-6 rounded-full relative transition-colors ${$darkModeStore ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
              <span class={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${$darkModeStore ? 'left-[18px]' : 'left-0.5'}`}></span>
            </span>
          </button>
        </section>

        <!-- Boomerang default -->
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            Boomerang
          </h3>
          <div class="px-4 py-3 bg-white dark:bg-neutral-800 rounded-card border border-neutral-200 dark:border-neutral-700">
            <label for="boom-default" class="flex items-center justify-between text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
              <span class="flex items-center gap-2">🪃 Default days</span>
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                {defaultBoomerangStore.value}d
              </span>
            </label>
            <input
              id="boom-default"
              type="range"
              min="0"
              max="30"
              value={defaultBoomerangStore.value}
              oninput={onBoomerangInput}
              class="w-full accent-primary"
            />
            <div class="flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
              <span>0 (off)</span>
              <span>30 days</span>
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              Default boomerang value applied to newly created tasks.
            </p>
          </div>
        </section>

        <!-- Danger zone -->
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-red-500 mb-2">Danger Zone</h3>
          <button
            type="button"
            onclick={handleClearCompleted}
            class={`w-full flex items-center justify-between px-4 py-3 rounded-card border transition-colors ${
              confirmClear
                ? 'bg-red-500 border-red-500 text-white'
                : 'bg-white dark:bg-neutral-800 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            <span class="flex items-center gap-2 text-sm font-medium">
              <Icon name={confirmClear ? 'alert-triangle' : 'trash-2'} size={18} />
              {confirmClear ? 'Tap again to confirm' : 'Clear all completed tasks'}
            </span>
            {#if !confirmClear}
              <span class="text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                {$tasksStore.filter((t) => t.status === 'done').length}
              </span>
            {/if}
          </button>
        </section>

        <!-- About -->
        <section class="pt-2 text-center">
          <p class="text-xs text-neutral-400 dark:text-neutral-500">
            Keep in Mind · v0.1.0
          </p>
        </section>
      </div>
    </div>
  </div>
{/if}