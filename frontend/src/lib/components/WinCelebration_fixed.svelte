<script lang="ts">
  import type { GameState } from '../api/types';
  
  interface Props {
    game: GameState;
    difficulty: string;
    completionTime: string;
    leaderboardPosition?: number | null;
    isVisible: boolean;
    onclose?: () => void;
    onnewgame?: () => void;
  }
  
  let { game, difficulty, completionTime, leaderboardPosition, isVisible, onclose, onnewgame }: Props = $props();
  
  function handleClose() {
    onclose?.();
  }
  
  function handleNewGame() {
    onnewgame?.();
  }
  
  function formatTime(timeStr: string): string {
    // Convert seconds to MM:SS format
    const seconds = parseFloat(timeStr);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

{#if isVisible}
  <!-- Backdrop -->
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 transition-opacity duration-300"
    role="button"
    tabindex="0"
    onclick={handleClose}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  ></div>
  
  <!-- Modal -->
  <div class="fixed inset-0 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
      <!-- Header -->
      <div class="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-t-2xl p-6 text-center">
        <div class="text-6xl mb-2">🎉</div>
        <h2 class="text-2xl font-bold text-white mb-1">Puzzle Complete!</h2>
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
          <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
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
            <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div class="flex items-center space-x-2">
                <span class="text-xl">🏆</span>
                <span class="font-medium text-gray-700 dark:text-gray-300">Rank</span>
              </div>
              <span class="font-bold text-lg text-yellow-600 dark:text-yellow-400">
                #{leaderboardPosition}
              </span>
            </div>
          {/if}
          
          <!-- Grid Size -->
          <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <span class="text-xl">📋</span>
              <span class="font-medium text-gray-700 dark:text-gray-300">Grid</span>
            </div>
            <span class="font-semibold text-gray-600 dark:text-gray-400">
              6×6
            </span>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex space-x-3 pt-4">
          <button
            onclick={handleNewGame}
            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <span class="text-lg">🎲</span>
            <span>New Game</span>
          </button>
          
          <button
            onclick={handleClose}
            class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
