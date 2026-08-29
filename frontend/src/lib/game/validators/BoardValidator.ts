import { PieceType, BOARD_SIZE, createEmptyBoard } from '../types';

export class BoardValidator {
  constructor(private readonly size: number = BOARD_SIZE) {}

  isValidCompleteBoard(board: PieceType[][]): boolean {
    return (
      this.hasValidDistribution(board) &&
      this.hasNoConsecutiveViolations(board)
    );
  }

  validatePlacement(board: PieceType[][], row: number, col: number, piece: PieceType): boolean {
    const original = board[row][col];
    board[row][col] = piece;
    
    const isValid = 
      this.checkConsecutiveAt(board, row, col, 'horizontal') &&
      this.checkConsecutiveAt(board, row, col, 'vertical') &&
      this.checkDistributionConstraints(board, row, col, piece);
    
    board[row][col] = original;
    return isValid;
  }

  private hasValidDistribution(board: PieceType[][]): boolean {
    const expectedCount = this.size / 2;

    for (let row = 0; row < this.size; row++) {
      const counts = this.countPiecesInRow(board, row);
      if (counts.suns !== expectedCount || counts.moons !== expectedCount) {
        return false;
      }
    }

    for (let col = 0; col < this.size; col++) {
      const counts = this.countPiecesInCol(board, col);
      if (counts.suns !== expectedCount || counts.moons !== expectedCount) {
        return false;
      }
    }

    return true;
  }

  private hasNoConsecutiveViolations(board: PieceType[][]): boolean {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (
          !this.checkConsecutiveAt(board, row, col, 'horizontal') ||
          !this.checkConsecutiveAt(board, row, col, 'vertical')
        ) {
          return false;
        }
      }
    }
    return true;
  }

  checkConsecutiveAt(
    board: PieceType[][],
    row: number,
    col: number,
    direction: 'horizontal' | 'vertical'
  ): boolean {
    const piece = board[row][col];
    if (piece === PieceType.EMPTY) return true;

    const [dr, dc] = direction === 'horizontal' ? [0, 1] : [1, 0];
    let count = 1;
    
    // Count backward
    let r = row - dr, c = col - dc;
    while (this.isValidPosition(r, c) && board[r][c] === piece) {
      count++;
      r -= dr;
      c -= dc;
    }
    
    // Count forward
    r = row + dr;
    c = col + dc;
    while (this.isValidPosition(r, c) && board[r][c] === piece) {
      count++;
      r += dr;
      c += dc;
    }
    
    return count <= 2;
  }

  countPiecesInRow(board: PieceType[][], row: number): { suns: number; moons: number } {
    let suns = 0, moons = 0;
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
    }
    return { suns, moons };
  }

  countPiecesInCol(board: PieceType[][], col: number): { suns: number; moons: number } {
    let suns = 0, moons = 0;
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
    }
    return { suns, moons };
  }

  isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  isBoardComplete(board: PieceType[][]): boolean {
    return board.every(row => row.every(cell => cell !== PieceType.EMPTY));
  }

  boardsMatch(board1: PieceType[][], board2: PieceType[][]): boolean {
    return board1.every((row, i) => 
      row.every((cell, j) => cell === board2[i][j])
    );
  }

  private checkDistributionConstraints(
    board: PieceType[][],
    row: number,
    col: number,
    piece: PieceType
  ): boolean {
    const maxAllowed = this.size / 2;
    const rowCounts = this.countPiecesInRow(board, row);
    const colCounts = this.countPiecesInCol(board, col);
    
    if (piece === PieceType.SUN) {
      return rowCounts.suns <= maxAllowed && colCounts.suns <= maxAllowed;
    } else {
      return rowCounts.moons <= maxAllowed && colCounts.moons <= maxAllowed;
    }
  }
}