<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';
  import { onMount } from 'svelte';

  const { state } = gameStore;

  // Load leaderboard on mount
  onMount(() => {
    gameStore.loadLeaderboard();
  });

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  function formatTimeWithMilliseconds(timeInSeconds: number): string {
    const minutes = Math.floor(timeInSeconds / 60);
    const remainingSeconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  // Get difficulty display info
  function getDifficultyDisplay(difficulty: string) {
    const difficultyMap: { [key: string]: { label: string, emoji: string, color: string } } = {
      'easy': { label: 'Easy', emoji: '🔵', color: 'text-blue-600' },
      'medium': { label: 'Medium', emoji: '🟢', color: 'text-green-600' },
      'hard': { label: 'Hard', emoji: '🟡', color: 'text-yellow-600' },
      'expert': { label: 'Expert', emoji: '🟠', color: 'text-orange-600' },
      'genius': { label: 'Genius', emoji: '🔴', color: 'text-red-600' }
    };
    return difficultyMap[difficulty] || { label: 'Standard', emoji: '⚪', color: 'text-gray-600' };
  }
  
  const difficultyInfo = $derived(getDifficultyDisplay(state.difficulty));
</script>

<div class="leaderboard bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sm:p-4 transition-colors duration-300">
  <h2 class="text-lg sm:text-xl md:text-2xl font-bold mb-4 text-center text-gray-800 dark:text-gray-200 transition-colors duration-300">
    🏆 Leaderboard
  </h2>
  <div class="text-center mb-3">
    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-300">
      <span class="mr-1">{difficultyInfo.emoji}</span>
      <span class="capitalize {difficultyInfo.color} dark:{difficultyInfo.color.replace('text-', 'text-').replace('-600', '-400')}">{difficultyInfo.label}</span>
    </span>
  </div>

  {#if state.isLoadingLeaderboard}
    <div class="text-center py-3">
      <div class="animate-spin rounded-full h-5 sm:h-6 w-5 sm:w-6 border-b-2 border-blue-500 mx-auto"></div>
      <p class="text-gray-600 dark:text-gray-400 mt-2 text-xs sm:text-sm transition-colors duration-300">Loading...</p>
    </div>
  {:else if state.leaderboard.length === 0}
    <div class="text-center py-3 text-gray-600 dark:text-gray-400 transition-colors duration-300">
      <p class="text-xs sm:text-sm">No {difficultyInfo.label.toLowerCase()} games completed yet.</p>
      <p class="text-xs mt-1">Be the first to finish a {difficultyInfo.label.toLowerCase()} puzzle!</p>
    </div>
  {:else}
    <div class="space-y-1 max-h-40 sm:max-h-48 overflow-y-auto">
      {#each state.leaderboard as entry, index}
        <div class="leaderboard-entry {index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} transition-colors duration-300 p-3 rounded-lg">
          <div class="text-center">
            <div class="inline-flex items-center justify-center">
              <span class="text-sm sm:text-lg mr-2">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
              </span>
              <div>
                <div class="font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-sm transition-colors duration-300">
                  {formatTimeWithMilliseconds(entry.time)}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                  {formatDate(entry.date)}
                </div>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <div class="text-center">
      <button
        class="mt-4 px-6 sm:px-8 py-3 sm:py-4 bg-blue-500 text-white text-sm sm:text-base rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg min-w-[120px] min-h-[48px] font-medium"
        onclick={() => gameStore.loadLeaderboard()}
        disabled={state.isLoadingLeaderboard}
      >
        Refresh
      </button>
    </div>
  {/if}
</div>
