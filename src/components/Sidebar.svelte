<script lang="ts">
  import { currentView, setView, openSettings } from '../stores/ui';
  import type { View } from '../types';
  import { store } from '../lib/svelteStore';
  import Icon from './Icon.svelte';
  import SyncBadge from './SyncBadge.svelte';

  const currentViewStore = store(currentView);

  const navItems: { view: View; label: string; icon: string }[] = [
    { view: 'lists', label: 'Lists', icon: 'home' },
    { view: 'calendar', label: 'Calendar', icon: 'calendar' },
    { view: 'board', label: 'Board', icon: 'layout-grid' },
    { view: 'combined', label: 'Combined', icon: 'sliders-horizontal' },
  ];

  function handleNavClick(view: View): void {
    setView(view);
  }

</script>

<aside class="hidden md:flex flex-col w-60 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 h-full">
  <!-- Logo -->
  <div class="px-6 py-5 flex items-center gap-2">
    <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
      <span class="text-white text-sm font-bold">K</span>
    </div>
    <span class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Keep in Mind</span>
  </div>

  <!-- Nav items -->
  <nav class="flex-1 px-3 space-y-1">
    {#each navItems as item}
      {@const isActive = $currentViewStore === item.view}
      <button
        onclick={() => handleNavClick(item.view)}
        class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary dark:text-primary-light'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
        }`}
      >
        <Icon name={item.icon} size={18} />
        <span>{item.label}</span>
      </button>
    {/each}
  </nav>

  <!-- Sync / Account -->
  <div class="px-3 py-2 border-t border-neutral-200 dark:border-neutral-800">
    <SyncBadge />
  </div>

  <!-- Settings -->
  <div class="px-3 py-3 border-t border-neutral-200 dark:border-neutral-800">
    <button
      onclick={openSettings}
      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
    >
      <Icon name="settings" size={18} />
      <span>Settings</span>
    </button>
  </div>
</aside>
