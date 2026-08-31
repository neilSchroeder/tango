<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';
  import { errorStore } from '../stores/errorStore.svelte';
  import GameTile from './GameTile.svelte';
  import GameStatus from './GameStatus.svelte';
  import DelayedValidationErrors from './DelayedValidationErrors.svelte';
  import { BOARD_SIZE } from '../game/types';
  import type { ConstraintType } from '../api/types';

  // Access state reactively using Svelte 5 runes
  const gameState = $derived(gameStore.state);

  // Track previous game state to prevent unnecessary updates
  let previousGameId: string | null = null;
  let previousMoveCount: number = -1;

  // Update error highlights when game state changes - with better change detection
  $effect(() => {
    // Only update if we have a real change
    if (gameState.currentGame && 
        (gameState.currentGame.game_id !== previousGameId || 
         gameState.currentGame.moves_count !== previousMoveCount)) {
      
      console.log(`🎯 Updating error highlights for move ${gameState.currentGame.moves_count}`);
      
      try {
        errorStore.updateErrors(gameState.currentGame, gameState.validationErrors);
        previousGameId = gameState.currentGame.game_id;
        previousMoveCount = gameState.currentGame.moves_count;
      } catch (error) {
        console.error('❌ Error updating error highlights:', error);
      }
    }
  });

  function getConstraint(constraints: ConstraintType[][], row: number, col: number, maxIndex: number): ConstraintType {
    if (!gameState.currentGame || row > maxIndex || col > maxIndex) return 'none';
    return constraints[row]?.[col] || 'none';
  }

  function isHinted(row: number, col: number): boolean {
    return gameState.hintHighlight !== null && 
           gameState.hintHighlight.row === row && 
           gameState.hintHighlight.col === col;
  }
</script>

<div class="game-board-container">
  {#if gameState.currentGame}
    <div class="game-board">
      <div class="grid gap-0 w-fit mx-auto" style="grid-template-columns: repeat({BOARD_SIZE}, 1fr);">
        {#each Array(BOARD_SIZE) as _, row}
          {#each Array(BOARD_SIZE) as _, col}
            <GameTile
              {row}
              {col}
              piece={gameState.currentGame.board[row][col]}
              isLocked={gameState.currentGame.locked_tiles[row][col]}
              isGameComplete={gameState.currentGame.is_complete}
              horizontalConstraint={getConstraint(gameState.currentGame.h_constraints, row, col, BOARD_SIZE - 1)}
              verticalConstraint={getConstraint(gameState.currentGame.v_constraints, row, col, BOARD_SIZE)}
              hasError={errorStore.hasError(row, col)}
              hasConstraintViolation={errorStore.hasConstraintViolation(row, col)}
              isHinted={isHinted(row, col)}
            />
          {/each}
        {/each}
      </div>
    </div>

    <GameStatus 
      gameState={gameState.currentGame}
      formattedTime={gameStore.formattedTime}
    />

    <DelayedValidationErrors />

  {:else}
    <div class="empty-board">
      <p>Start a new puzzle when you are ready.</p>
    </div>
  {/if}
</div>

<style>
  .game-board {
    min-width: fit-content;
    width: fit-content;
    margin: 0 auto;
    padding: 0.35rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.75rem;
    background: var(--surface-raised);
    box-shadow: 0 18px 40px var(--shadow-color);
    max-width: 100%;
    overflow: hidden;
  }
  
  
  .game-board-container {
    max-width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  /* Ensure the game board is centered and properly sized on mobile */
  @media (max-width: 640px) {
    .game-board-container {
      max-width: calc(100vw - 1rem);
    }
    
    .game-board {
      max-width: 100%;
    }
  }

  .empty-board { box-sizing: border-box; width: min(calc(100% - 0.5rem), 23rem); padding: 3rem 1rem; border: 1px dashed var(--border-primary); border-radius: 0.75rem; color: var(--text-secondary); text-align: center; }
</style>
