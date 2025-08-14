/**
 * Reactive error highlighting store using Svelte 5 runes
 */

import type { GameState } from '../api/types';

interface ErrorState {
  constraintViolations: Set<string>;
  invalidStateTiles: Set<string>;
  delayedConstraintViolations: Set<string>;
  delayedInvalidStateTiles: Set<string>;
  validationErrors: string[];
  delayedValidationErrors: string[];
}

function createErrorStore() {
  // Reactive state using Svelte 5 runes
  let state = $state<ErrorState>({
    constraintViolations: new Set(),
    invalidStateTiles: new Set(),
    delayedConstraintViolations: new Set(),
    delayedInvalidStateTiles: new Set(),
    validationErrors: [],
    delayedValidationErrors: []
  });

  let delayTimeout: ReturnType<typeof setTimeout> | null = null;

  function updateErrors(gameState: GameState | null, validationErrors: string[] = []) {
    try {
      // Clear any pending timeout first
      if (delayTimeout) {
        clearTimeout(delayTimeout);
        delayTimeout = null;
      }

      // Prevent excessive updates if state hasn't changed
      if (!gameState) {
        // Clear all highlights when no game state
        state.constraintViolations = new Set();
        state.invalidStateTiles = new Set();
        state.delayedConstraintViolations = new Set();
        state.delayedInvalidStateTiles = new Set();
        state.validationErrors = [];
        state.delayedValidationErrors = [];
        return;
      }

      // Get current violations from game state
      const currentConstraintViolations = gameState?.constraintViolations || new Set();
      const currentInvalidStateTiles = gameState?.invalidStateTiles || new Set();
      const currentValidationErrors = validationErrors;

      // Update immediate state (for debugging and validation display)
      state.constraintViolations = new Set(currentConstraintViolations);
      state.invalidStateTiles = new Set(currentInvalidStateTiles);
      state.validationErrors = [...currentValidationErrors];

      // If no violations, clear all delayed highlights immediately
      if (currentConstraintViolations.size === 0 && currentInvalidStateTiles.size === 0 && currentValidationErrors.length === 0) {
        state.delayedConstraintViolations = new Set();
        state.delayedInvalidStateTiles = new Set();
        state.delayedValidationErrors = [];
        console.log(`✅ No violations - cleared all highlights`);
        return;
      }

      // Clear previous delayed highlights before setting new ones
      state.delayedConstraintViolations = new Set();
      state.delayedInvalidStateTiles = new Set();
      state.delayedValidationErrors = [];

      console.log(`⏰ Setting delayed highlighting for ${currentConstraintViolations.size} constraint violations, ${currentInvalidStateTiles.size} invalid tiles, and ${currentValidationErrors.length} validation errors`);

      // If there are violations, set delayed highlighting
      delayTimeout = setTimeout(() => {
        try {
          // Double-check the violations still exist (in case state changed during timeout)
          if (gameState && gameState.constraintViolations && gameState.invalidStateTiles) {
            state.delayedConstraintViolations = new Set(gameState.constraintViolations);
            state.delayedInvalidStateTiles = new Set(gameState.invalidStateTiles);
            state.delayedValidationErrors = [...currentValidationErrors];
            console.log(`🎯 Applied delayed highlighting: ${state.delayedConstraintViolations.size} constraint + ${state.delayedInvalidStateTiles.size} invalid + ${state.delayedValidationErrors.length} validation errors`);
          }
        } catch (timeoutError) {
          console.error('❌ Error in delayed highlighting timeout:', timeoutError);
        }
      }, 1000); // 1 second delay for better responsiveness
    } catch (error) {
      console.error('❌ Error in updateErrors:', error);
      // Clear timeout on error to prevent issues
      if (delayTimeout) {
        clearTimeout(delayTimeout);
        delayTimeout = null;
      }
    }
  }

  function hasError(row: number, col: number): boolean {
    const tileId = `${row},${col}`;
    const hasConstraintViolation = state.delayedConstraintViolations.has(tileId);
    const hasInvalidState = state.delayedInvalidStateTiles.has(tileId);
    
    return hasConstraintViolation || hasInvalidState;
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

  function getDelayedValidationErrors(): string[] {
    return [...state.delayedValidationErrors];
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
    getImmediateInvalidTiles,
    getDelayedValidationErrors
  };
}

// Export singleton instance
export const errorStore = createErrorStore();
