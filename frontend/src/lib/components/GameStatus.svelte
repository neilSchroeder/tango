<script lang="ts">
  import type { GameState } from '../api/types';
  import { formatTime } from '../utils/gameUtils';

  interface Props {
    gameState: GameState;
    formattedTime: string;
  }

  let { gameState, formattedTime }: Props = $props();
</script>

<div class="text-center mt-3 sm:mt-4 transition-colors duration-200">
  <!-- Completion status or game stats -->
  {#if gameState.is_complete}
    <div class="text-green-600 dark:text-green-400 font-bold text-lg sm:text-xl transition-colors duration-200">
      🎉 Puzzle Complete! 🎉
    </div>
    {#if gameState.completion_time}
      <div class="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base transition-colors duration-200">
        Completed in {formattedTime}
      </div>
    {/if}
  {:else}
    <div class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-200">
      Time: {formattedTime}
    </div>
    <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors duration-200">
      Moves: {gameState.moves_count}
    </div>
  {/if}
</div>