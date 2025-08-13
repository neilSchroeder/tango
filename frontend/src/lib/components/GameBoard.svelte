<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';
  import { errorStore } from '../stores/errorStore.svelte';
  import GameTile from './GameTile.svelte';
  import GameStatus from './GameStatus.svelte';
  import HintDisplay from './HintDisplay.svelte';
  import type { ConstraintType } from '../api/types';

  const { state: gameState } = gameStore;

  // Update error highlights when game state changes
  $effect(() => {
    console.log('🔄 GameBoard effect triggered - updating error store');
    errorStore.updateErrors(gameState.currentGame);
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
    <div class="game-board bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg transition-colors duration-300">
      <div class="grid grid-cols-6 gap-0">
        {#each Array(6) as _, row}
          {#each Array(6) as _, col}
            <GameTile
              {row}
              {col}
              piece={gameState.currentGame.board[row][col]}
              isLocked={gameState.currentGame.locked_tiles[row][col]}
              horizontalConstraint={getConstraint(gameState.currentGame.h_constraints, row, col, 4)}
              verticalConstraint={getConstraint(gameState.currentGame.v_constraints, row, col, 4)}
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
      validationErrors={gameState.validationErrors}
    />

    <HintDisplay hint={gameState.currentHint} />
  {:else}
    <div class="game-board bg-gray-200 p-8 rounded-lg text-center">
      <p class="text-gray-600">No game loaded. Create a new game to start playing!</p>
    </div>
  {/if}
</div>

<style>
  .game-board {
    min-width: fit-content;
    width: fit-content;
    margin: 0 auto;
    transition: box-shadow 0.3s ease-in-out;
  }
  
  .game-board:hover {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
  }
  
  .game-board-container {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
