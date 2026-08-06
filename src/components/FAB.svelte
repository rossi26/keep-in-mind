<script lang="ts">
  import { openCreateSheet } from '../stores/ui';
  import Icon from './Icon.svelte';

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

<button
  onclick={handlePress}
  class={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[55] w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark hover:shadow-xl transition-all flex items-center justify-center ${isPressed ? 'fab-spring' : ''}`}
  aria-label="Add new task"
>
  <Icon name="plus" size={24} />
</button>