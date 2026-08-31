// types.ts - Core types and interfaces
import { PieceType, ConstraintType} from '../types';
import { TangoBoardSolver } from '../solvers/TangoBoardSolver';
import { BoardValidator } from '../validators/BoardValidator';
import { LogicalSolver } from '../solvers/LogicalSolver';
import { ConstraintManager } from '../utils/ConstraintManager';
import { 
  BOARD_SIZE, 
  createEmptyBoard,
  createEmptyHConstraints,
  createEmptyVConstraints,
  createEmptyLockedTiles
} from '../types';

export interface PuzzleConfig {
  name?: string;
  startingPiecesMin: number;
  startingPiecesMax: number;
  constraintProbability: number;
  maxAttempts?: number;
}

export interface GeneratedPuzzle {
  board: PieceType[][];
  hConstraints: ConstraintType[][];
  vConstraints: ConstraintType[][];
  lockedTiles: boolean[][];
}

export interface ConstraintCandidate {
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
  constraint: ConstraintType;
  priority: number;
}


// generators/BoardGenerator.ts
export class BoardGenerator {
  private validator: BoardValidator;

  constructor(private readonly size: number = BOARD_SIZE) {
    this.validator = new BoardValidator(size);
  }

  generateRandomBoard(): PieceType[][] {
    const maxAttempts = 100;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const board = createEmptyBoard();
      
      if (this.fillBoardWithBacktracking(board, 0, 0)) {
        return board;
      }
    }
    
    throw new Error('Failed to generate valid board after maximum attempts');
  }

  private fillBoardWithBacktracking(board: PieceType[][], row: number, col: number): boolean {
    if (row === this.size) {
      return this.validator.isValidCompleteBoard(board);
    }
    
    const [nextRow, nextCol] = this.getNextPosition(row, col);
    const pieceTypes = this.shuffleArray([PieceType.SUN, PieceType.MOON]);
    
    for (const piece of pieceTypes) {
      if (this.validator.validatePlacement(board, row, col, piece)) {
        board[row][col] = piece;
        
        if (this.fillBoardWithBacktracking(board, nextRow, nextCol)) {
          return true;
        }
        
        board[row][col] = PieceType.EMPTY;
      }
    }
    
    return false;
  }

  private getNextPosition(row: number, col: number): [number, number] {
    return col === this.size - 1 ? [row + 1, 0] : [row, col + 1];
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}



// Main PuzzleGenerator class - now clean and focused
export class PuzzleGenerator {
  private readonly size = BOARD_SIZE;
  private boardGenerator: BoardGenerator;
  private validator: BoardValidator;
  private logicalSolver: LogicalSolver;
  private constraintManager: ConstraintManager;
  private uniqueSolver: TangoBoardSolver;

  constructor() {
    this.boardGenerator = new BoardGenerator(this.size);
    this.validator = new BoardValidator(this.size);
    this.logicalSolver = new LogicalSolver(this.size);
    this.constraintManager = new ConstraintManager(this.size);
    this.uniqueSolver = new TangoBoardSolver(
      createEmptyBoard(),
      createEmptyHConstraints(),
      createEmptyVConstraints(),
      createEmptyLockedTiles()
    );
  }

  /**
   * Shuffles an array randomly using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Copies a board to create a new instance
   */
  private copyBoard(board: PieceType[][]): PieceType[][] {
    return board.map(row => [...row]);
  }

  /**
   * Creates a fallback puzzle when normal generation fails
   */
  private createFallbackPuzzle(config: PuzzleConfig): GeneratedPuzzle {
    const solution = this.boardGenerator.generateRandomBoard();
    const board = this.copyBoard(solution);
    const hConstraints = createEmptyHConstraints();
    const vConstraints = createEmptyVConstraints();
    const lockedTiles = createEmptyLockedTiles();
    
    // For fallback puzzles, we'll keep more starting pieces
    const minPiecesToKeep = config.name?.toLowerCase() === 'genius' 
      ? 10 // More pieces for genius fallback
      : 15; // Many pieces for other difficulties
    
    const positions = this.shuffleArray(this.getAllPositions());
    let remainingPieces = this.size * this.size;
    
    // Remove pieces until we reach the minimum
    for (const [row, col] of positions) {
      if (remainingPieces <= minPiecesToKeep) {
        break;
      }
      
      board[row][col] = PieceType.EMPTY;
      remainingPieces--;
    }
    
    // Add some constraints
    const constraintProbability = 0.4; // Higher probability for fallback puzzles
    this.constraintManager.addStrategicConstraints(
      solution, 
      hConstraints, 
      vConstraints, 
      constraintProbability
    );
    
    // Mark remaining pieces as locked
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] !== PieceType.EMPTY) {
          lockedTiles[row][col] = true;
        }
      }
    }
    
    console.log(`Created fallback puzzle with ${remainingPieces} starting pieces`);
    return { board, hConstraints, vConstraints, lockedTiles };
  }
  
  /**
   * Gets all board positions
   */
  private getAllPositions(): [number, number][] {
    const positions: [number, number][] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        positions.push([row, col]);
      }
    }
    return positions;
  }

  /**
   * Removes pieces while maintaining logical solvability
   */
    private removePieces(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][],
    config: PuzzleConfig
  ): void {
    // Calculate target number of pieces to keep
    const totalPieces = this.size * this.size;
    const targetStartingPieces = Math.floor(
      Math.random() * (config.startingPiecesMax - config.startingPiecesMin + 1) + config.startingPiecesMin
    );
    const targetPiecesToRemove = totalPieces - targetStartingPieces;
    
    // Create list of all positions and shuffle for random removal order
    const allPositions: [number, number][] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        allPositions.push([row, col]);
      }
    }
    let availablePositions = this.shuffleArray(allPositions);
    
    let piecesRemoved = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = allPositions.length; // Maximum number of consecutive failures before giving up
    
    console.log(`Target: Remove ${targetPiecesToRemove} pieces, keep ${targetStartingPieces} pieces`);
    
    // Try to remove pieces until we reach target or can't make progress
    while (piecesRemoved < targetPiecesToRemove && availablePositions.length > 0 && consecutiveFailures < maxConsecutiveFailures) {
      const [row, col] = availablePositions.shift()!;

      // Skip if already empty
      if (board[row][col] === PieceType.EMPTY) {
        consecutiveFailures++;
        continue;
      }
      
      // Step 2: Remove the piece
      const originalPiece = board[row][col];
      board[row][col] = PieceType.EMPTY;
      
      // Step 3: Check if the puzzle is still logically solvable
      const canSolveLogically = this.logicalSolver.canSolveLogically(board, hConstraints, vConstraints, solution);

      if (canSolveLogically) {
        // Success! The piece can be logically deduced
        piecesRemoved++;
        consecutiveFailures = 0; // Reset failure counter on success
        console.log(`Removed piece at [${row},${col}]. Progress: ${piecesRemoved}/${targetPiecesToRemove}`);
      } else {
        // Step 4: Try to add a single constraint to make it logical
        const constraintAdded = this.addSingleConstraintForPiece(
          row, col, originalPiece, board, hConstraints, vConstraints, solution
        );
        
        if (constraintAdded) {
          // Successfully added constraint, keep the piece removed
          piecesRemoved++;
          consecutiveFailures = 0; // Reset failure counter on success
          console.log(`Removed piece at [${row},${col}] with constraint. Progress: ${piecesRemoved}/${targetPiecesToRemove}`);
        } else {
          // Cannot make it logical even with constraints, put the piece back
          board[row][col] = originalPiece;
          consecutiveFailures++;
          console.log(`Restored piece at [${row},${col}], could not remove`);
          // Don't add position back - we've tried it and it didn't work
        }
      }
      
      // If we've tried all positions without removing any, we're done
      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.log('Cannot remove any more pieces while maintaining logical solvability');
        break;
      }
    }
    
    console.log(`Final: Removed ${piecesRemoved} pieces (target was ${targetPiecesToRemove})`);
  }

  /**
   * Tries to add a single constraint that makes a specific piece logically deducible
   */
  private addSingleConstraintForPiece(
    targetRow: number,
    targetCol: number,
    targetPiece: PieceType,
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    solution: PieceType[][]
  ): boolean {
    // Get all possible constraint positions adjacent to the target
    const possibleConstraints: Array<{
      direction: 'horizontal' | 'vertical',
      row: number,
      col: number,
      type: ConstraintType
    }> = [];
    
    // Horizontal constraints
    if (targetCol > 0 && hConstraints[targetRow][targetCol - 1] === ConstraintType.NONE) {
      const leftPiece = solution[targetRow][targetCol - 1];
      const type = leftPiece === targetPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      possibleConstraints.push({
        direction: 'horizontal',
        row: targetRow,
        col: targetCol - 1,
        type
      });
    }
    
    if (targetCol < this.size - 1 && hConstraints[targetRow][targetCol] === ConstraintType.NONE) {
      const rightPiece = solution[targetRow][targetCol + 1];
      const type = rightPiece === targetPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      possibleConstraints.push({
        direction: 'horizontal',
        row: targetRow,
        col: targetCol,
        type
      });
    }
    
    // Vertical constraints
    if (targetRow > 0 && vConstraints[targetRow - 1][targetCol] === ConstraintType.NONE) {
      const topPiece = solution[targetRow - 1][targetCol];
      const type = topPiece === targetPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      possibleConstraints.push({
        direction: 'vertical',
        row: targetRow - 1,
        col: targetCol,
        type
      });
    }
    
    if (targetRow < this.size - 1 && vConstraints[targetRow][targetCol] === ConstraintType.NONE) {
      const bottomPiece = solution[targetRow + 1][targetCol];
      const type = bottomPiece === targetPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      possibleConstraints.push({
        direction: 'vertical',
        row: targetRow,
        col: targetCol,
        type
      });
    }
    
    // Try each possible constraint
    for (const constraint of this.shuffleArray(possibleConstraints)) {
      // Add the constraint
      if (constraint.direction === 'horizontal') {
        hConstraints[constraint.row][constraint.col] = constraint.type;
      } else {
        vConstraints[constraint.row][constraint.col] = constraint.type;
      }
      
      // Check if the piece is now logically deducible
      const isNowLogical = this.logicalSolver.canSolveLogically(board, hConstraints, vConstraints, solution);
      
      if (isNowLogical) {
        // Success! Keep this constraint
        return true;
      }
      
      // Didn't work, remove the constraint
      if (constraint.direction === 'horizontal') {
        hConstraints[constraint.row][constraint.col] = ConstraintType.NONE;
      } else {
        vConstraints[constraint.row][constraint.col] = ConstraintType.NONE;
      }
    }
    
    // Could not find a single constraint that makes the piece logical
    return false;
  }

  /**
   * Creates a puzzle from a complete solution
   */
  private createPuzzleFromSolution(
    solution: PieceType[][],
    config: PuzzleConfig
  ): GeneratedPuzzle {
    // Create working copies
    const board = this.copyBoard(solution);
    const hConstraints = createEmptyHConstraints();
    const vConstraints = createEmptyVConstraints();
    const lockedTiles = createEmptyLockedTiles();
    
    // Steps 2-5: Remove pieces while maintaining logical solvability
    this.removePieces(board, hConstraints, vConstraints, lockedTiles, solution, config);
    
    // Optional: Clean up redundant constraints (between locked pieces)
    this.removeRedundantConstraints(board, hConstraints, vConstraints, lockedTiles);
    
    // Lock remaining pieces
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] !== PieceType.EMPTY) {
          lockedTiles[row][col] = true;
        }
      }
    }
    
    // Step 6: Return the puzzle
    return { board, hConstraints, vConstraints, lockedTiles };
  }

  /**
   * Removes constraints between locked pieces (they're redundant)
   */
  private removeRedundantConstraints(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][]
  ): void {
    // Remove horizontal constraints between locked tiles
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (lockedTiles[row][col] && lockedTiles[row][col + 1]) {
          hConstraints[row][col] = ConstraintType.NONE;
        }
      }
    }
    
    // Remove vertical constraints between locked tiles
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (lockedTiles[row][col] && lockedTiles[row + 1][col]) {
          vConstraints[row][col] = ConstraintType.NONE;
        }
      }
    }
  }

  /**
   * Compares two board solutions to check if they match
   */
  private solutionsMatch(board1: PieceType[][], board2: PieceType[][]): boolean {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board1[row][col] !== board2[row][col]) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Simplified validation that just checks for unique solution
   */
  private validatePuzzle(puzzle: GeneratedPuzzle, expectedSolution: PieceType[][]): boolean {
    // Check uniqueness
    this.uniqueSolver = new TangoBoardSolver(
      puzzle.board,
      puzzle.hConstraints,
      puzzle.vConstraints,
      puzzle.lockedTiles
    );
    
    const solutions = this.uniqueSolver.findAllSolutions(2);
    
    if (solutions.length !== 1) {
      console.error(`Puzzle has ${solutions.length} solutions, expected 1`);
      return false;
    }
    
    // Verify it matches expected solution
    if (!this.solutionsMatch(solutions[0], expectedSolution)) {
      console.error('Solution does not match expected');
      return false;
    }
    
    // Count statistics for logging
    let emptyCount = 0;
    let constraintCount = 0;
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (puzzle.board[row][col] === PieceType.EMPTY) {
          emptyCount++;
        }
        if (col < this.size - 1 && puzzle.hConstraints[row][col] !== ConstraintType.NONE) {
          constraintCount++;
        }
        if (row < this.size - 1 && puzzle.vConstraints[row][col] !== ConstraintType.NONE) {
          constraintCount++;
        }
      }
    }
    
    console.log(`Valid puzzle: ${this.size * this.size - emptyCount} pieces, ${constraintCount} constraints`);
    return true;
  }

  /**
   * Simplified main generation method
   */
  generatePuzzle(config: PuzzleConfig): GeneratedPuzzle {
    const maxAttempts = config.maxAttempts || 20;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Step 1: Generate a valid complete solution
        const solution = this.boardGenerator.generateRandomBoard();
        
        // Steps 2-6: Create puzzle by removing pieces
        const puzzle = this.createPuzzleFromSolution(solution, config);
        
        // Validate the puzzle
        if (this.validatePuzzle(puzzle, solution)) {
          console.log(`Successfully generated puzzle on attempt ${attempt}`);
          return puzzle;
        }
        
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error);
      }
    }
    
    // Fallback: return a simple puzzle with many pieces
    console.warn('Using fallback puzzle generation');
    return this.createFallbackPuzzle(config);
  }
}