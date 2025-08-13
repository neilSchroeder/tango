<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';

  const { state } = gameStore;

  async function handleNewGame() {
    await gameStore.createGame();
  }

  function handleReset() {
    gameStore.resetGame();
  }

  async function handleHint() {
    await gameStore.getHint();
  }
</script>

<div class="game-controls bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sm:p-4 transition-colors duration-300">
  <h2 class="text-sm sm:text-md font-semibold mb-3 text-gray-800 dark:text-gray-200 text-center transition-colors duration-300">Game Controls</h2>
  
  <div class="flex gap-2 sm:gap-3 justify-center flex-wrap">
    <button
      class="px-4 sm:px-6 py-2 sm:py-3 bg-blue-500 text-white text-xs sm:text-sm rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[80px] sm:min-w-[100px]"
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
        class="px-4 sm:px-6 py-2 sm:py-3 bg-gray-500 text-white text-xs sm:text-sm rounded-full hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[80px] sm:min-w-[100px]"
        onclick={handleReset}
        disabled={state.isCreatingGame || state.isMakingMove}
      >
        <span class="hidden sm:inline">🔄 Reset</span>
        <span class="sm:hidden">🔄</span>
      </button>
      
      {#if !state.currentGame.is_complete}
        <button
          class="px-4 sm:px-6 py-2 sm:py-3 bg-amber-500 text-white text-xs sm:text-sm rounded-full hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[80px] sm:min-w-[100px]"
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
  <div class="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-2 text-center transition-colors duration-300">
    <h3 class="font-semibold text-gray-800 dark:text-gray-200 text-xs sm:text-sm transition-colors duration-300">How to Play:</h3>
    <ul class="space-y-1 text-xs text-left inline-block">
      <li>• Click tiles to cycle: Empty → ☀ → ☽ → Empty</li>
      <li>• Each row/column needs exactly 3 suns and 3 moons</li>
      <li>• No 3 consecutive identical pieces</li>
      <li>• Follow constraint symbols:</li>
      <li class="ml-4">= means tiles must match</li>
      <li class="ml-4">× means tiles must differ</li>
    </ul>
  </div>

  <!-- Current game info -->
  {#if state.currentGame}
    <div class="mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700 text-center transition-colors duration-300">
      <h4 class="font-semibold text-blue-800 dark:text-blue-300 text-xs transition-colors duration-300">Game Info</h4>
      <div class="text-xs text-blue-700 dark:text-blue-400 mt-1 space-y-1 transition-colors duration-300">
        <div>ID: {state.currentGame.game_id.slice(0, 8)}...</div>
        <div>Status: {state.currentGame.is_complete ? 'Complete ✅' : 'In Progress ⏳'}</div>
      </div>
    </div>
  {/if}

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
