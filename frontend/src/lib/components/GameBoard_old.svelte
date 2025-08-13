<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';
  import GameTile from './GameTile.svelte';
  import GameStatus from './GameStatus.svelte';
  import HintDisplay from './HintDisplay.svelte';
  import { ErrorHighlightManager } from '../utils/errorManager';
  import type { ConstraintType } from '../api/types';

  const { state: gameState } = gameStore;
  const errorManager = new ErrorHighlightManager();

  // Update error highlights when game state changes
  $effect(() => {
    errorManager.updateErrorHighlights(gameState.currentGame);
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
    <div class="game-board bg-white p-6 rounded-xl shadow-lg">
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
              hasError={errorManager.hasError(row, col)}
              hasConstraintViolation={errorManager.hasConstraintViolation(row, col)}
              isHinted={isHinted(row, col)}
            />
          {/each}
        {/each}
      </div>
    </div>

    <!-- Game status -->
    <div class="mt-4 text-center">
      {#if gameState.currentGame.is_complete}
        <div class="text-green-600 font-bold text-xl">
          🎉 Puzzle Complete! 🎉
        </div>
        {#if gameState.currentGame.completion_time}
          <div class="text-gray-600 mt-2">
            Completed in {gameStore.formattedTime}
          </div>
        {/if}
      {:else}
        <div class="text-lg font-semibold">
          Time: {gameStore.formattedTime}
        </div>
        <div class="text-sm text-gray-600 mt-1">
          Moves: {gameState.currentGame.moves_count}
        </div>
      {/if}
    </div>

    <!-- Validation errors -->
    {#if gameState.validationErrors.length > 0}
      <div class="mt-4 p-3 bg-red-100 border border-red-300 rounded">
        <h4 class="font-semibold text-red-800 mb-2">Rule Violations:</h4>
        <ul class="text-sm text-red-700 list-disc list-inside">
          {#each gameState.validationErrors as error}
            <li>{error}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Hint display -->
    {#if gameState.currentHint}
      <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 class="font-semibold text-blue-800 mb-2">💡 Hint</h4>
        <p class="text-sm text-blue-700">
          {gameState.currentHint.reasoning}
        </p>
        {#if gameState.currentHint.found && gameState.currentHint.row !== undefined && gameState.currentHint.col !== undefined}
          <p class="text-xs text-blue-600 mt-2">
            Suggested move: Place a {gameState.currentHint.piece_type} at row {gameState.currentHint.row + 1}, column {gameState.currentHint.col + 1}
          </p>
        {/if}
      </div>
    {/if}
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
            />
          {/each}
        {/each}
      </div>
    </div>

    <!-- Game status -->
    <div class="mt-4 text-center">
      {#if gameState.currentGame.is_complete}
        <div class="text-green-600 font-bold text-xl">
          🎉 Puzzle Complete! 🎉
        </div>
        {#if gameState.currentGame.completion_time}
          <div class="text-gray-600 mt-2">
            Completed in {gameStore.formattedTime}
          </div>
        {/if}
      {:else}
        <div class="text-lg font-semibold">
          Time: {gameStore.formattedTime}
        </div>
        <div class="text-sm text-gray-600 mt-1">
          Moves: {gameState.currentGame.moves_count}
        </div>
      {/if}
    </div>

    <!-- Validation errors -->
    {#if gameState.validationErrors.length > 0}
      <div class="mt-4 p-3 bg-red-100 border border-red-300 rounded">
        <h4 class="font-semibold text-red-800 mb-2">Rule Violations:</h4>
        <ul class="text-sm text-red-700 list-disc list-inside">
          {#each gameState.validationErrors as error}
            <li>{error}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Hint display -->
    {#if gameState.currentHint}
      <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 class="font-semibold text-blue-800 mb-2">💡 Hint</h4>
        <p class="text-sm text-blue-700">
          {gameState.currentHint.reasoning}
        </p>
        {#if gameState.currentHint.found && gameState.currentHint.row !== undefined && gameState.currentHint.col !== undefined}
          <p class="text-xs text-blue-600 mt-2">
            Suggested move: Place a {gameState.currentHint.piece_type} at row {gameState.currentHint.row + 1}, column {gameState.currentHint.col + 1}
          </p>
        {/if}
      </div>
    {/if}
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