<script lang="ts">
  import { currentView, setView, openSettings, openAuthModal } from '../stores/ui';
  import { currentUser } from '../stores/sync';
  import { store } from '../lib/svelteStore';
  import Icon from './Icon.svelte';
  import type { View } from '../types';

  const currentViewStore = store(currentView);
  const currentUserStore = store(currentUser);

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

<nav class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 safe-bottom">
  <div class="flex items-stretch justify-around max-w-md mx-auto h-16">
    {#each navItems as item}
      {@const isActive = $currentViewStore === item.view}
      <button
        onclick={() => handleNavClick(item.view)}
        class={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
          isActive
            ? 'text-primary dark:text-primary-light'
            : 'text-neutral-500 dark:text-neutral-400'
        }`}
      >
        <Icon name={item.icon} size={22} />
        <span class="text-[10px] font-medium">{item.label}</span>
      </button>
    {/each}
  </div>
</nav>

<!-- Account button for mobile - top right floating -->
<button
  onclick={openAuthModal}
  class="md:hidden fixed top-4 right-16 z-40 w-10 h-10 rounded-full bg-white dark:bg-neutral-800 shadow-card flex items-center justify-center text-neutral-600 dark:text-neutral-300"
  aria-label="Account and sync"
>
  {#if $currentUserStore}
    <span class="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
      {($currentUserStore.email ?? '?').charAt(0).toUpperCase()}
    </span>
  {:else}
    <Icon name="cloud" size={18} />
  {/if}
</button>

<!-- Settings button for mobile - top right floating -->
<button
  onclick={openSettings}
  class="md:hidden fixed top-4 right-4 z-40 w-10 h-10 rounded-full bg-white dark:bg-neutral-800 shadow-card flex items-center justify-center text-neutral-600 dark:text-neutral-300"
  aria-label="Open settings"
>
  <Icon name="settings" size={18} />
</button>
