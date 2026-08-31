/**
 * Candidate for constraint operations
 */
export interface ConstraintCandidate {
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
  constraint: ConstraintType;
  priority: number;
}
import { PieceType, ConstraintType} from '../types';
import { LogicalSolver } from '../solvers/LogicalSolver';
import { 
  BOARD_SIZE, 
} from '../types';

export class ConstraintManager {
  private readonly logicalSolver: LogicalSolver;
  
  constructor(private readonly size: number = BOARD_SIZE) {
    this.logicalSolver = new LogicalSolver(size);
  }
  /**
   * Gets the value of a constraint (horizontal or vertical)
   */
  public getConstraintValue(
    constraint: { direction: 'horizontal' | 'vertical', row: number, col: number },
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): ConstraintType {
    if (constraint.direction === 'horizontal') {
      return hConstraints[constraint.row][constraint.col];
    } else {
      return vConstraints[constraint.row][constraint.col];
    }
  }

  /**
   * Sets the value of a constraint (horizontal or vertical)
   */
  public setConstraintValue(
    constraint: { direction: 'horizontal' | 'vertical', row: number, col: number },
    value: ConstraintType,
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): void {
    if (constraint.direction === 'horizontal') {
      hConstraints[constraint.row][constraint.col] = value;
    } else {
      vConstraints[constraint.row][constraint.col] = value;
    }
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

  addStrategicConstraints(
    solution: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    probability: number,
  ): void {
    // Create a list of all possible constraint positions
    const allConstraints: Array<{ direction: 'horizontal' | 'vertical', row: number, col: number }> = [];
    
    // Horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        allConstraints.push({ direction: 'horizontal', row, col });
      }
    }
    
    // Vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        allConstraints.push({ direction: 'vertical', row, col });
      }
    }
    
    // Shuffle the constraints to randomize selection
    const shuffledConstraints = this.shuffleArray(allConstraints);
    
    // Calculate the number of constraints to add based on probability
    const totalPossibleConstraints = allConstraints.length;
    const targetConstraintCount = Math.ceil(totalPossibleConstraints * probability);
    
    // Add constraints up to the target count
    for (let i = 0; i < Math.min(targetConstraintCount, shuffledConstraints.length); i++) {
      const constraint = shuffledConstraints[i];
      if (constraint.direction === 'horizontal') {
        const row = constraint.row;
        const col = constraint.col;
        hConstraints[row][col] = solution[row][col] === solution[row][col + 1]
          ? ConstraintType.SAME
          : ConstraintType.DIFFERENT;
      } else {
        const row = constraint.row;
        const col = constraint.col;
        vConstraints[row][col] = solution[row][col] === solution[row + 1][col]
          ? ConstraintType.SAME
          : ConstraintType.DIFFERENT;
      }
    }
  }


  removeRedundantConstraints(
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    board: PieceType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    // Step 1: First remove obviously redundant constraints (between locked pieces)
    this.removeObviousRedundantConstraints(hConstraints, vConstraints, board, lockedTiles);

    // Step 2: Try to logically solve the board step by step
    // use backtracking to check if an encountered constraint is necessary
    this.removeLogicallyRedundantConstraints(hConstraints, vConstraints, board, lockedTiles, solution)
  }
  
  private removeObviousRedundantConstraints(
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    board: PieceType[][],
    lockedTiles: boolean[][]
  ): void {
    // Remove horizontal constraints between locked pieces
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (
          lockedTiles[row][col] &&
          lockedTiles[row][col + 1] &&
          board[row][col] !== PieceType.EMPTY &&
          board[row][col + 1] !== PieceType.EMPTY
        ) {
          hConstraints[row][col] = ConstraintType.NONE;
        }
      }
    }

    // Remove vertical constraints between locked pieces
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (
          lockedTiles[row][col] &&
          lockedTiles[row + 1][col] &&
          board[row][col] !== PieceType.EMPTY &&
          board[row + 1][col] !== PieceType.EMPTY
        ) {
          vConstraints[row][col] = ConstraintType.NONE;
        }
      }
    }
  }

  private removeLogicallyRedundantConstraints(
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    board: PieceType[][],
    lockedTiles: boolean[][],
    solution: PieceType[][]
  ): void {
    // Get all current constraints
    const allConstraints = this.findConstraintCandidates(board, solution, hConstraints, vConstraints);
    
    // Shuffle constraints to avoid bias in removal order
    const shuffledConstraints = this.shuffleArray(allConstraints);
    
    // Try removing each constraint
    for (const constraint of shuffledConstraints) {
      // Skip if already removed
      if (constraint.constraint === ConstraintType.NONE) {
        continue;
      }
      
      // Temporarily remove the constraint
      const currentValue = this.getConstraintValue(constraint, hConstraints, vConstraints);
      this.setConstraintValue(constraint, ConstraintType.NONE, hConstraints, vConstraints);
      
      // Check if the constraint is still logically deducible after removal
      const logicalMoves = this.logicalSolver.findAllLogicalMoves(
        board,
        hConstraints,
        vConstraints
      );
      const constraintStillDeducible = logicalMoves.some(move =>
        move.row === constraint.row &&
        move.col === constraint.col &&
        (
          (constraint.direction === 'horizontal' && hConstraints[constraint.row][constraint.col] === currentValue) ||
          (constraint.direction === 'vertical' && vConstraints[constraint.row][constraint.col] === currentValue)
        )
      );
      if (!constraintStillDeducible) {
        // Constraint is necessary, restore it
        this.setConstraintValue(constraint, currentValue, hConstraints, vConstraints);
      }
      // If still valid, keep the constraint removed (already set to NONE)
    }
  }

  findConstraintCandidates(
    board: PieceType[][],
    solution: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): ConstraintCandidate[] {
    const candidates: ConstraintCandidate[] = [];
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        // Check horizontal constraints
        if (col < this.size - 1 && hConstraints[row][col] === ConstraintType.NONE) {
          const constraint = solution[row][col] === solution[row][col + 1]
            ? ConstraintType.SAME
            : ConstraintType.DIFFERENT;
          
          const priority = this.calculateConstraintPriority(board, row, col, 'horizontal');
          candidates.push({ row, col, direction: 'horizontal', constraint, priority });
        }

        // Check vertical constraints
        if (row < this.size - 1 && vConstraints[row][col] === ConstraintType.NONE) {
          const constraint = solution[row][col] === solution[row + 1][col]
            ? ConstraintType.SAME
            : ConstraintType.DIFFERENT;
          
          const priority = this.calculateConstraintPriority(board, row, col, 'vertical');
          candidates.push({ row, col, direction: 'vertical', constraint, priority });
        }
      }
    }
    
    return candidates.sort((a, b) => b.priority - a.priority);
  }

  private calculateConstraintPriority(
    board: PieceType[][],
    row: number,
    col: number,
    direction: 'horizontal' | 'vertical'
  ): number {
    let priority = 0;
    
    if (direction === 'horizontal') {
      if (board[row][col] === PieceType.EMPTY) priority += 10;
      if (board[row][col + 1] === PieceType.EMPTY) priority += 10;
      
      // Higher priority if one side is known and other is empty
      if (board[row][col] !== PieceType.EMPTY && board[row][col + 1] === PieceType.EMPTY) {
        priority += 20;
      }
      if (board[row][col] === PieceType.EMPTY && board[row][col + 1] !== PieceType.EMPTY) {
        priority += 20;
      }
    } else {
      if (board[row][col] === PieceType.EMPTY) priority += 10;
      if (board[row + 1][col] === PieceType.EMPTY) priority += 10;
      
      // Higher priority if one side is known and other is empty
      if (board[row][col] !== PieceType.EMPTY && board[row + 1][col] === PieceType.EMPTY) {
        priority += 20;
      }
      if (board[row][col] === PieceType.EMPTY && board[row + 1][col] !== PieceType.EMPTY) {
        priority += 20;
      }
    }
    
    return Math.max(1, priority);
  }

  validateSolutionConstraints(
    solution: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Check horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        const constraint = hConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const left = solution[row][col];
          const right = solution[row][col + 1];
          
          if (constraint === ConstraintType.SAME && left !== right) return false;
          if (constraint === ConstraintType.DIFFERENT && left === right) return false;
        }
      }
    }
    
    // Check vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        const constraint = vConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const top = solution[row][col];
          const bottom = solution[row + 1][col];
          
          if (constraint === ConstraintType.SAME && top !== bottom) return false;
          if (constraint === ConstraintType.DIFFERENT && top === bottom) return false;
        }
      }
    }
    
    return true;
  }
}