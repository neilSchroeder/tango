import type { PuzzleConfig, GeneratedPuzzle } from './types';
import { TangoBoardSolver } from './solver/TangoBoardSolver';
import { 
  BOARD_SIZE, 
  MAX_PIECES_PER_ROW_COL,
  PieceType,
  ConstraintType,
  createEmptyBoard,
  createEmptyHConstraints,
  createEmptyVConstraints,
  createEmptyLockedTiles
} from './types';

/**
 * Tango / Binairo-like puzzle generator with SAME (=) and DIFFERENT (×) connectors.
 * This generator enforces:
 *  - No more than two identical adjacent horizontally/vertically
 *  - Equal distribution per row and per column (for 6x6 => exactly 3 SUN and 3 MOON)
 *  - Connectors reflect the final solution
 *  - Uniqueness: exactly ONE solution
 */
export class PuzzleGenerator {
  private readonly size = BOARD_SIZE;

  /*
  * DEFAULT: Original puzzle generation logic
  * Puzzle generation logic goes like this:
  * Generate a random valid board
  * Work backwards from the solution to create the puzzle
  * Using a logical derivation tree
  * Apply constraints and remove pieces to create the final puzzle
  */

  /**
   * Generate puzzle using original method (DEFAULT)
   */
  public generatePuzzle(config: PuzzleConfig): GeneratedPuzzle {
    let attempts = 0;
    const maxAttempts = config.maxAttempts || 50;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Step 1: Generate a random valid board
        const board = this.generateRandomBoard();
        
        // Step 2: Work backwards from the solution to create the puzzle
        const { hConstraints, vConstraints, lockedTiles } = this.createPuzzleFromSolution(board, config);
        
        // Step 3: Validate that the final puzzle has a solution
        if (this.validatePuzzleIsSolvable(board, hConstraints, vConstraints, lockedTiles)) {
          return { board, hConstraints, vConstraints, lockedTiles };
        }
        
        // If puzzle is not solvable, try again
        console.warn(`Puzzle attempt ${attempts} failed validation - regenerating...`);
        
      } catch (error) {
        console.warn(`Puzzle generation attempt ${attempts} failed:`, error);
      }
    }
    
    // If we've exhausted all attempts, throw an error
    throw new Error(`Failed to generate a valid puzzle after ${maxAttempts} attempts`);
  }

  public generateRandomBoard(): PieceType[][] {
    const board: PieceType[][] = createEmptyBoard();
    
    // Use backtracking to generate a valid board
    while (true) {
      if (this.fillBoardWithBacktracking(board, 0, 0)) {
        return board;
      }
    }
  }

  /**
   * Fills the board using backtracking to ensure all constraints are satisfied
   */
  private fillBoardWithBacktracking(board: PieceType[][], row: number, col: number): boolean {
    // If we've filled all rows, we're done
    if (row === this.size) {
      return this.isValidCompleteBoard(board);
    }
    
    // Calculate next position
    const nextRow = col === this.size - 1 ? row + 1 : row;
    const nextCol = col === this.size - 1 ? 0 : col + 1;
    
    // Try both piece types in random order
    const pieceTypes = this.shuffleArray([PieceType.SUN, PieceType.MOON]);
    
    for (const pieceType of pieceTypes) {
      board[row][col] = pieceType;
      
      if (this.isValidPlacement(board, row, col)) {
        if (this.fillBoardWithBacktracking(board, nextRow, nextCol)) {
          return true;
        }
      }
    }
    
    // Backtrack
    board[row][col] = PieceType.EMPTY;
    return false;
  }

  /**
   * Checks if placing a piece at the given position is valid
   */
  private isValidPlacement(board: PieceType[][], row: number, col: number): boolean {
    const piece = board[row][col];
    
    // Check no more than 2 adjacent horizontally
    if (!this.checkAdjacentConstraint(board, row, col, piece, 'horizontal')) {
      return false;
    }
    
    // Check no more than 2 adjacent vertically
    if (!this.checkAdjacentConstraint(board, row, col, piece, 'vertical')) {
      return false;
    }
    
    // Check distribution constraints (only if row/column is complete or nearly complete)
    if (!this.checkDistributionConstraint(board, row, col, piece)) {
      return false;
    }
    
    return true;
  }

  /**
   * Checks the adjacent constraint (no more than 2 identical pieces in a row)
   */
  private checkAdjacentConstraint(board: PieceType[][], row: number, col: number, piece: PieceType, direction: 'horizontal' | 'vertical'): boolean {
    if (direction === 'horizontal') {
      // Check left side
      let leftCount = 0;
      for (let c = col - 1; c >= 0 && board[row][c] === piece; c--) {
        leftCount++;
      }
      
      // Check right side
      let rightCount = 0;
      for (let c = col + 1; c < this.size && board[row][c] === piece; c++) {
        rightCount++;
      }
      
      return leftCount + rightCount < 2; // Current piece + max 1 on each side = max 2 adjacent
    } else {
      // Check up
      let upCount = 0;
      for (let r = row - 1; r >= 0 && board[r][col] === piece; r--) {
        upCount++;
      }
      
      // Check down
      let downCount = 0;
      for (let r = row + 1; r < this.size && board[r][col] === piece; r++) {
        downCount++;
      }
      
      return upCount + downCount < 2; // Current piece + max 1 on each side = max 2 adjacent
    }
  }

  /**
   * Checks distribution constraint (equal number of SUN and MOON per row/column)
   */
  private checkDistributionConstraint(board: PieceType[][], row: number, col: number, piece: PieceType): boolean {
    // Count pieces in current row
    let sunCountRow = 0;
    let moonCountRow = 0;
    let emptyCountRow = 0;
    
    for (let c = 0; c < this.size; c++) {
      if (board[row][c] === PieceType.SUN) sunCountRow++;
      else if (board[row][c] === PieceType.MOON) moonCountRow++;
      else emptyCountRow++;
    }
    
    // Count pieces in current column
    let sunCountCol = 0;
    let moonCountCol = 0;
    let emptyCountCol = 0;
    
    for (let r = 0; r < this.size; r++) {
      if (board[r][col] === PieceType.SUN) sunCountCol++;
      else if (board[r][col] === PieceType.MOON) moonCountCol++;
      else emptyCountCol++;
    }
    
    // Check if we can still achieve equal distribution
    const maxAllowed = this.size / 2; // For 6x6, this is 3
    
    // Row constraint check
    if (piece === PieceType.SUN && sunCountRow > maxAllowed) return false;
    if (piece === PieceType.MOON && moonCountRow > maxAllowed) return false;
    
    // Column constraint check
    if (piece === PieceType.SUN && sunCountCol > maxAllowed) return false;
    if (piece === PieceType.MOON && moonCountCol > maxAllowed) return false;
    
    return true;
  }

  /**
   * Validates that a complete board satisfies all constraints
   */
  private isValidCompleteBoard(board: PieceType[][]): boolean {
    // Check each row has equal distribution
    for (let row = 0; row < this.size; row++) {
      let sunCount = 0;
      let moonCount = 0;
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.SUN) sunCount++;
        else if (board[row][col] === PieceType.MOON) moonCount++;
      }
      if (sunCount !== this.size / 2 || moonCount !== this.size / 2) {
        return false;
      }
    }
    
    // Check each column has equal distribution
    for (let col = 0; col < this.size; col++) {
      let sunCount = 0;
      let moonCount = 0;
      for (let row = 0; row < this.size; row++) {
        if (board[row][col] === PieceType.SUN) sunCount++;
        else if (board[row][col] === PieceType.MOON) moonCount++;
      }
      if (sunCount !== this.size / 2 || moonCount !== this.size / 2) {
        return false;
      }
    }
    
    // Check no more than 2 adjacent pieces
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (!this.checkAdjacentConstraint(board, row, col, board[row][col], 'horizontal') ||
            !this.checkAdjacentConstraint(board, row, col, board[row][col], 'vertical')) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Shuffles an array randomly (Fisher-Yates algorithm)
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
   * Creates a puzzle from a complete solution by removing pieces and adding constraints
   */
  private createPuzzleFromSolution(board: PieceType[][], config: PuzzleConfig): {
    hConstraints: ConstraintType[][];
    vConstraints: ConstraintType[][];
    lockedTiles: boolean[][];
  } {
    // Create a deep copy of the solution board
    const solutionBoard = board.map(row => [...row]);
    const puzzleBoard = board.map(row => [...row]);
    const hConstraints = createEmptyHConstraints();
    const vConstraints = createEmptyVConstraints();
    const lockedTiles = createEmptyLockedTiles();

    // First pass: Add some strategic constraints based on probability
    this.addStrategicConstraints(solutionBoard, hConstraints, vConstraints, config.constraintProbability);

    // Track positions of pieces
    const allPositions: [number, number][] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        allPositions.push([row, col]);
      }
    }

    // Shuffle positions to randomize removal order
    const shuffledPositions = this.shuffleArray(allPositions);
    
    // Calculate target number of starting pieces
    const totalPieces = this.size * this.size;
    const targetStartingPieces = Math.floor(
      Math.random() * (config.startingPiecesMax - config.startingPiecesMin + 1) + config.startingPiecesMin
    );
    
    // Keep track of pieces removed
    let piecesRemoved = 0;
    const maxPiecesToRemove = totalPieces - targetStartingPieces;
    const removedPositions: Set<string> = new Set();

    // Process each position for potential removal
    for (const [row, col] of shuffledPositions) {
      if (piecesRemoved >= maxPiecesToRemove) {
        break;
      }

      // Try removing this piece
      const originalPiece = puzzleBoard[row][col];
      puzzleBoard[row][col] = PieceType.EMPTY;

      // Check if puzzle still has a unique solution that matches our target
      if (this.hasUniqueSolution(puzzleBoard, hConstraints, vConstraints, solutionBoard)) {
        // Keep the piece removed
        piecesRemoved++;
        removedPositions.add(`${row},${col}`);
      } else {
        // Put the piece back
        puzzleBoard[row][col] = originalPiece;
      }
    }

    // Second pass: Try to add more constraints to help remove additional pieces
    if (piecesRemoved < maxPiecesToRemove) {
      this.addConstraintsToRemoveMorePieces(
        puzzleBoard, 
        hConstraints, 
        vConstraints, 
        solutionBoard, 
        removedPositions,
        maxPiecesToRemove - piecesRemoved,
        config.constraintProbability * 2 // Higher probability for second pass
      );
    }

    // Final pass: Lock all remaining pieces on the board
    // Any piece that remains should be locked since it's given to the player
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (puzzleBoard[row][col] !== PieceType.EMPTY) {
          lockedTiles[row][col] = true;
        }
      }
    }

    // Clean up constraints: Remove any constraints between locked pieces
    this.removeConstraintsBetweenLockedPieces(puzzleBoard, hConstraints, vConstraints, lockedTiles);

    // Logical constraint cleanup: Remove redundant constraints that aren't needed for logical solving
    this.removeRedundantConstraints(puzzleBoard, hConstraints, vConstraints, lockedTiles, solutionBoard);

    // Ensure logical solvability: Add constraints if needed to make the puzzle logically solvable
    this.ensureLogicalSolvability(puzzleBoard, hConstraints, vConstraints, lockedTiles, solutionBoard);

    // Copy the puzzle state back to the board parameter
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        board[row][col] = puzzleBoard[row][col];
      }
    }

    return { hConstraints, vConstraints, lockedTiles };
  }

  /**
   * Ensures that the puzzle can be solved through logical deduction by adding constraints if needed
   */
  private ensureLogicalSolvability(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    // Test if the puzzle is already logically solvable
    if (this.canSolveLogicallyToSolution(board, hConstraints, vConstraints, lockedTiles, solution)) {
      return; // Already solvable
    }

    console.log('Puzzle not logically solvable, attempting to add constraints...');

    // Try to identify positions where constraints would help logical progression
    const constraintCandidates: Array<{
      row: number;
      col: number;
      type: 'horizontal' | 'vertical';
      constraint: ConstraintType;
      priority: number;
    }> = [];

    // Look for positions where a constraint would create logical deductions
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        // Check horizontal constraint potential
        if (col < this.size - 1 && hConstraints[row][col] === ConstraintType.NONE) {
          const constraint = solution[row][col] === solution[row][col + 1] 
            ? ConstraintType.SAME 
            : ConstraintType.DIFFERENT;
          
          const priority = this.calculateConstraintPriority(board, row, col, 'horizontal', constraint, solution);
          if (priority > 0) {
            constraintCandidates.push({
              row,
              col,
              type: 'horizontal',
              constraint,
              priority
            });
          }
        }

        // Check vertical constraint potential
        if (row < this.size - 1 && vConstraints[row][col] === ConstraintType.NONE) {
          const constraint = solution[row][col] === solution[row + 1][col]
            ? ConstraintType.SAME
            : ConstraintType.DIFFERENT;
          
          const priority = this.calculateConstraintPriority(board, row, col, 'vertical', constraint, solution);
          if (priority > 0) {
            constraintCandidates.push({
              row,
              col,
              type: 'vertical',
              constraint,
              priority
            });
          }
        }
      }
    }

    // Sort candidates by priority (highest first)
    constraintCandidates.sort((a, b) => b.priority - a.priority);

    // Try adding constraints one by one until the puzzle becomes logically solvable
    for (const candidate of constraintCandidates) {
      // Add the constraint
      if (candidate.type === 'horizontal') {
        hConstraints[candidate.row][candidate.col] = candidate.constraint;
      } else {
        vConstraints[candidate.row][candidate.col] = candidate.constraint;
      }

      // Test if the puzzle is now logically solvable
      if (this.canSolveLogicallyToSolution(board, hConstraints, vConstraints, lockedTiles, solution)) {
        console.log(`Added ${candidate.type} constraint at (${candidate.row}, ${candidate.col}) to ensure logical solvability`);
        return; // Success!
      }
    }

    console.warn('Could not make puzzle logically solvable by adding constraints');
  }

  /**
   * Calculate the priority of a constraint for helping logical progression
   */
  private calculateConstraintPriority(
    board: PieceType[][],
    row: number,
    col: number,
    type: 'horizontal' | 'vertical',
    constraint: ConstraintType,
    solution: PieceType[][]
  ): number {
    let priority = 0;

    // Higher priority for constraints involving empty cells
    if (type === 'horizontal') {
      if (board[row][col] === PieceType.EMPTY) priority += 10;
      if (board[row][col + 1] === PieceType.EMPTY) priority += 10;
      
      // Higher priority if one side is known and other is empty
      if (board[row][col] !== PieceType.EMPTY && board[row][col + 1] === PieceType.EMPTY) priority += 20;
      if (board[row][col] === PieceType.EMPTY && board[row][col + 1] !== PieceType.EMPTY) priority += 20;
    } else {
      if (board[row][col] === PieceType.EMPTY) priority += 10;
      if (board[row + 1][col] === PieceType.EMPTY) priority += 10;
      
      // Higher priority if one side is known and other is empty
      if (board[row][col] !== PieceType.EMPTY && board[row + 1][col] === PieceType.EMPTY) priority += 20;
      if (board[row][col] === PieceType.EMPTY && board[row + 1][col] !== PieceType.EMPTY) priority += 20;
    }

    // Slightly lower priority for constraints between two empty cells
    if (type === 'horizontal' && board[row][col] === PieceType.EMPTY && board[row][col + 1] === PieceType.EMPTY) {
      priority = Math.max(1, priority - 5);
    }
    if (type === 'vertical' && board[row][col] === PieceType.EMPTY && board[row + 1][col] === PieceType.EMPTY) {
      priority = Math.max(1, priority - 5);
    }

    return priority;
  }
  private addStrategicConstraints(
    solution: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    probability: number
  ): void {
    // Add horizontal constraints (only between empty spaces or between empty and filled)
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (Math.random() < probability) {
          const leftPiece = solution[row][col];
          const rightPiece = solution[row][col + 1];
          hConstraints[row][col] = leftPiece === rightPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
        }
      }
    }

    // Add vertical constraints (only between empty spaces or between empty and filled)
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (Math.random() < probability) {
          const topPiece = solution[row][col];
          const bottomPiece = solution[row + 1][col];
          vConstraints[row][col] = topPiece === bottomPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
        }
      }
    }
  }

  /**
   * Removes constraints between locked pieces (they are redundant and over-constrain the puzzle)
   */
  private removeConstraintsBetweenLockedPieces(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][]
  ): void {
    // Remove horizontal constraints between locked pieces
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] !== ConstraintType.NONE) {
          const leftLocked = board[row][col] !== PieceType.EMPTY && lockedTiles[row][col];
          const rightLocked = board[row][col + 1] !== PieceType.EMPTY && lockedTiles[row][col + 1];
          
          // If both pieces are locked, remove the constraint
          if (leftLocked && rightLocked) {
            hConstraints[row][col] = ConstraintType.NONE;
          }
        }
      }
    }

    // Remove vertical constraints between locked pieces
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] !== ConstraintType.NONE) {
          const topLocked = board[row][col] !== PieceType.EMPTY && lockedTiles[row][col];
          const bottomLocked = board[row + 1][col] !== PieceType.EMPTY && lockedTiles[row + 1][col];
          
          // If both pieces are locked, remove the constraint
          if (topLocked && bottomLocked) {
            vConstraints[row][col] = ConstraintType.NONE;
          }
        }
      }
    }
  }

  /**
   * Removes redundant constraints by testing if the puzzle can be solved without them
   */
  private removeRedundantConstraints(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    // First pass: Remove obviously redundant constraints using pattern analysis
    this.removeObviouslyRedundantConstraints(board, hConstraints, vConstraints, lockedTiles, solution);
    
    // Second pass: Test remaining constraints one by one
    const constraintPositions = this.getAllConstraintPositions(hConstraints, vConstraints);
    
    // Prioritize constraints for testing (test between locked pieces first)
    const prioritizedConstraints = this.prioritizeConstraints(constraintPositions, lockedTiles);
    
    for (const constraintPos of prioritizedConstraints) {
      const { type, row, col, originalConstraint } = constraintPos;
      
      // Temporarily remove the constraint
      if (type === 'horizontal') {
        hConstraints[row][col] = ConstraintType.NONE;
      } else {
        vConstraints[row][col] = ConstraintType.NONE;
      }
      
      // Test if the puzzle can still be solved logically to the correct solution
      if (this.canSolveLogicallyToSolution(board, hConstraints, vConstraints, lockedTiles, solution)) {
        // The constraint is redundant, keep it removed
        // (already removed above)
      } else {
        // The constraint is needed, restore it
        if (type === 'horizontal') {
          hConstraints[row][col] = originalConstraint;
        } else {
          vConstraints[row][col] = originalConstraint;
        }
      }
    }
  }

  /**
   * Remove constraints that are obviously redundant due to pattern analysis
   */
  private removeObviouslyRedundantConstraints(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    // Remove constraints involving overconstrained positions
    this.removeOverconstrainedPositionConstraints(board, hConstraints, vConstraints, lockedTiles, solution);
    
    // Remove constraints made redundant by pattern completion
    this.removePatternCompletionRedundancies(board, hConstraints, vConstraints, lockedTiles, solution);
    
    // Remove constraints between cells that are forced to specific values
    this.removeForcedValueConstraints(board, hConstraints, vConstraints, lockedTiles, solution);
  }

  /**
   * Remove constraints involving positions that are overconstrained
   * (where the cell value is already determined by row/column rules)
   */
  private removeOverconstrainedPositionConstraints(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        // Skip if this cell is already filled
        if (board[row][col] !== PieceType.EMPTY) continue;
        
        // Check if this position is forced by row/column constraints
        const forcedValue = this.getForcedValueForPosition(board, row, col, solution);
        if (forcedValue === null) continue;
        
        // This position is forced to a specific value, remove redundant constraints
        
        // Check horizontal constraint to the left
        if (col > 0 && hConstraints[row][col - 1] !== ConstraintType.NONE) {
          const leftValue = board[row][col - 1] !== PieceType.EMPTY 
            ? board[row][col - 1] 
            : solution[row][col - 1];
          
          // If constraint conflicts with forced values, remove it
          if ((hConstraints[row][col - 1] === ConstraintType.SAME && leftValue !== forcedValue) ||
              (hConstraints[row][col - 1] === ConstraintType.DIFFERENT && leftValue === forcedValue)) {
            hConstraints[row][col - 1] = ConstraintType.NONE;
          }
        }
        
        // Check horizontal constraint to the right
        if (col < this.size - 1 && hConstraints[row][col] !== ConstraintType.NONE) {
          const rightValue = board[row][col + 1] !== PieceType.EMPTY 
            ? board[row][col + 1] 
            : solution[row][col + 1];
          
          // If constraint conflicts with forced values, remove it
          if ((hConstraints[row][col] === ConstraintType.SAME && rightValue !== forcedValue) ||
              (hConstraints[row][col] === ConstraintType.DIFFERENT && rightValue === forcedValue)) {
            hConstraints[row][col] = ConstraintType.NONE;
          }
        }
        
        // Check vertical constraint above
        if (row > 0 && vConstraints[row - 1][col] !== ConstraintType.NONE) {
          const topValue = board[row - 1][col] !== PieceType.EMPTY 
            ? board[row - 1][col] 
            : solution[row - 1][col];
          
          // If constraint conflicts with forced values, remove it
          if ((vConstraints[row - 1][col] === ConstraintType.SAME && topValue !== forcedValue) ||
              (vConstraints[row - 1][col] === ConstraintType.DIFFERENT && topValue === forcedValue)) {
            vConstraints[row - 1][col] = ConstraintType.NONE;
          }
        }
        
        // Check vertical constraint below
        if (row < this.size - 1 && vConstraints[row][col] !== ConstraintType.NONE) {
          const bottomValue = board[row + 1][col] !== PieceType.EMPTY 
            ? board[row + 1][col] 
            : solution[row + 1][col];
          
          // If constraint conflicts with forced values, remove it
          if ((vConstraints[row][col] === ConstraintType.SAME && bottomValue !== forcedValue) ||
              (vConstraints[row][col] === ConstraintType.DIFFERENT && bottomValue === forcedValue)) {
            vConstraints[row][col] = ConstraintType.NONE;
          }
        }
      }
    }
  }

  /**
   * Get the forced value for a position based on row/column completion rules
   */
  private getForcedValueForPosition(
    board: PieceType[][],
    row: number,
    col: number,
    solution: PieceType[][]
  ): PieceType | null {
    // Count current pieces in row and column
    let sunCountRow = 0, moonCountRow = 0;
    let sunCountCol = 0, moonCountCol = 0;
    
    for (let i = 0; i < this.size; i++) {
      // Count in row
      if (board[row][i] === PieceType.SUN) sunCountRow++;
      else if (board[row][i] === PieceType.MOON) moonCountRow++;
      
      // Count in column
      if (board[i][col] === PieceType.SUN) sunCountCol++;
      else if (board[i][col] === PieceType.MOON) moonCountCol++;
    }
    
    // Check if row forces this cell
    if (sunCountRow === MAX_PIECES_PER_ROW_COL) return PieceType.MOON;
    if (moonCountRow === MAX_PIECES_PER_ROW_COL) return PieceType.SUN;
    
    // Check if column forces this cell
    if (sunCountCol === MAX_PIECES_PER_ROW_COL) return PieceType.MOON;
    if (moonCountCol === MAX_PIECES_PER_ROW_COL) return PieceType.SUN;
    
    return null;
  }

  /**
   * Remove constraints made redundant by pattern completion
   * e.g., M M S _ _ = _ always completes to M M S M S S, making subsequent constraints redundant
   */
  private removePatternCompletionRedundancies(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    // Check each row for pattern completion scenarios
    for (let row = 0; row < this.size; row++) {
      this.removeRowPatternRedundancies(board, hConstraints, vConstraints, lockedTiles, solution, row);
    }
    
    // Check each column for pattern completion scenarios
    for (let col = 0; col < this.size; col++) {
      this.removeColumnPatternRedundancies(board, hConstraints, vConstraints, lockedTiles, solution, col);
    }
  }

  /**
   * Remove redundant constraints in a row due to pattern completion
   */
  private removeRowPatternRedundancies(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][],
    row: number
  ): void {
    // Look for patterns like M M S _ _ = _ that force completion
    for (let startCol = 0; startCol <= this.size - 3; startCol++) {
      // Check if we have a definitive pattern that forces the rest
      if (this.isRowPatternForced(board, solution, row, startCol)) {
        // Remove redundant constraints after this pattern
        for (let col = startCol + 2; col < this.size - 1; col++) {
          // Check if horizontal constraint at this position is redundant
          if (hConstraints[row][col] !== ConstraintType.NONE) {
            const leftValue = solution[row][col];
            const rightValue = solution[row][col + 1];
            
            // If the constraint matches what the pattern already forces, it's redundant
            if ((hConstraints[row][col] === ConstraintType.SAME && leftValue === rightValue) ||
                (hConstraints[row][col] === ConstraintType.DIFFERENT && leftValue !== rightValue)) {
              hConstraints[row][col] = ConstraintType.NONE;
            }
          }
        }
      }
    }
  }

  /**
   * Remove redundant constraints in a column due to pattern completion
   */
  private removeColumnPatternRedundancies(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][],
    col: number
  ): void {
    // Look for patterns like M M S _ _ = _ that force completion
    for (let startRow = 0; startRow <= this.size - 3; startRow++) {
      // Check if we have a definitive pattern that forces the rest
      if (this.isColumnPatternForced(board, solution, col, startRow)) {
        // Remove redundant constraints after this pattern
        for (let row = startRow + 2; row < this.size - 1; row++) {
          // Check if vertical constraint at this position is redundant
          if (vConstraints[row][col] !== ConstraintType.NONE) {
            const topValue = solution[row][col];
            const bottomValue = solution[row + 1][col];
            
            // If the constraint matches what the pattern already forces, it's redundant
            if ((vConstraints[row][col] === ConstraintType.SAME && topValue === bottomValue) ||
                (vConstraints[row][col] === ConstraintType.DIFFERENT && topValue !== bottomValue)) {
              vConstraints[row][col] = ConstraintType.NONE;
            }
          }
        }
      }
    }
  }

  /**
   * Check if a row pattern forces the completion of the rest of the row
   */
  private isRowPatternForced(
    board: PieceType[][],
    solution: PieceType[][],
    row: number,
    startCol: number
  ): boolean {
    // Pattern: if we have enough information to force the rest, return true
    let filledCount = 0;
    let sunCount = 0;
    let moonCount = 0;
    
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] !== PieceType.EMPTY) {
        filledCount++;
        if (board[row][col] === PieceType.SUN) sunCount++;
        else moonCount++;
      }
    }
    
    // If we have enough information to determine the rest, it's forced
    return filledCount >= 3 && (sunCount === MAX_PIECES_PER_ROW_COL || moonCount === MAX_PIECES_PER_ROW_COL);
  }

  /**
   * Check if a column pattern forces the completion of the rest of the column
   */
  private isColumnPatternForced(
    board: PieceType[][],
    solution: PieceType[][],
    col: number,
    startRow: number
  ): boolean {
    // Pattern: if we have enough information to force the rest, return true
    let filledCount = 0;
    let sunCount = 0;
    let moonCount = 0;
    
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] !== PieceType.EMPTY) {
        filledCount++;
        if (board[row][col] === PieceType.SUN) sunCount++;
        else moonCount++;
      }
    }
    
    // If we have enough information to determine the rest, it's forced
    return filledCount >= 3 && (sunCount === MAX_PIECES_PER_ROW_COL || moonCount === MAX_PIECES_PER_ROW_COL);
  }

  /**
   * Remove constraints between cells that are forced to specific values
   */
  private removeForcedValueConstraints(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    // Check horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] === ConstraintType.NONE) continue;
        
        const leftForced = this.getForcedValueForPosition(board, row, col, solution);
        const rightForced = this.getForcedValueForPosition(board, row, col + 1, solution);
        
        // If both positions are forced and the constraint matches what's forced, remove it
        if (leftForced !== null && rightForced !== null) {
          if ((hConstraints[row][col] === ConstraintType.SAME && leftForced === rightForced) ||
              (hConstraints[row][col] === ConstraintType.DIFFERENT && leftForced !== rightForced)) {
            hConstraints[row][col] = ConstraintType.NONE;
          }
        }
      }
    }
    
    // Check vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] === ConstraintType.NONE) continue;
        
        const topForced = this.getForcedValueForPosition(board, row, col, solution);
        const bottomForced = this.getForcedValueForPosition(board, row + 1, col, solution);
        
        // If both positions are forced and the constraint matches what's forced, remove it
        if (topForced !== null && bottomForced !== null) {
          if ((vConstraints[row][col] === ConstraintType.SAME && topForced === bottomForced) ||
              (vConstraints[row][col] === ConstraintType.DIFFERENT && topForced !== bottomForced)) {
            vConstraints[row][col] = ConstraintType.NONE;
          }
        }
      }
    }
  }

  /**
   * Gets all constraint positions for testing
   */
  private getAllConstraintPositions(
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): Array<{
    type: 'horizontal' | 'vertical';
    row: number;
    col: number;
    originalConstraint: ConstraintType;
  }> {
    const positions: Array<{
      type: 'horizontal' | 'vertical';
      row: number;
      col: number;
      originalConstraint: ConstraintType;
    }> = [];

    // Collect horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] !== ConstraintType.NONE) {
          positions.push({
            type: 'horizontal',
            row,
            col,
            originalConstraint: hConstraints[row][col]
          });
        }
      }
    }

    // Collect vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] !== ConstraintType.NONE) {
          positions.push({
            type: 'vertical',
            row,
            col,
            originalConstraint: vConstraints[row][col]
          });
        }
      }
    }

    return positions;
  }

  /**
   * Prioritize constraints for removal testing
   * Constraints between locked pieces are tested first as they're more likely to be redundant
   */
  private prioritizeConstraints(
    constraintPositions: Array<{
      type: 'horizontal' | 'vertical';
      row: number;
      col: number;
      originalConstraint: ConstraintType;
    }>,
    lockedTiles: boolean[][]
  ): Array<{
    type: 'horizontal' | 'vertical';
    row: number;
    col: number;
    originalConstraint: ConstraintType;
  }> {
    // Separate constraints by priority
    const betweenLockedPieces: typeof constraintPositions = [];
    const adjacentToLockedPieces: typeof constraintPositions = [];
    const betweenEmptySpaces: typeof constraintPositions = [];
    
    for (const constraint of constraintPositions) {
      const { type, row, col } = constraint;
      
      if (type === 'horizontal') {
        const leftLocked = lockedTiles[row][col];
        const rightLocked = lockedTiles[row][col + 1];
        
        if (leftLocked && rightLocked) {
          betweenLockedPieces.push(constraint);
        } else if (leftLocked || rightLocked) {
          adjacentToLockedPieces.push(constraint);
        } else {
          betweenEmptySpaces.push(constraint);
        }
      } else { // vertical
        const topLocked = lockedTiles[row][col];
        const bottomLocked = lockedTiles[row + 1][col];
        
        if (topLocked && bottomLocked) {
          betweenLockedPieces.push(constraint);
        } else if (topLocked || bottomLocked) {
          adjacentToLockedPieces.push(constraint);
        } else {
          betweenEmptySpaces.push(constraint);
        }
      }
    }
    
    // Shuffle each category to randomize within priority levels
    const shuffledBetweenLocked = this.shuffleArray([...betweenLockedPieces]);
    const shuffledAdjacent = this.shuffleArray([...adjacentToLockedPieces]);
    const shuffledBetweenEmpty = this.shuffleArray([...betweenEmptySpaces]);
    
    // Return prioritized list: test between locked pieces first, then adjacent, then between empty
    return [...shuffledBetweenLocked, ...shuffledAdjacent, ...shuffledBetweenEmpty];
  }

  /**
   * Tests if the puzzle can be solved using only logical deduction to reach the correct solution
   */
  private canSolveLogicallyToSolution(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][],
    expectedSolution: PieceType[][]
  ): boolean {
    try {
      // Create a working copy of the board with only locked pieces
      const workingBoard = board.map(row => [...row]);
      
      // Clear all unlocked positions
      for (let row = 0; row < this.size; row++) {
        for (let col = 0; col < this.size; col++) {
          if (!lockedTiles[row][col]) {
            workingBoard[row][col] = PieceType.EMPTY;
          }
        }
      }

      // Apply only pure logical deduction without backtracking
      const solved = this.applyPureLogicalDeduction(workingBoard, hConstraints, vConstraints, lockedTiles);
      
      if (!solved) {
        return false;
      }
      
      // Check if the solved board matches the expected solution
      return this.boardsMatch(workingBoard, expectedSolution);
      
    } catch (error) {
      console.warn('Error testing logical solvability:', error);
      return false;
    }
  }

  /**
   * Applies pure logical deduction rules without any backtracking or guessing
   */
  private applyPureLogicalDeduction(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][]
  ): boolean {
    let madeProgress = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (madeProgress && iterations < maxIterations) {
      madeProgress = false;
      iterations++;
      
      // Apply each logical rule type
      if (this.applyConsecutiveRules(board)) madeProgress = true;
      if (this.applyConstraintRules(board, hConstraints, vConstraints)) madeProgress = true;
      if (this.applyBalanceRules(board)) madeProgress = true;
      if (this.applyForcedMoveRules(board, hConstraints, vConstraints)) madeProgress = true;
      
      // If no progress was made in this iteration, we're done with logical deduction
      if (!madeProgress) {
        break;
      }
    }
    
    // Check if the board is complete
    return this.isBoardComplete(board);
  }

  /**
   * Apply consecutive piece prevention rules
   */
  private applyConsecutiveRules(board: PieceType[][]): boolean {
    let madeProgress = false;
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          // Check horizontal patterns
          const horizontalMove = this.getConsecutiveMove(board, row, col, 'horizontal');
          if (horizontalMove) {
            board[row][col] = horizontalMove;
            madeProgress = true;
            continue;
          }
          
          // Check vertical patterns
          const verticalMove = this.getConsecutiveMove(board, row, col, 'vertical');
          if (verticalMove) {
            board[row][col] = verticalMove;
            madeProgress = true;
          }
        }
      }
    }
    
    return madeProgress;
  }

  /**
   * Get required piece to prevent three consecutive pieces
   */
  private getConsecutiveMove(board: PieceType[][], row: number, col: number, direction: 'horizontal' | 'vertical'): PieceType | null {
    const deltas = direction === 'horizontal' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
    
    // Pattern: XX_ -> must be opposite
    const [dr1, dc1] = deltas[0];
    const [dr2, dc2] = deltas[1];
    
    if (this.isValidPosition(row + dr1, col + dc1) && this.isValidPosition(row + dr1*2, col + dc1*2)) {
      const piece1 = board[row + dr1][col + dc1];
      const piece2 = board[row + dr1*2][col + dc1*2];
      
      if (piece1 !== PieceType.EMPTY && piece1 === piece2) {
        return piece1 === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      }
    }
    
    // Pattern: _XX -> must be opposite
    if (this.isValidPosition(row + dr2, col + dc2) && this.isValidPosition(row + dr2*2, col + dc2*2)) {
      const piece1 = board[row + dr2][col + dc2];
      const piece2 = board[row + dr2*2][col + dc2*2];
      
      if (piece1 !== PieceType.EMPTY && piece1 === piece2) {
        return piece1 === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      }
    }
    
    // Pattern: X_X -> middle must be opposite
    if (this.isValidPosition(row + dr1, col + dc1) && this.isValidPosition(row + dr2, col + dc2)) {
      const piece1 = board[row + dr1][col + dc1];
      const piece2 = board[row + dr2][col + dc2];
      
      if (piece1 !== PieceType.EMPTY && piece1 === piece2) {
        return piece1 === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      }
    }
    
    return null;
  }

  /**
   * Apply constraint rules (= and ≠ symbols)
   */
  private applyConstraintRules(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): boolean {
    let madeProgress = false;
    
    // Check horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        const constraint = hConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const leftPiece = board[row][col];
          const rightPiece = board[row][col + 1];
          
          if (leftPiece !== PieceType.EMPTY && rightPiece === PieceType.EMPTY) {
            const required = constraint === ConstraintType.SAME ? leftPiece :
                           (leftPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN);
            board[row][col + 1] = required;
            madeProgress = true;
          } else if (leftPiece === PieceType.EMPTY && rightPiece !== PieceType.EMPTY) {
            const required = constraint === ConstraintType.SAME ? rightPiece :
                           (rightPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN);
            board[row][col] = required;
            madeProgress = true;
          }
        }
      }
    }
    
    // Check vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        const constraint = vConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const topPiece = board[row][col];
          const bottomPiece = board[row + 1][col];
          
          if (topPiece !== PieceType.EMPTY && bottomPiece === PieceType.EMPTY) {
            const required = constraint === ConstraintType.SAME ? topPiece :
                           (topPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN);
            board[row + 1][col] = required;
            madeProgress = true;
          } else if (topPiece === PieceType.EMPTY && bottomPiece !== PieceType.EMPTY) {
            const required = constraint === ConstraintType.SAME ? bottomPiece :
                           (bottomPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN);
            board[row][col] = required;
            madeProgress = true;
          }
        }
      }
    }
    
    return madeProgress;
  }

  /**
   * Apply balance rules (3 suns/moons max per row/column)
   */
  private applyBalanceRules(board: PieceType[][]): boolean {
    let madeProgress = false;
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const rowCounts = this.countRowPieces(board, row);
          const colCounts = this.countColPieces(board, col);
          
          // If row already has 3 suns, remaining must be moons
          if (rowCounts.suns === 3) {
            board[row][col] = PieceType.MOON;
            madeProgress = true;
            continue;
          }
          
          // If row already has 3 moons, remaining must be suns
          if (rowCounts.moons === 3) {
            board[row][col] = PieceType.SUN;
            madeProgress = true;
            continue;
          }
          
          // If column already has 3 suns, remaining must be moons
          if (colCounts.suns === 3) {
            board[row][col] = PieceType.MOON;
            madeProgress = true;
            continue;
          }
          
          // If column already has 3 moons, remaining must be suns
          if (colCounts.moons === 3) {
            board[row][col] = PieceType.SUN;
            madeProgress = true;
          }
        }
      }
    }
    
    return madeProgress;
  }

  /**
   * Apply forced move rules (only one valid option due to constraints)
   */
  private applyForcedMoveRules(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): boolean {
    let madeProgress = false;
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const validPieces: PieceType[] = [];
          
          for (const piece of [PieceType.SUN, PieceType.MOON]) {
            if (this.isValidPlacementWithConstraints(board, row, col, piece, hConstraints, vConstraints)) {
              validPieces.push(piece);
            }
          }
          
          if (validPieces.length === 1) {
            board[row][col] = validPieces[0];
            madeProgress = true;
          }
        }
      }
    }
    
    return madeProgress;
  }

  /**
   * Check if placing a piece at a position is valid (including constraints)
   */
  private isValidPlacementWithConstraints(
    board: PieceType[][],
    row: number,
    col: number,
    piece: PieceType,
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Temporarily place the piece
    const original = board[row][col];
    board[row][col] = piece;
    
    let isValid = true;
    
    // Check consecutive rules
    if (!this.checkConsecutiveConstraints(board, row, col)) {
      isValid = false;
    }
    
    // Check balance rules
    if (isValid && !this.checkBalanceConstraints(board, row, col)) {
      isValid = false;
    }
    
    // Check constraint symbols
    if (isValid && !this.checkSymbolConstraints(board, row, col, hConstraints, vConstraints)) {
      isValid = false;
    }
    
    // Restore original
    board[row][col] = original;
    
    return isValid;
  }

  /**
   * Check if position is within board bounds
   */
  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  /**
   * Check if board is completely filled
   */
  private isBoardComplete(board: PieceType[][]): boolean {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Count pieces in a row
   */
  private countRowPieces(board: PieceType[][], row: number): {suns: number, moons: number} {
    let suns = 0, moons = 0;
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
    }
    return {suns, moons};
  }

  /**
   * Count pieces in a column
   */
  private countColPieces(board: PieceType[][], col: number): {suns: number, moons: number} {
    let suns = 0, moons = 0;
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
    }
    return {suns, moons};
  }

  /**
   * Check consecutive constraints around a position
   */
  private checkConsecutiveConstraints(board: PieceType[][], row: number, col: number): boolean {
    const piece = board[row][col];
    
    // Check horizontal
    for (let checkCol = Math.max(0, col - 2); checkCol <= Math.min(this.size - 3, col); checkCol++) {
      if (board[row][checkCol] === piece && 
          board[row][checkCol + 1] === piece && 
          board[row][checkCol + 2] === piece) {
        return false;
      }
    }
    
    // Check vertical
    for (let checkRow = Math.max(0, row - 2); checkRow <= Math.min(this.size - 3, row); checkRow++) {
      if (board[checkRow][col] === piece && 
          board[checkRow + 1][col] === piece && 
          board[checkRow + 2][col] === piece) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check balance constraints for a position
   */
  private checkBalanceConstraints(board: PieceType[][], row: number, col: number): boolean {
    const rowCounts = this.countRowPieces(board, row);
    const colCounts = this.countColPieces(board, col);
    
    return rowCounts.suns <= 3 && rowCounts.moons <= 3 && 
           colCounts.suns <= 3 && colCounts.moons <= 3;
  }

  /**
   * Check symbol constraints around a position
   */
  private checkSymbolConstraints(
    board: PieceType[][],
    row: number,
    col: number,
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    const piece = board[row][col];
    
    // Check horizontal constraints
    if (col > 0 && hConstraints[row][col - 1] !== ConstraintType.NONE) {
      const leftPiece = board[row][col - 1];
      const constraint = hConstraints[row][col - 1];
      if (leftPiece !== PieceType.EMPTY) {
        if (constraint === ConstraintType.SAME && piece !== leftPiece) return false;
        if (constraint === ConstraintType.DIFFERENT && piece === leftPiece) return false;
      }
    }
    
    if (col < this.size - 1 && hConstraints[row][col] !== ConstraintType.NONE) {
      const rightPiece = board[row][col + 1];
      const constraint = hConstraints[row][col];
      if (rightPiece !== PieceType.EMPTY) {
        if (constraint === ConstraintType.SAME && piece !== rightPiece) return false;
        if (constraint === ConstraintType.DIFFERENT && piece === rightPiece) return false;
      }
    }
    
    // Check vertical constraints
    if (row > 0 && vConstraints[row - 1][col] !== ConstraintType.NONE) {
      const topPiece = board[row - 1][col];
      const constraint = vConstraints[row - 1][col];
      if (topPiece !== PieceType.EMPTY) {
        if (constraint === ConstraintType.SAME && piece !== topPiece) return false;
        if (constraint === ConstraintType.DIFFERENT && piece === topPiece) return false;
      }
    }
    
    if (row < this.size - 1 && vConstraints[row][col] !== ConstraintType.NONE) {
      const bottomPiece = board[row + 1][col];
      const constraint = vConstraints[row][col];
      if (bottomPiece !== PieceType.EMPTY) {
        if (constraint === ConstraintType.SAME && piece !== bottomPiece) return false;
        if (constraint === ConstraintType.DIFFERENT && piece === bottomPiece) return false;
      }
    }
    
    return true;
  }

  /**
   * Checks if the puzzle has exactly one solution that matches the expected solution
   * AND can be solved through logical deduction alone
   */
  private hasUniqueSolution(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    expectedSolution: PieceType[][]
  ): boolean {
    try {
      // Create locked tiles for current board state (only non-empty pieces are locked)
      const lockedTiles = board.map(row => row.map(piece => piece !== PieceType.EMPTY));
      
      // First, check if the puzzle can be solved through logical deduction alone
      if (!this.canSolveLogicallyToSolution(board, hConstraints, vConstraints, lockedTiles, expectedSolution)) {
        return false;
      }
      
      // Then verify uniqueness using the full solver with optimal configuration
      const solver = new TangoBoardSolver(board, hConstraints, vConstraints, lockedTiles);
      // Ensure VSIDS is enabled for optimal performance
      solver.setUseDomainBasedSolving(true);
      solver.setUseCDCL(true);
      solver.setUseVSIDS(true);
      const solutions = solver.findAllSolutions(3); // Check for up to 3 solutions
      
      // Must have exactly one solution that matches our expected solution
      if (solutions.length === 1) {
        return this.boardsMatch(solutions[0], expectedSolution);
      }
      
      return false;
    } catch (error) {
      console.warn('Error checking puzzle uniqueness:', error);
      return false;
    }
  }

  /**
   * Attempts to add constraints to help remove more pieces
   */
  private addConstraintsToRemoveMorePieces(
    puzzleBoard: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    solution: PieceType[][],
    removedPositions: Set<string>,
    targetRemovals: number,
    constraintProbability: number
  ): void {
    const allPositions: [number, number][] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (!removedPositions.has(`${row},${col}`) && puzzleBoard[row][col] !== PieceType.EMPTY) {
          allPositions.push([row, col]);
        }
      }
    }

    const shuffledPositions = this.shuffleArray(allPositions);
    let additionalRemovals = 0;

    for (const [row, col] of shuffledPositions) {
      if (additionalRemovals >= targetRemovals) break;

      // Try adding constraints around this position first
      const constraintsAdded = this.tryAddConstraintsAroundPosition(
        row, col, solution, hConstraints, vConstraints, constraintProbability
      );

      if (constraintsAdded > 0) {
        // Now try removing the piece
        const originalPiece = puzzleBoard[row][col];
        puzzleBoard[row][col] = PieceType.EMPTY;

        if (this.hasUniqueSolution(puzzleBoard, hConstraints, vConstraints, solution)) {
          additionalRemovals++;
          removedPositions.add(`${row},${col}`);
        } else {
          puzzleBoard[row][col] = originalPiece;
        }
      }
    }
  }

  /**
   * Tries to add constraints around a specific position
   */
  private tryAddConstraintsAroundPosition(
    row: number,
    col: number,
    solution: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    probability: number
  ): number {
    let constraintsAdded = 0;

    // Try horizontal constraint to the right
    if (col < this.size - 1 && hConstraints[row][col] === ConstraintType.NONE && Math.random() < probability) {
      const leftPiece = solution[row][col];
      const rightPiece = solution[row][col + 1];
      hConstraints[row][col] = leftPiece === rightPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      constraintsAdded++;
    }

    // Try horizontal constraint to the left
    if (col > 0 && hConstraints[row][col - 1] === ConstraintType.NONE && Math.random() < probability) {
      const leftPiece = solution[row][col - 1];
      const rightPiece = solution[row][col];
      hConstraints[row][col - 1] = leftPiece === rightPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      constraintsAdded++;
    }

    // Try vertical constraint below
    if (row < this.size - 1 && vConstraints[row][col] === ConstraintType.NONE && Math.random() < probability) {
      const topPiece = solution[row][col];
      const bottomPiece = solution[row + 1][col];
      vConstraints[row][col] = topPiece === bottomPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      constraintsAdded++;
    }

    // Try vertical constraint above
    if (row > 0 && vConstraints[row - 1][col] === ConstraintType.NONE && Math.random() < probability) {
      const topPiece = solution[row - 1][col];
      const bottomPiece = solution[row][col];
      vConstraints[row - 1][col] = topPiece === bottomPiece ? ConstraintType.SAME : ConstraintType.DIFFERENT;
      constraintsAdded++;
    }

    return constraintsAdded;
  }

  /**
   * Checks if two boards are identical
   */
  private boardsMatch(board1: PieceType[][], board2: PieceType[][]): boolean {
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
   * Validates that a puzzle is solvable and has at least one solution
   */
  private validatePuzzleIsSolvable(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][]
  ): boolean {
    try {
      // Create a solver to test if the puzzle has any solutions with optimal configuration
      const solver = new TangoBoardSolver(board, hConstraints, vConstraints, lockedTiles);
      // Ensure VSIDS is enabled for optimal performance
      solver.setUseDomainBasedSolving(true);
      solver.setUseCDCL(true);
      solver.setUseVSIDS(true);
      
      // Check if puzzle has at least one solution
      const solutions = solver.findAllSolutions(1);
      
      if (solutions.length === 0) {
        console.warn('Puzzle validation failed: No solutions found');
        return false;
      }
      
      // Additional validation: Check that the solution is complete
      const solution = solutions[0];
      for (let row = 0; row < this.size; row++) {
        for (let col = 0; col < this.size; col++) {
          if (solution[row][col] === PieceType.EMPTY) {
            console.warn('Puzzle validation failed: Solution is incomplete');
            return false;
          }
        }
      }
      
      // Validate that the solution respects all game rules
      if (!this.isValidCompleteBoard(solution)) {
        console.warn('Puzzle validation failed: Solution violates game rules');
        return false;
      }
      
      // Validate that the solution respects the constraint symbols
      if (!this.validateSolutionConstraints(solution, hConstraints, vConstraints)) {
        console.warn('Puzzle validation failed: Solution violates constraint symbols');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.warn('Puzzle validation failed with error:', error);
      return false;
    }
  }

  /**
   * Validates that a solution respects all constraint symbols
   */
  private validateSolutionConstraints(
    solution: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Check horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        const constraint = hConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const leftPiece = solution[row][col];
          const rightPiece = solution[row][col + 1];
          
          if (constraint === ConstraintType.SAME && leftPiece !== rightPiece) {
            return false;
          }
          if (constraint === ConstraintType.DIFFERENT && leftPiece === rightPiece) {
            return false;
          }
        }
      }
    }
    
    // Check vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        const constraint = vConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const topPiece = solution[row][col];
          const bottomPiece = solution[row + 1][col];
          
          if (constraint === ConstraintType.SAME && topPiece !== bottomPiece) {
            return false;
          }
          if (constraint === ConstraintType.DIFFERENT && topPiece === bottomPiece) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
}