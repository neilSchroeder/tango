<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';
  import { fade, scale } from 'svelte/transition';

  // Access state reactively using Svelte 5 runes
  const state = $derived(gameStore.state);

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
    { value: 'easy', label: '🔵 Easy', description: '6-10 pieces, 25% constraints', color: 'blue' },
    { value: 'medium', label: '🟢 Medium', description: '4-8 pieces, 35% constraints', color: 'green' },
    { value: 'hard', label: '🟡 Hard', description: '6-10 pieces, 25% constraints', color: 'yellow' },
    { value: 'expert', label: '🟠 Expert', description: '4-8 pieces, 20% constraints', color: 'orange' },
    { value: 'genius', label: '🔴 Genius', description: '2-6 pieces, 15% constraints', color: 'red' }
  ];
  
  // Get current difficulty description for tooltip
  const currentDifficultyDesc = $derived(difficultyOptions.find(opt => opt.value === state.difficulty)?.description || '');

  // Format elapsed time for display
  function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
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
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
      <li>Click tiles to cycle: Empty → ☀ → ☽ → Empty</li>
      <li>Each row/column needs exactly 3 suns and 3 moons</li>
      <li>No 3 consecutive identical pieces</li>
      <li>Follow constraint symbols:</li>
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

<!-- IMPORTANT: Modal rendered outside of any containers -->
{#if state.showWinCelebration}
  <div 
    class="fixed top-0 left-0 w-screen h-screen z-[999999] bg-black bg-opacity-90 flex items-center justify-center p-4"
    style="position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;"
    role="button"
    tabindex="0"
    aria-label="Close win celebration modal"
    onclick={() => gameStore.closeWinCelebration()}
    onkeydown={(e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        gameStore.closeWinCelebration();
      }
    }}
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
  >
    <div 
      class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 w-full max-w-md relative"
      style="max-width: 400px; min-height: 300px; position: relative;"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => { e.stopPropagation(); }}
      onkeydown={(e) => { if (e.key === 'Escape') gameStore.closeWinCelebration(); }}
      in:scale={{ duration: 200, start: 0.9 }} 
      out:scale={{ duration: 150 }}
    >
      <!-- Close button -->
      <button 
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10" 
        aria-label="Close modal" 
        onclick={() => gameStore.closeWinCelebration()}
      >
        ×
      </button>

      <!-- Success content -->
  <div class="text-center bg-gray-900 text-white rounded-xl p-6" style="background:#1a202c; color:#fff;">
        <!-- Success icon -->
        <div class="mx-auto w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-2">
          <svg class="w-5 h-5" fill="none" stroke="#4ade80" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <!-- Title -->
        <h2 class="text-3xl sm:text-5xl font-extrabold text-white mb-3">
          🎉 Congratulations! 🎉
        </h2>
        
        <!-- Description -->
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          You completed the puzzle!
        </p>
        
        <!-- Stats -->
  <div class="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-6 space-y-6 min-w-[320px] w-full">
          <div class="flex justify-between items-center px-6">
            <span class="font-semibold text-gray-700 dark:text-gray-300" style="font-size: 3rem;">Time:</span>
            <span class="font-bold text-green-300" style="font-size: 3rem; line-height: 0.9;">{formatTime(state.elapsedTime)}</span>
          </div>
          <div class="flex justify-between items-center px-6">
            <span class="font-semibold text-gray-700 dark:text-gray-300" style="font-size: 3rem;">Leaderboard:</span>
            <span class="font-bold text-green-300" style="font-size: 3rem; line-height: 0.9;">
              {state.leaderboardPosition ? `#${state.leaderboardPosition}` : 'N/A'}
            </span>
          </div>
        </div>
        
        <!-- Action buttons -->
        <div class="flex gap-3 sm:gap-4 justify-center flex-wrap">
          <button 
            class="px-6 sm:px-8 py-3 sm:py-4 bg-blue-500 text-white text-sm sm:text-base rounded-full hover:bg-blue-600 transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] sm:min-w-[140px] min-h-[48px] font-medium" 
            onclick={() => gameStore.startNewGameFromCelebration()}
          >
            🎲 Play Again
          </button>
          <button 
            class="px-6 sm:px-8 py-3 sm:py-4 bg-gray-500 text-white text-sm sm:text-base rounded-full hover:bg-gray-600 transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] sm:min-w-[140px] min-h-[48px] font-medium" 
            onclick={() => gameStore.closeWinCelebration()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
