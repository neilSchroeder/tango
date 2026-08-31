<script lang="ts">
  import type { GameState } from '../api/types';
  import { formatTime } from '../utils/gameUtils';

  interface Props {
    gameState: GameState;
    formattedTime: string;
  }

  let { gameState, formattedTime }: Props = $props();
</script>

<div class="game-status">
  <!-- Completion status or game stats -->
  {#if gameState.is_complete}
    <div class="complete-status">
      Puzzle complete
    </div>
    {#if gameState.completion_time}
      <div class="status-detail">
        Completed in {formattedTime}
      </div>
    {/if}
  {:else}
    <div class="status-item"><span>Time</span><strong>{formattedTime}</strong></div>
    <div class="status-item"><span>Moves</span><strong>{gameState.moves_count}</strong></div>
  {/if}
</div>

<style>
  .game-status { display: flex; justify-content: center; gap: 2.5rem; margin: 0.85rem 0 0; color: var(--text-primary); }
  .status-item { display: grid; gap: 0.08rem; text-align: center; }
  .status-item span { color: var(--text-secondary); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .status-item strong { font-size: 1rem; font-variant-numeric: tabular-nums; }
  .complete-status { color: #43bd89; font-weight: 700; }
  .status-detail { color: var(--text-secondary); margin-top: 0.35rem; }
</style>