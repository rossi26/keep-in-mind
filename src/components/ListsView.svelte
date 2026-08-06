<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { sortedLists, createList, deleteList } from '../stores/lists';
  import { tasks } from '../stores/tasks';
  import { activeListId, addToast } from '../stores/ui';
  import Icon from './Icon.svelte';

  const listsStore = store(sortedLists);
  const tasksStore = store(tasks);

  // List creation modal state
  let showCreateModal = $state(false);
  let newListName = $state('');
  let selectedColor = $state('#01696f');
  let selectedIcon = $state('list-todo');

  const colorOptions = ['#01696f', '#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#db2777'];

  const iconOptions = ['list-todo', 'briefcase', 'shopping-bag', 'heart', 'star', 'book-open', 'dumbbell', 'plane', 'coffee', 'music', 'camera', 'wallet', 'gift', 'folder', 'calendar'];

  // Task count per list (reactive via subscribed store)
  function getCount(listId: string): number {
    return $tasksStore.filter((t) => t.listId === listId && t.status !== 'done').length;
  }

  function openList(listId: string): void {
    activeListId.set(listId);
  }

  function openCreateModal(): void {
    newListName = '';
    selectedColor = '#01696f';
    selectedIcon = 'list-todo';
    showCreateModal = true;
  }

  function closeCreateModal(): void {
    showCreateModal = false;
  }

  function saveNewList(): void {
    const name = newListName.trim();
    if (!name) return;
    createList(name, selectedColor, selectedIcon);
    addToast('List created', 'success');
    closeCreateModal();
  }

  function handleDeleteList(e: MouseEvent, id: string): void {
    e.stopPropagation();
    if (confirm('Delete this list and all its tasks?')) {
      deleteList(id);
      addToast('List deleted');
    }
  }
</script>

<div class="p-4 md:p-8 max-w-5xl mx-auto w-full">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Lists</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Organize your tasks by category</p>
    </div>
    <button
      type="button"
      onclick={openCreateModal}
      class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
    >
      <Icon name="plus" size={16} />
      <span class="hidden sm:inline">New List</span>
    </button>
  </div>

  <!-- Lists grid: 2 cols mobile, 3 desktop -->
  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
    {#each $listsStore as list}
      <div
        role="button"
        tabindex="0"
        onclick={() => openList(list.id)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openList(list.id);
          }
        }}
        class="group relative bg-white dark:bg-neutral-900 rounded-card shadow-card hover:shadow-card-hover transition-all p-4 md:p-5 text-left cursor-pointer"
      >
        <!-- Color accent top bar -->
        <div class="absolute top-0 left-0 right-0 h-1 rounded-t-card" style={`background-color: ${list.color}`}></div>

        <!-- Delete button -->
        <button
          type="button"
          onclick={(e) => handleDeleteList(e, list.id)}
          class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-500"
          aria-label={`Delete ${list.name}`}
        >
          <Icon name="trash-2" size={14} />
        </button>

        <!-- Icon -->
        <div
          class="w-11 h-11 rounded-lg flex items-center justify-center mb-3"
          style={`background-color: ${list.color}20; color: ${list.color}`}
        >
          <Icon name={list.icon} size={22} />
        </div>

        <!-- Name -->
        <h3 class="font-semibold text-neutral-800 dark:text-neutral-100 text-sm md:text-base leading-snug">{list.name}</h3>

        <!-- Task count badge -->
        <div class="flex items-center gap-1.5 mt-2">
          <span
            class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
            style={`background-color: ${list.color}15; color: ${list.color}`}
          >
            {getCount(list.id)} open
          </span>
        </div>

        <!-- Arrow -->
        <div class="absolute bottom-4 right-4 text-neutral-300 dark:text-neutral-600 group-hover:text-primary transition-colors">
          <Icon name="chevron-right" size={16} />
        </div>
      </div>
    {/each}

    <!-- Add new list card -->
    <button
      type="button"
      onclick={openCreateModal}
      class="bg-white/50 dark:bg-neutral-900/50 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-card hover:border-primary transition-colors p-4 md:p-5 flex flex-col items-center justify-center min-h-[120px] md:min-h-[140px] text-neutral-400 dark:text-neutral-500 hover:text-primary"
    >
      <Icon name="plus" size={24} />
      <span class="text-sm font-medium mt-2">Add list</span>
    </button>
  </div>
</div>

<!-- Create List Modal -->
{#if showCreateModal}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
    onclick={closeCreateModal}
    role="button"
    aria-label="Close"
  ></div>

  <!-- Modal -->
  <div
    class="fixed bottom-0 inset-x-0 z-50 mx-auto max-w-md bg-white dark:bg-neutral-900 rounded-t-2xl shadow-2xl safe-bottom"
    role="dialog"
    aria-modal="true"
  >
    <div class="px-5 py-5 max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">New List</h2>
        <button
          type="button"
          onclick={closeCreateModal}
          class="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400"
          aria-label="Close"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <!-- List name -->
      <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block" for="new-list-name">
        Name
      </label>
      <input
        id="new-list-name"
        type="text"
        bind:value={newListName}
        placeholder="e.g. Errands, Fitness..."
        class="w-full px-4 py-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-4"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveNewList();
          }
        }}
      />

      <!-- Color picker -->
      <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block">Color</label>
      <div class="flex flex-wrap gap-2 mb-4">
        {#each colorOptions as color}
          <button
            type="button"
            onclick={() => (selectedColor = color)}
            class={`w-8 h-8 rounded-full transition-transform ${
              selectedColor === color ? 'ring-2 ring-offset-2 ring-neutral-400 dark:ring-neutral-600 scale-110' : ''
            }`}
            style={`background-color: ${color}`}
            aria-label={`Color ${color}`}
          ></button>
        {/each}
      </div>

      <!-- Icon picker -->
      <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block">Icon</label>
      <div class="grid grid-cols-5 gap-2 mb-5">
        {#each iconOptions as iconName}
          <button
            type="button"
            onclick={() => (selectedIcon = iconName)}
            class={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              selectedIcon === iconName
                ? 'bg-primary text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
            }`}
            aria-label={`Icon ${iconName}`}
          >
            <Icon name={iconName} size={18} />
          </button>
        {/each}
      </div>

      <!-- Preview -->
      <div class="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 mb-4">
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center"
          style={`background-color: ${selectedColor}20; color: ${selectedColor}`}
        >
          <Icon name={selectedIcon} size={20} />
        </div>
        <div>
          <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">
            {newListName || 'List name'}
          </p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">Preview</p>
        </div>
      </div>

      <!-- Save -->
      <button
        type="button"
        onclick={saveNewList}
        class="w-full py-3 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition-colors"
      >
        Create List
      </button>
    </div>
  </div>
{/if}