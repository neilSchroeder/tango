/**
 * Core game logic for Tango puzzle - equivalent to Python's GameLogic class
 * Ported from backend/original_src/game_logic.py
 */

import { PieceType, ConstraintType, BOARD_SIZE, type HintResult } from './types';

export class GameLogic {
  private size: number;
  private board: PieceType[][];
  private hConstraints: ConstraintType[][];
  private vConstraints: ConstraintType[][];
  private lockedTiles: boolean[][];

  constructor(size: number = BOARD_SIZE) {
    this.size = size;
    this.board = Array(size).fill(null).map(() => Array(size).fill(PieceType.EMPTY));
    this.hConstraints = Array(size).fill(null).map(() => Array(size - 1).fill(ConstraintType.NONE));
    this.vConstraints = Array(size - 1).fill(null).map(() => Array(size).fill(ConstraintType.NONE));
    this.lockedTiles = Array(size).fill(null).map(() => Array(size).fill(false));
  }

  /**
   * Reset the board to empty state
   */
  resetBoard(): void {
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(PieceType.EMPTY));
    this.lockedTiles = Array(this.size).fill(null).map(() => Array(this.size).fill(false));
  }

  /**
   * Place a piece on the board
   */
  placePiece(row: number, col: number, piece: PieceType): boolean {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      this.board[row][col] = piece;
      return true;
    }
    return false;
  }

  /**
   * Check if a piece can be placed at the given position (not locked)
   */
  canPlacePiece(row: number, col: number): boolean {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      return !this.lockedTiles[row][col];
    }
    return false;
  }

  /**
   * Lock a tile so it cannot be changed by the player
   */
  lockTile(row: number, col: number): void {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      this.lockedTiles[row][col] = true;
    }
  }

  /**
   * Check if a tile is locked
   */
  isTileLocked(row: number, col: number): boolean {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      return this.lockedTiles[row][col];
    }
    return false;
  }

  /**
   * Get the piece at the given position
   */
  getPiece(row: number, col: number): PieceType {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      return this.board[row][col];
    }
    return PieceType.EMPTY;
  }

  /**
   * Set horizontal constraint between (row, col) and (row, col+1)
   */
  setHorizontalConstraint(row: number, col: number, constraint: ConstraintType): void {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size - 1) {
      this.hConstraints[row][col] = constraint;
    }
  }

  /**
   * Set vertical constraint between (row, col) and (row+1, col)
   */
  setVerticalConstraint(row: number, col: number, constraint: ConstraintType): void {
    if (row >= 0 && row < this.size - 1 && col >= 0 && col < this.size) {
      this.vConstraints[row][col] = constraint;
    }
  }

  /**
   * Get horizontal constraint between (row, col) and (row, col+1)
   */
  getHorizontalConstraint(row: number, col: number): ConstraintType {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size - 1) {
      return this.hConstraints[row][col];
    }
    return ConstraintType.NONE;
  }

  /**
   * Get vertical constraint between (row, col) and (row+1, col)
   */
  getVerticalConstraint(row: number, col: number): ConstraintType {
    if (row >= 0 && row < this.size - 1 && col >= 0 && col < this.size) {
      return this.vConstraints[row][col];
    }
    return ConstraintType.NONE;
  }

  /**
   * Count suns and moons in the given row
   */
  countPiecesInRow(row: number): [number, number] {
    const suns = this.board[row].filter(piece => piece === PieceType.SUN).length;
    const moons = this.board[row].filter(piece => piece === PieceType.MOON).length;
    return [suns, moons];
  }

  /**
   * Count suns and moons in the given column
   */
  countPiecesInColumn(col: number): [number, number] {
    const suns = Array.from({length: this.size}, (_, row) => this.board[row][col])
      .filter(piece => piece === PieceType.SUN).length;
    const moons = Array.from({length: this.size}, (_, row) => this.board[row][col])
      .filter(piece => piece === PieceType.MOON).length;
    return [suns, moons];
  }

  /**
   * Check if there are three consecutive pieces of the same type in a row
   */
  hasThreeConsecutiveInRow(row: number): boolean {
    for (let col = 0; col < this.size - 2; col++) {
      if (this.board[row][col] !== PieceType.EMPTY &&
          this.board[row][col] === this.board[row][col + 1] &&
          this.board[row][col + 1] === this.board[row][col + 2]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if there are three consecutive pieces of the same type in a column
   */
  hasThreeConsecutiveInColumn(col: number): boolean {
    for (let row = 0; row < this.size - 2; row++) {
      if (this.board[row][col] !== PieceType.EMPTY &&
          this.board[row][col] === this.board[row + 1][col] &&
          this.board[row + 1][col] === this.board[row + 2][col]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for constraint violations and return list of violations
   */
  checkConstraintViolations(): Array<{row: number, col: number, type: string}> {
    const violations: Array<{row: number, col: number, type: string}> = [];

    // Check horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        const constraint = this.hConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const piece1 = this.board[row][col];
          const piece2 = this.board[row][col + 1];

          if (piece1 !== PieceType.EMPTY && piece2 !== PieceType.EMPTY) {
            if (constraint === ConstraintType.SAME && piece1 !== piece2) {
              violations.push({row, col, type: 'horizontal_same'});
              violations.push({row, col: col + 1, type: 'horizontal_same'});
            } else if (constraint === ConstraintType.DIFFERENT && piece1 === piece2) {
              violations.push({row, col, type: 'horizontal_different'});
              violations.push({row, col: col + 1, type: 'horizontal_different'});
            }
          }
        }
      }
    }

    // Check vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        const constraint = this.vConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const piece1 = this.board[row][col];
          const piece2 = this.board[row + 1][col];

          if (piece1 !== PieceType.EMPTY && piece2 !== PieceType.EMPTY) {
            if (constraint === ConstraintType.SAME && piece1 !== piece2) {
              violations.push({row, col, type: 'vertical_same'});
              violations.push({row: row + 1, col, type: 'vertical_same'});
            } else if (constraint === ConstraintType.DIFFERENT && piece1 === piece2) {
              violations.push({row, col, type: 'vertical_different'});
              violations.push({row: row + 1, col, type: 'vertical_different'});
            }
          }
        }
      }
    }

    return violations;
  }

  /**
   * Get validation result mirroring Python backend structure
   */
  getValidationState(): {
    constraintViolations: Array<{row: number, col: number, type: string}>;
    isValidState: boolean;
  } {
    const constraintViolations = this.checkConstraintViolations();
    const isValidState = this.isValidState();
    
    return {
      constraintViolations,
      isValidState
    };
  }

  /**
   * Check if the current board state is valid
   */
  isValidState(): boolean {
    const maxPiecesPerRowCol = 3; // MAX_PIECES_PER_ROW_COL from config

    // Check row/column piece counts
    for (let i = 0; i < this.size; i++) {
      const [sunsRow, moonsRow] = this.countPiecesInRow(i);
      const [sunsCol, moonsCol] = this.countPiecesInColumn(i);

      // Each row/column should have at most maxPiecesPerRowCol suns and moons
      if (sunsRow > maxPiecesPerRowCol || moonsRow > maxPiecesPerRowCol ||
          sunsCol > maxPiecesPerRowCol || moonsCol > maxPiecesPerRowCol) {
        return false;
      }

      // Check for three consecutive pieces
      if (this.hasThreeConsecutiveInRow(i) || this.hasThreeConsecutiveInColumn(i)) {
        return false;
      }
    }

    // Check constraint violations
    if (this.checkConstraintViolations().length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Check if the puzzle is complete and correctly solved
   */
  isComplete(): boolean {
    const maxPiecesPerRowCol = 3; // MAX_PIECES_PER_ROW_COL from config

    // Check that all cells are filled
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.board[row][col] === PieceType.EMPTY) {
          return false;
        }
      }
    }

    // Check that each row and column has exactly maxPiecesPerRowCol suns and moons
    for (let i = 0; i < this.size; i++) {
      const [sunsRow, moonsRow] = this.countPiecesInRow(i);
      const [sunsCol, moonsCol] = this.countPiecesInColumn(i);

      if (sunsRow !== maxPiecesPerRowCol || moonsRow !== maxPiecesPerRowCol ||
          sunsCol !== maxPiecesPerRowCol || moonsCol !== maxPiecesPerRowCol) {
        return false;
      }
    }

    return this.isValidState();
  }

  /**
   * Get a hint for the next move
   */
  getHint(): HintResult | null {
    // Find cells that can only have one valid piece type
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.board[row][col] === PieceType.EMPTY) {
          const validPieces: PieceType[] = [];

          for (const pieceType of [PieceType.SUN, PieceType.MOON]) {
            // Temporarily place the piece
            this.board[row][col] = pieceType;
            if (this.isValidState()) {
              validPieces.push(pieceType);
            }
            // Remove the piece
            this.board[row][col] = PieceType.EMPTY;
          }

          // If only one piece type is valid, return it as a hint with detailed reasoning
          if (validPieces.length === 1) {
            const validPiece = validPieces[0];
            const invalidPiece = validPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            const detailedReasoning = this.getDetailedReasoningForPosition(row, col, validPiece, invalidPiece);
            
            return {
              found: true,
              row,
              col,
              pieceType: validPiece,
              reasoning: detailedReasoning,
              confidence: 1.0,
              hintType: 'logical_deduction',
              educationalValue: 'high'
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the current board state
   */
  getBoard(): PieceType[][] {
    return this.board.map(row => [...row]);
  }

  /**
   * Get the current constraint state
   */
  getConstraints(): {h: ConstraintType[][], v: ConstraintType[][]} {
    return {
      h: this.hConstraints.map(row => [...row]),
      v: this.vConstraints.map(row => [...row])
    };
  }

  /**
   * Get the current locked tiles state
   */
  getLockedTiles(): boolean[][] {
    return this.lockedTiles.map(row => [...row]);
  }
}
