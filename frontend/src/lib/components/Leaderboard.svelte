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
</script>

<div class="leaderboard bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 transition-colors duration-300">
  <h2 class="text-lg font-bold mb-3 text-center text-gray-800 dark:text-gray-200 transition-colors duration-300">
    🏆 Leaderboard
  </h2>

  {#if state.isLoadingLeaderboard}
    <div class="text-center py-3">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
      <p class="text-gray-600 dark:text-gray-400 mt-2 text-sm transition-colors duration-300">Loading...</p>
    </div>
  {:else if state.leaderboard.length === 0}
    <div class="text-center py-3 text-gray-600 dark:text-gray-400 transition-colors duration-300">
      <p class="text-sm">No completed games yet.</p>
      <p class="text-xs mt-1">Be the first to finish a puzzle!</p>
    </div>
  {:else}
    <div class="space-y-2 max-h-48 overflow-y-auto">
      {#each state.leaderboard as entry, index}
        <div class="leaderboard-entry {index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700' : 'border-gray-200 dark:border-gray-600'} transition-colors duration-300">
          <div class="text-center">
            <div class="inline-flex items-center justify-center">
              <span class="text-lg mr-2">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
              </span>
              <div>
                <div class="font-semibold text-blue-600 dark:text-blue-400 text-sm transition-colors duration-300">
                  {entry.formatted_time}
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
        class="mt-3 px-6 py-3 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 shadow-md hover:shadow-lg"
        onclick={() => gameStore.loadLeaderboard()}
        disabled={state.isLoadingLeaderboard}
      >
        Refresh
      </button>
    </div>
  {/if}
</div>
