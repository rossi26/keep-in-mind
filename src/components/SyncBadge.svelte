<script lang="ts">
  import { store } from '../lib/svelteStore';
  import {
    syncStatus,
    syncEnabled,
    currentUser,
  } from '../stores/sync';
  import { openAuthModal } from '../stores/ui';
  import Icon from './Icon.svelte';

  const syncStatusStore = store(syncStatus);
  const syncEnabledStore = store(syncEnabled);
  const currentUserStore = store(currentUser);

  function getStatusLabel(status: string, enabled: boolean): string {
    if (!enabled) return 'No cloud sync';
    if (status === 'offline') return 'Offline';
    if (status === 'syncing') return 'Syncing…';
    if (status === 'error') return 'Sync error';
    if (status === 'online') return 'Synced';
    return 'Cloud sync';
  }

  function getStatusColor(status: string, enabled: boolean): string {
    if (!enabled) return 'text-neutral-400 dark:text-neutral-500';
    if (status === 'offline') return 'text-amber-500';
    if (status === 'syncing') return 'text-primary';
    if (status === 'error') return 'text-red-500';
    if (status === 'online') return 'text-emerald-500';
    return 'text-neutral-400 dark:text-neutral-500';
  }

  function getStatusIcon(status: string, enabled: boolean): string {
    if (!enabled) return 'cloud-off';
    if (status === 'offline') return 'wifi-off';
    if (status === 'syncing') return 'refresh-cw';
    if (status === 'error') return 'alert-circle';
    if (status === 'online') return 'wifi';
    return 'cloud';
  }
</script>

{#if $currentUserStore}
  <!-- Logged in: show email + sync status -->
  <button
    onclick={openAuthModal}
    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
    title={$currentUserStore.email ?? 'Account'}
  >
    <span class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
      {($currentUserStore.email ?? '?').charAt(0).toUpperCase()}
    </span>
    <span class="flex-1 min-w-0">
      <span class="block truncate">{$currentUserStore.email}</span>
      <span class={`block flex items-center gap-1 ${getStatusColor($syncStatusStore, $syncEnabledStore)}`}>
        <Icon name={getStatusIcon($syncStatusStore, $syncEnabledStore)} size={12} class={$syncStatusStore === 'syncing' ? 'animate-spin' : ''} />
        <span class="text-[11px]">{getStatusLabel($syncStatusStore, $syncEnabledStore)}</span>
      </span>
    </span>
  </button>
{:else}
  <!-- Logged out -->
  <button
    onclick={openAuthModal}
    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
  >
    <Icon name="log-in" size={18} class="text-primary" />
    <span class="flex-1 text-left">
      <span class="block">Sign in to sync</span>
      <span class={`block flex items-center gap-1 ${getStatusColor($syncStatusStore, $syncEnabledStore)}`}>
        <Icon name={getStatusIcon($syncStatusStore, $syncEnabledStore)} size={12} class={$syncStatusStore === 'syncing' ? 'animate-spin' : ''} />
        <span class="text-[11px]">{getStatusLabel($syncStatusStore, $syncEnabledStore)}</span>
      </span>
    </span>
  </button>
{/if}