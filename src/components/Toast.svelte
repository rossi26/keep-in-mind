<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { toasts } from '../stores/ui';
  import type { ToastMessage } from '../types';

  const toastsStore = store(toasts);

  const typeClasses: Record<ToastMessage['type'], string> = {
    info: 'bg-neutral-800 dark:bg-neutral-700 text-white',
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
  };
</script>

<div class="fixed top-4 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
  {#each $toastsStore as toast}
    <div
      class={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-toast-in ${typeClasses[toast.type]}`}
    >
      {toast.text}
    </div>
  {/each}
</div>