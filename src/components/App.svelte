<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../lib/svelteStore';
  import { currentView, activeListId } from '../stores/ui';
  import { runBoomerangCheck } from '../stores/tasks';
  import { initSync } from '../lib/syncService';
  import ListsView from './ListsView.svelte';
  import ListDetailView from './ListDetailView.svelte';
  import CalendarView from './CalendarView.svelte';
  import BoardView from './BoardView.svelte';
  import CombinedView from './CombinedView.svelte';
  import BottomNav from './BottomNav.svelte';
  import Sidebar from './Sidebar.svelte';
  import FAB from './FAB.svelte';
  import TaskSheet from './TaskSheet.svelte';
  import Toast from './Toast.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import AuthModal from './AuthModal.svelte';

  const currentViewStore = store(currentView);
  const activeListIdStore = store(activeListId);

  let isHydrated = $state(false);

  onMount(() => {
    isHydrated = true;

    // Initialize Supabase sync (safe no-op when unconfigured)
    initSync();

    // Run boomerang check on app mount
    // Individual toasts are emitted by runBoomerangCheck itself
    runBoomerangCheck();
  });
</script>

<svelte:head>
  <title>Keep in Mind</title>
</svelte:head>

{#if isHydrated}
  <div class="min-h-screen bg-surface-light dark:bg-surface-dark text-neutral-800 dark:text-neutral-100">
    <!-- Desktop sidebar (hidden on mobile) -->
    <div class="hidden md:block fixed inset-y-0 left-0 z-30">
      <Sidebar />
    </div>

    <!-- Main content area -->
    <div class="md:pl-56 min-h-screen">
      <main class="pb-24 md:pb-8 pt-4 md:pt-6">
        {#if $currentViewStore === 'lists'}
          {#if $activeListIdStore}
            <ListDetailView />
          {:else}
            <ListsView />
          {/if}
        {:else if $currentViewStore === 'calendar'}
          <CalendarView />
        {:else if $currentViewStore === 'board'}
          <BoardView />
        {:else if $currentViewStore === 'combined'}
          <CombinedView />
        {/if}
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <div class="md:hidden">
      <BottomNav />
    </div>

    <!-- Floating Action Button -->
    <FAB />

    <!-- Task creation/edit bottom sheet -->
    <TaskSheet />

    <!-- Settings modal -->
    <SettingsModal />

    <!-- Auth modal -->
    <AuthModal />

    <!-- Toasts -->
    <Toast />
  </div>
{/if}