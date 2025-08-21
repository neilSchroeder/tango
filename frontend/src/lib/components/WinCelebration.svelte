<script lang="ts">
  import type { GameState } from '../api/types';
  
  export let game: GameState;
  export let difficulty: string;
  export let completionTime: string;
  export let leaderboardPosition: number | null = null;
  export let isVisible: boolean;
  export let onclose: (() => void) | undefined;
  export let onnewgame: (() => void) | undefined;
  
  function handleClose() {
    onclose?.();
  }
  
  function handleNewGame() {
    onnewgame?.();
  }
  
  function formatTime(timeStr: string): string {
    // Convert seconds to MM:SS.mmm format
    const seconds = parseFloat(timeStr);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  function getDifficultyColor(difficulty: string): string {
    const colors = {
      'easy': 'text-blue-500',
      'medium': 'text-green-500', 
      'hard': 'text-yellow-500',
      'expert': 'text-orange-500',
      'genius': 'text-red-500'
    };
    return colors[difficulty as keyof typeof colors] || 'text-gray-500';
  }
  
  function getDifficultyEmoji(difficulty: string): string {
    const emojis = {
      'easy': '🔵',
      'medium': '🟢', 
      'hard': '🟡',
      'expert': '🟠',
      'genius': '🔴'
    };
    return emojis[difficulty as keyof typeof emojis] || '⚪';
  }
</script>

<style>
  .modal-backdrop {
    background-color: rgb(249, 250, 251) !important; /* Light mode: gray-50 */
  }
  
  :global(.dark) .modal-backdrop {
    background-color: rgb(31, 41, 55) !important; /* Dark mode: gray-800 */
  }
</style>

{#if isVisible}
  <!-- Modal Container -->
  <div 
    class="fixed z-[9999] p-4"
    style="position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 9999 !important;"
  >
    <!-- Modal Backdrop - positioned relative to modal content -->
    <div 
      class="absolute rounded-3xl z-[9998] modal-backdrop" 
      style="position: absolute !important; top: -2rem !important; left: -2rem !important; right: -2rem !important; bottom: -2rem !important; z-index: 9998 !important; border-width: 2px; border-style: solid; border-color: #4B5563 !important; border-radius: 15px;"
      role="button" 
      tabindex="0"
      onclick={handleClose}
      onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && handleClose()}
      aria-label="Close modal"
    ></div>
  
    <div 
    class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100 relative z-[9999]"
    >
      <!-- Header -->
      <div class="rounded-t-2xl text-center">
        <div 
        class="text-2xl font-bold text-white mb-1"
        style="font-size: 2rem;"
        >🎉 Puzzle Complete! 🎉</div>
        <p class="text-yellow-100">Congratulations on solving the puzzle!</p>
      </div>
      
      <!-- Content -->
      <div class="p-6 space-y-4">
        <!-- Difficulty Badge -->
        <div class="flex items-center justify-center mb-4">
          <div class="bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2 flex items-center space-x-2">
            <span class="text-2xl">{getDifficultyEmoji(difficulty)}</span>
            <span class="font-semibold {getDifficultyColor(difficulty)} capitalize">
              {difficulty}
            </span>
          </div>
        </div>
        
        <!-- Stats -->
        <div class="space-y-3">
          <!-- Completion Time -->
          <div 
          class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
          style="padding-bottom: 1px;"
          >
            <div class="flex items-center space-x-2">
              <span class="text-xl">⏱️</span>
              <span class="font-medium text-gray-700 dark:text-gray-300">Time</span>
            </div>
            <span class="font-bold text-lg text-blue-600 dark:text-blue-400">
              {formatTime(completionTime)}
            </span>
          </div>
          
          <!-- Leaderboard Position -->
          {#if leaderboardPosition}
            <div 
            class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
            style="padding-bottom: 10px;"
            >
              <div class="flex items-center space-x-2">
                <span class="text-xl">🏆</span>
                <span class="font-medium text-gray-700 dark:text-gray-300">Rank</span>
              </div>
              <span class="font-bold text-lg text-yellow-600 dark:text-yellow-400">
                #{leaderboardPosition}
              </span>
            </div>
          {/if}
        
        <!-- Actions -->
        <div class="flex space-x-3 pt-4">
          <button
            onclick={handleNewGame}
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
            style="border-radius: 20px; padding: 10px;"
          >
            <span class="text-lg">🎲</span>
            <span>New Game</span>
          </button>
          
          <button
            onclick={handleClose}
            class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
            style="border-radius: 20px;"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
{/if}
