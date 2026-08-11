<script lang="ts">
  import { openCreateSheet, taskSheetOpen } from '../stores/ui';
  import { store } from '../lib/svelteStore';
  import Icon from './Icon.svelte';

  const taskSheetOpenStore = store(taskSheetOpen);

  let isPressed = $state(false);
  let pressTimer: ReturnType<typeof setTimeout> | undefined;

  function handlePress() {
    isPressed = true;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      isPressed = false;
    }, 300);
    openCreateSheet();
  }
</script>

<!-- Hidden while the task sheet is open so it never overlaps Save/Add buttons -->
{#if !$taskSheetOpenStore}
  <button
    onclick={handlePress}
    class={`fab-position w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark hover:shadow-xl transition-all flex items-center justify-center ${isPressed ? 'fab-spring' : ''}`}
    aria-label="Add new task"
  >
    <Icon name="plus" size={24} />
  </button>
{/if}
