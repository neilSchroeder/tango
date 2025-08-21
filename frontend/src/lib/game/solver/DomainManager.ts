/**
 * Domain Management for constraint-based solving
 * Handles domain initialization, state management, and constraint propagation
 */

import type { DomainState, VariableDomain } from './types';
import { PieceType, BOARD_SIZE } from '../types';
import { positionToKey } from './types';

export class DomainManager {
  private size: number = BOARD_SIZE;

  /**
   * Initialize domains for all positions on the board
   */
  initializeDomains(
    board: PieceType[][],
    lockedTiles: boolean[][]
  ): Map<string, VariableDomain> {
    const domains = new Map<string, VariableDomain>();

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const key = positionToKey(row, col);
        const isLocked = lockedTiles[row][col];
        const currentPiece = board[row][col];

        const domain: VariableDomain = {
          position: [row, col],
          possibleValues: new Set<PieceType>(),
          isLocked
        };

        if (isLocked && currentPiece !== PieceType.EMPTY) {
          // Locked piece - domain contains only the current value
          domain.possibleValues.add(currentPiece);
        } else if (!isLocked) {
          // Unlocked position - can be either SUN or MOON
          domain.possibleValues.add(PieceType.SUN);
          domain.possibleValues.add(PieceType.MOON);
        }

        domains.set(key, domain);
      }
    }

    return domains;
  }

  /**
   * Create a new domain state
   */
  createDomainState(
    domains: Map<string, VariableDomain>,
    constraintNetwork: any
  ): DomainState {
    // Deep copy domains to avoid modifying original
    const domainsCopy = new Map<string, VariableDomain>();
    
    for (const [key, domain] of domains) {
      domainsCopy.set(key, {
        position: [domain.position[0], domain.position[1]],
        possibleValues: new Set(domain.possibleValues),
        isLocked: domain.isLocked,
        decisionLevel: domain.decisionLevel,
        reason: domain.reason
      });
    }

    return {
      domains: domainsCopy,
      constraints: {
        ...constraintNetwork,
        learnedClauses: [...constraintNetwork.learnedClauses]
      },
      decisionLevel: 0,
      assignments: []
    };
  }

  /**
   * Convert domain state back to a board representation
   */
  domainStateToBoard(domainState: DomainState): PieceType[][] {
    const board: PieceType[][] = Array(this.size).fill(null)
      .map(() => Array(this.size).fill(PieceType.EMPTY));

    for (const [key, domain] of domainState.domains) {
      const [row, col] = domain.position;
      
      if (domain.possibleValues.size === 1) {
        // Domain is resolved to a single value
        board[row][col] = Array.from(domain.possibleValues)[0];
      } else {
        // Domain is not yet resolved
        board[row][col] = PieceType.EMPTY;
      }
    }

    return board;
  }

  /**
   * Check if domain state represents a complete solution
   */
  isComplete(domainState: DomainState): boolean {
    for (const [, domain] of domainState.domains) {
      if (domain.possibleValues.size !== 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if domain state has any conflicts (empty domains)
   */
  hasConflicts(domainState: DomainState): boolean {
    for (const [, domain] of domainState.domains) {
      if (domain.possibleValues.size === 0 && !domain.isLocked) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all unassigned variables (domains with multiple possible values)
   */
  getUnassignedVariables(domainState: DomainState): string[] {
    const unassigned: string[] = [];
    
    for (const [key, domain] of domainState.domains) {
      if (domain.possibleValues.size > 1) {
        unassigned.push(key);
      }
    }
    
    return unassigned;
  }

  /**
   * Get all variables that have been assigned a value
   */
  getAssignedVariables(domainState: DomainState): string[] {
    const assigned: string[] = [];
    
    for (const [key, domain] of domainState.domains) {
      if (domain.possibleValues.size === 1) {
        assigned.push(key);
      }
    }
    
    return assigned;
  }

  /**
   * Get the assigned value for a variable (if it has been assigned)
   */
  getAssignedValue(domainState: DomainState, variable: string): PieceType | null {
    const domain = domainState.domains.get(variable);
    if (domain && domain.possibleValues.size === 1) {
      return Array.from(domain.possibleValues)[0];
    }
    return null;
  }

  /**
   * Count how many variables are assigned each value
   */
  countAssignedValues(domainState: DomainState): {
    sun: number;
    moon: number;
    empty: number;
  } {
    let sun = 0;
    let moon = 0;
    let empty = 0;

    for (const [, domain] of domainState.domains) {
      if (domain.possibleValues.size === 1) {
        const value = Array.from(domain.possibleValues)[0];
        if (value === PieceType.SUN) {
          sun++;
        } else if (value === PieceType.MOON) {
          moon++;
        }
      } else {
        empty++;
      }
    }

    return { sun, moon, empty };
  }

  /**
   * Deep copy a domain state
   */
  copyDomainState(domainState: DomainState): DomainState {
    return this.createDomainState(domainState.domains, domainState.constraints);
  }

  /**
   * Validate that a domain state is consistent with game rules
   */
  isValid(domainState: DomainState): boolean {
    const board = this.domainStateToBoard(domainState);
    
    // Check that assigned positions don't violate basic rules
    return this.validateBoardState(board);
  }

  /**
   * Basic validation of board state (for assigned positions only)
   */
  private validateBoardState(board: PieceType[][]): boolean {
    // Check for three consecutive identical pieces
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col <= this.size - 3; col++) {
        if (board[row][col] !== PieceType.EMPTY &&
            board[row][col] === board[row][col + 1] &&
            board[row][col + 1] === board[row][col + 2]) {
          return false;
        }
      }
    }

    for (let col = 0; col < this.size; col++) {
      for (let row = 0; row <= this.size - 3; row++) {
        if (board[row][col] !== PieceType.EMPTY &&
            board[row][col] === board[row + 1][col] &&
            board[row + 1][col] === board[row + 2][col]) {
          return false;
        }
      }
    }

    // Check row/column balance (if fully assigned)
    const maxPerRowCol = this.size / 2;
    
    for (let row = 0; row < this.size; row++) {
      let sunCount = 0, moonCount = 0;
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.SUN) sunCount++;
        else if (board[row][col] === PieceType.MOON) moonCount++;
      }
      
      if (sunCount > maxPerRowCol || moonCount > maxPerRowCol) {
        return false;
      }
    }

    for (let col = 0; col < this.size; col++) {
      let sunCount = 0, moonCount = 0;
      for (let row = 0; row < this.size; row++) {
        if (board[row][col] === PieceType.SUN) sunCount++;
        else if (board[row][col] === PieceType.MOON) moonCount++;
      }
      
      if (sunCount > maxPerRowCol || moonCount > maxPerRowCol) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get statistics about the current domain state
   */
  getStatistics(domainState: DomainState): {
    totalVariables: number;
    assignedVariables: number;
    unassignedVariables: number;
    conflictedVariables: number;
    averageDomainSize: number;
  } {
    let assigned = 0;
    let conflicted = 0;
    let totalDomainSize = 0;

    for (const [, domain] of domainState.domains) {
      if (domain.possibleValues.size === 1) {
        assigned++;
      } else if (domain.possibleValues.size === 0) {
        conflicted++;
      }
      totalDomainSize += domain.possibleValues.size;
    }

    const total = domainState.domains.size;
    const unassigned = total - assigned - conflicted;

    return {
      totalVariables: total,
      assignedVariables: assigned,
      unassignedVariables: unassigned,
      conflictedVariables: conflicted,
      averageDomainSize: total > 0 ? totalDomainSize / total : 0
    };
  }
}
