<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';

  const { state } = gameStore;

  async function handleNewGame() {
    await gameStore.createGame();
  }

  function handleReset() {
    gameStore.resetGame();
  }

  function handleUndo() {
    gameStore.undoMove();
  }

  async function handleHint() {
    await gameStore.getHint();
  }
  
  function handleDifficultyChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    gameStore.setDifficulty(target.value);
  }
  
  const difficultyOptions = [
    { value: 'easy', label: '🟢 Easy', description: '8-12 pieces, fewer constraints' },
    { value: 'medium', label: '🟡 Medium', description: '6-10 pieces, moderate constraints' },
    { value: 'hard', label: '🔴 Hard', description: '4-8 pieces, more constraints' }
  ];
  
  // Get current difficulty description for tooltip
  $: currentDifficultyDesc = difficultyOptions.find(opt => opt.value === state.difficulty)?.description || '';
</script>

<div class="game-controls bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sm:p-4 transition-colors duration-300">
  <h2 class="text-base sm:text-lg md:text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 text-center transition-colors duration-300">Game Controls</h2>
  
  <div class="flex gap-3 sm:gap-4 justify-center flex-wrap">
    <!-- Difficulty Selector styled as button -->
    <div class="relative">
      <select
        id="difficulty-select"
        title={currentDifficultyDesc}
        class="appearance-none px-6 sm:px-8 py-3 sm:py-4 bg-purple-500 text-white text-sm sm:text-base rounded-full hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] sm:min-w-[140px] min-h-[48px] font-medium cursor-pointer pr-10 sm:pr-12 text-center focus:outline-none focus:ring-2 focus:ring-purple-300"
        value={state.difficulty}
        onchange={handleDifficultyChange}
        disabled={state.isCreatingGame || state.isMakingMove}
      >
        {#each difficultyOptions as option}
          <option value={option.value} class="bg-white text-gray-900 py-2 px-4 rounded">
            {option.label}
          </option>
        {/each}
      </select>
      <!-- Custom dropdown arrow -->
      <div class="absolute inset-y-0 right-0 flex items-center pr-3 sm:pr-4 pointer-events-none">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
    </div>
    <button
      class="px-6 sm:px-8 py-3 sm:py-4 bg-blue-500 text-white text-sm sm:text-base rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] sm:min-w-[140px] min-h-[48px] font-medium"
      onclick={handleNewGame}
      disabled={state.isCreatingGame || state.isMakingMove}
    >
      {#if state.isCreatingGame}
        <span class="inline-flex items-center">
          <svg class="animate-spin -ml-1 mr-1 sm:mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="hidden sm:inline">Creating...</span>
          <span class="sm:hidden">...</span>
        </span>
      {:else}
        <span class="hidden sm:inline">🎲 New Game</span>
        <span class="sm:hidden">🎲 New</span>
      {/if}
    </button>

    {#if state.currentGame}
      <button
        class="px-6 sm:px-8 py-3 sm:py-4 bg-gray-500 text-white text-sm sm:text-base rounded-full hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] sm:min-w-[140px] min-h-[48px] font-medium"
        onclick={handleReset}
        disabled={state.isCreatingGame || state.isMakingMove}
      >
        <span class="hidden sm:inline">🔄 Reset</span>
        <span class="sm:hidden">🔄</span>
      </button>
      
      <button
        class="px-6 sm:px-8 py-3 sm:py-4 bg-orange-500 text-white text-sm sm:text-base rounded-full hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] sm:min-w-[140px] min-h-[48px] font-medium"
        onclick={handleUndo}
        disabled={state.isCreatingGame || state.isMakingMove || state.moveHistory.length === 0}
      >
        <span class="hidden sm:inline">↶ Undo</span>
        <span class="sm:hidden">↶</span>
      </button>
      
      {#if !state.currentGame.is_complete}
        <button
          class="px-6 sm:px-8 py-3 sm:py-4 bg-amber-500 text-white text-sm sm:text-base rounded-full hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] sm:min-w-[140px] min-h-[48px] font-medium"
          onclick={handleHint}
          disabled={state.isLoadingHint || state.isMakingMove}
        >
          {#if state.isLoadingHint}
            <span class="inline-flex items-center">
              <svg class="animate-spin -ml-1 mr-1 sm:mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="hidden sm:inline">Loading...</span>
              <span class="sm:hidden">...</span>
            </span>
          {:else}
            <span class="hidden sm:inline">💡 Hint</span>
            <span class="sm:hidden">💡</span>
          {/if}
        </button>
      {/if}
    {/if}
  </div>

  <!-- Game instructions -->
  <div class="mt-4 sm:mt-5 text-sm sm:text-base text-gray-600 dark:text-gray-400 space-y-2 text-center transition-colors duration-300">
    <h3 class="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base md:text-lg transition-colors duration-300">How to Play:</h3>
    <ul class="space-y-1 text-sm sm:text-base text-left inline-block">
      <li>• Click tiles to cycle: Empty → ☀ → ☽ → Empty</li>
      <li>• Each row/column needs exactly 3 suns and 3 moons</li>
      <li>• No 3 consecutive identical pieces</li>
      <li>• Follow constraint symbols:</li>
      <li class="ml-4">= means tiles must match</li>
      <li class="ml-4">× means tiles must differ</li>
    </ul>
  </div>

  <!-- Error display -->
  {#if state.error}
    <div class="mt-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-center transition-colors duration-300">
      <div class="font-semibold text-red-800 dark:text-red-300 text-xs transition-colors duration-300">Error</div>
      <div class="text-xs text-red-700 dark:text-red-400 mt-1 transition-colors duration-300">{state.error}</div>
      <button
        class="mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
        onclick={() => gameStore.clearError()}
      >
        Dismiss
      </button>
    </div>
  {/if}
</div>
