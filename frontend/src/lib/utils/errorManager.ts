/**
 * Simplified constraint and error state management
 */

import type { GameState } from '../api/types';
import { createTileId } from './gameUtils';

export class ErrorHighlightManager {
  private delayedViolations = new Set<string>();
  private delayedInvalidTiles = new Set<string>();
  private highlightTimeout: ReturnType<typeof setTimeout> | null = null;
  private previousViolations = new Set<string>();
  private previousInvalidTiles = new Set<string>();

  updateErrorHighlights(gameState: GameState | null): void {
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
      this.highlightTimeout = null;
    }

    const currentViolations = gameState?.constraintViolations || new Set();
    const currentInvalidTiles = gameState?.invalidStateTiles || new Set();

    // Clear resolved violations immediately
    this.clearResolvedViolations(currentViolations, currentInvalidTiles);

    // If no violations, clear all highlights
    if (currentViolations.size === 0 && currentInvalidTiles.size === 0) {
      this.delayedViolations.clear();
      this.delayedInvalidTiles.clear();
      return;
    }

    // Find new violations
    const newViolations = this.getNewViolations(currentViolations, this.previousViolations);
    const newInvalidTiles = this.getNewViolations(currentInvalidTiles, this.previousInvalidTiles);

    // Set delayed highlighting for new violations
    if (newViolations.length > 0 || newInvalidTiles.length > 0) {
      this.setDelayedHighlighting(newViolations, newInvalidTiles, currentViolations, currentInvalidTiles);
    }

    // Update previous state
    this.previousViolations = new Set(currentViolations);
    this.previousInvalidTiles = new Set(currentInvalidTiles);
  }

  hasError(row: number, col: number): boolean {
    const tileId = createTileId(row, col);
    return this.delayedViolations.has(tileId) || this.delayedInvalidTiles.has(tileId);
  }

  hasConstraintViolation(row: number, col: number): boolean {
    const tileId = createTileId(row, col);
    return this.delayedViolations.has(tileId);
  }

  private clearResolvedViolations(currentViolations: Set<string>, currentInvalidTiles: Set<string>): void {
    const resolvedViolations = [...this.delayedViolations].filter(v => !currentViolations.has(v));
    const resolvedInvalidTiles = [...this.delayedInvalidTiles].filter(v => !currentInvalidTiles.has(v));

    if (resolvedViolations.length > 0) {
      resolvedViolations.forEach(v => this.delayedViolations.delete(v));
    }

    if (resolvedInvalidTiles.length > 0) {
      resolvedInvalidTiles.forEach(v => this.delayedInvalidTiles.delete(v));
    }
  }

  private getNewViolations(current: Set<string>, previous: Set<string>): string[] {
    return [...current].filter(v => !previous.has(v));
  }

  private setDelayedHighlighting(
    newViolations: string[],
    newInvalidTiles: string[],
    currentViolations: Set<string>,
    currentInvalidTiles: Set<string>
  ): void {
    this.highlightTimeout = setTimeout(() => {
      newViolations.forEach(v => {
        if (currentViolations.has(v)) {
          this.delayedViolations.add(v);
        }
      });

      newInvalidTiles.forEach(v => {
        if (currentInvalidTiles.has(v)) {
          this.delayedInvalidTiles.add(v);
        }
      });
    }, 1500);
  }
}
