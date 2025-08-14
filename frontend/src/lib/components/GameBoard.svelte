<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';
  import { errorStore } from '../stores/errorStore.svelte';
  import GameTile from './GameTile.svelte';
  import GameStatus from './GameStatus.svelte';
  import HintDisplay from './HintDisplay.svelte';
  import DelayedValidationErrors from './DelayedValidationErrors.svelte';
  import type { ConstraintType } from '../api/types';

  const { state: gameState } = gameStore;

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
    <div class="game-board bg-white dark:bg-gray-800 p-3 sm:p-4 md:p-6 rounded-xl shadow-lg transition-colors duration-300">
      <div class="grid grid-cols-6 gap-0 w-fit mx-auto">
        {#each Array(6) as _, row}
          {#each Array(6) as _, col}
            <GameTile
              {row}
              {col}
              piece={gameState.currentGame.board[row][col]}
              isLocked={gameState.currentGame.locked_tiles[row][col]}
              isGameComplete={gameState.currentGame.is_complete}
              horizontalConstraint={getConstraint(gameState.currentGame.h_constraints, row, col, 5)}
              verticalConstraint={getConstraint(gameState.currentGame.v_constraints, row, col, 5)}
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

    <HintDisplay hint={gameState.currentHint} />
  {:else}
    <div class="game-board bg-gray-200 p-6 sm:p-8 rounded-lg text-center">
      <p class="text-gray-600 text-sm sm:text-base">No game loaded. Create a new game to start playing!</p>
    </div>
  {/if}
</div>

<style>
  .game-board {
    min-width: fit-content;
    width: fit-content;
    margin: 0 auto;
    transition: box-shadow 0.3s ease-in-out;
    /* Ensure the board doesn't overflow on small screens */
    max-width: 100%;
    overflow: hidden;
  }
  
  .game-board:hover {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
  }
  
  .game-board-container {
    max-width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Responsive max-width */
    width: fit-content;
  }

  /* Ensure the game board is centered and properly sized on mobile */
  @media (max-width: 640px) {
    .game-board-container {
      max-width: calc(100vw - 0.5rem);
      padding: 0 0.25rem;
    }
    
    .game-board {
      max-width: calc(100vw - 1rem);
    }
  }
</style>
