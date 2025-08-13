/**
 * Reactive error highlighting store using Svelte 5 runes
 */

import type { GameState } from '../api/types';

interface ErrorState {
  constraintViolations: Set<string>;
  invalidStateTiles: Set<string>;
  delayedConstraintViolations: Set<string>;
  delayedInvalidStateTiles: Set<string>;
}

function createErrorStore() {
  // Reactive state using Svelte 5 runes
  let state = $state<ErrorState>({
    constraintViolations: new Set(),
    invalidStateTiles: new Set(),
    delayedConstraintViolations: new Set(),
    delayedInvalidStateTiles: new Set()
  });

  let delayTimeout: ReturnType<typeof setTimeout> | null = null;

  function updateErrors(gameState: GameState | null) {
    // Clear any pending timeout
    if (delayTimeout) {
      clearTimeout(delayTimeout);
      delayTimeout = null;
    }

    // Get current violations from game state
    const currentConstraintViolations = gameState?.constraintViolations || new Set();
    const currentInvalidStateTiles = gameState?.invalidStateTiles || new Set();

    // Update immediate state (for debugging and validation display)
    state.constraintViolations = new Set(currentConstraintViolations);
    state.invalidStateTiles = new Set(currentInvalidStateTiles);

    console.log('🎯 Error store updated:', {
      constraintViolations: Array.from(currentConstraintViolations),
      invalidStateTiles: Array.from(currentInvalidStateTiles)
    });

    // If no violations, clear all delayed highlights immediately
    if (currentConstraintViolations.size === 0 && currentInvalidStateTiles.size === 0) {
      console.log('🧹 No violations - clearing all delayed highlights immediately');
      state.delayedConstraintViolations = new Set();
      state.delayedInvalidStateTiles = new Set();
      return;
    }

    // Clear previous delayed highlights before setting new ones
    state.delayedConstraintViolations = new Set();
    state.delayedInvalidStateTiles = new Set();

    // If there are violations, set delayed highlighting
    delayTimeout = setTimeout(() => {
      console.log('✨ Applying delayed error highlighting');
      state.delayedConstraintViolations = new Set(currentConstraintViolations);
      state.delayedInvalidStateTiles = new Set(currentInvalidStateTiles);
      
      console.log('📊 Delayed highlighting applied:', {
        delayedConstraintViolations: Array.from(state.delayedConstraintViolations),
        delayedInvalidStateTiles: Array.from(state.delayedInvalidStateTiles)
      });
    }, 1500); // 1.5 second delay
  }

  function hasError(row: number, col: number): boolean {
    const tileId = `${row},${col}`;
    const hasConstraintViolation = state.delayedConstraintViolations.has(tileId);
    const hasInvalidState = state.delayedInvalidStateTiles.has(tileId);
    
    const hasAnyError = hasConstraintViolation || hasInvalidState;
    
    // Debug logging for a specific tile that should be highlighted
    if (row === 3 && col === 0) {
      console.log(`🐛 Checking error state for tile (${row},${col}): constraint=${hasConstraintViolation}, invalid=${hasInvalidState}, total=${hasAnyError}`);
      console.log(`🐛 Current delayed violations:`, Array.from(state.delayedConstraintViolations));
      console.log(`🐛 Current delayed invalid tiles:`, Array.from(state.delayedInvalidStateTiles));
    }
    
    return hasAnyError;
  }

  function hasConstraintViolation(row: number, col: number): boolean {
    const tileId = `${row},${col}`;
    return state.delayedConstraintViolations.has(tileId);
  }

  function hasInvalidState(row: number, col: number): boolean {
    const tileId = `${row},${col}`;
    return state.delayedInvalidStateTiles.has(tileId);
  }

  function getImmediateViolations(): string[] {
    return Array.from(state.constraintViolations);
  }

  function getImmediateInvalidTiles(): string[] {
    return Array.from(state.invalidStateTiles);
  }

  return {
    // State access
    get state() { return state; },
    
    // Methods
    updateErrors,
    hasError,
    hasConstraintViolation,
    hasInvalidState,
    getImmediateViolations,
    getImmediateInvalidTiles
  };
}

// Export singleton instance
export const errorStore = createErrorStore();
