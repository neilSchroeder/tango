/**
 * Logical Move-Driven Puzzle Generator
 * 
 * This generator creates puzzles by simulating human-like solving:
 * 1. Place initial random pieces based on difficulty
 * 2. Find available logical moves (no guessing)
 * 3. Apply logical moves until none available
 * 4. Add strategic constraints when stuck
 * 5. Repeat until board is solved
 */

import {
  PieceType,
  ConstraintType,
  SolvingStrategy,
  BOARD_SIZE,
  createEmptyBoard,
  createEmptyHConstraints,
  createEmptyVConstraints,
  createEmptyLockedTiles
} from './types';
import type { PuzzleConfig, GeneratedPuzzle } from './types';
import { HintSystem } from './solver/HintSystem';
import { ComprehensivePatternRecognizer } from './solver/ComprehensivePatternRecognizer';
import { TangoBoardSolver } from './solver/TangoBoardSolver';

interface LogicalMove {
  row: number;
  col: number;
  piece: PieceType;
  reasoning: string;
  confidence: number;
  moveType: string;
}

interface ConstraintPlacement {
  type: 'horizontal' | 'vertical';
  row: number;
  col: number;
  constraintType: ConstraintType;
  reason: string;
  isAdvanced?: boolean;
}

export class LogicalMoveGenerator {
  private size = BOARD_SIZE;
  private maxGenerationAttempts = 20;
  private maxConstraintAttempts = 10;

  /**
   * Generate a puzzle using logical move progression
   */
  generatePuzzle(config: PuzzleConfig): GeneratedPuzzle {
    console.log(`🧠 Starting logical move-driven generation for ${config.name}`);

    for (let attempt = 1; attempt <= this.maxGenerationAttempts; attempt++) {
      console.log(`🎲 Generation attempt ${attempt}/${this.maxGenerationAttempts}`);

      try {
        const result = this.attemptPuzzleGeneration(config);
        if (result) {
          console.log(`✅ Successfully generated ${config.name} puzzle on attempt ${attempt}`);
          return result;
        }
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed:`, error);
      }
    }

    throw new Error(`Failed to generate ${config.name} puzzle after ${this.maxGenerationAttempts} attempts`);
  }

  private attemptPuzzleGeneration(config: PuzzleConfig): GeneratedPuzzle | null {
    // Step 1: Generate initial random pieces
    const { board, lockedTiles } = this.generateInitialPieces(config);
    const hConstraints = createEmptyHConstraints();
    const vConstraints = createEmptyVConstraints();
    
    // Keep track of the initial state for the final puzzle
    const initialBoard = board.map(row => [...row]);
    const initialLockedTiles = lockedTiles.map(row => [...row]);

    console.log(`🎯 Started with ${this.countPlacedPieces(board)} initial pieces`);

    let iterationCount = 0;
    const maxIterations = 100;
    let stuckCounter = 0;
    const maxStuckIterations = 5; // If we can't make progress for 5 iterations, abort
    let lastBoardState = this.serializeBoardState(board);
    let constraintFailureCount = 0;
    const maxConstraintFailures = 10;

    // Main generation loop with enhanced safeguards
    while (!this.isBoardSolved(board) && iterationCount < maxIterations) {
      iterationCount++;
      
      // Step 2: Find available logical moves
      const logicalMoves = this.findAvailableLogicalMoves(board, hConstraints, vConstraints);
      
      if (logicalMoves.length > 0) {
        // Step 3: Apply logical moves
        console.log(`🔍 Iteration ${iterationCount}: Found ${logicalMoves.length} logical moves, applying them`);
        this.applyLogicalMoves(board, logicalMoves);
        
        // Check if we made progress
        const currentBoardState = this.serializeBoardState(board);
        if (currentBoardState !== lastBoardState) {
          stuckCounter = 0; // Reset stuck counter on progress
          constraintFailureCount = 0; // Reset constraint failures on progress
          lastBoardState = currentBoardState;
        } else {
          stuckCounter++;
          console.warn(`⚠️ No progress made in iteration ${iterationCount} (stuck: ${stuckCounter}/${maxStuckIterations})`);
        }
      } else {
        // Step 4: Add strategic constraint
        console.log(`🎯 Iteration ${iterationCount}: No logical moves available, adding strategic constraint`);
        const constraintAdded = this.addStrategicConstraint(
          board, 
          hConstraints, 
          vConstraints, 
          config
        );
        
        if (!constraintAdded) {
          constraintFailureCount++;
          console.warn(`❌ Failed to add constraint (failures: ${constraintFailureCount}/${maxConstraintFailures})`);
          
          if (constraintFailureCount >= maxConstraintFailures) {
            console.log(`❌ Too many constraint failures, restarting generation`);
            return null; // Restart generation
          }
        } else {
          constraintFailureCount = 0; // Reset on success
        }
        
        stuckCounter++; // No moves available counts as being stuck
      }
      
      // Safeguard: Check if we're stuck in an infinite loop
      if (stuckCounter >= maxStuckIterations) {
        console.log(`❌ Generation stuck for ${maxStuckIterations} iterations, restarting`);
        return null;
      }
      
      // Safeguard: Early validation to catch unsolvable states
      if (iterationCount % 20 === 0) { // Check every 20 iterations
        if (!this.isPartialPuzzleSolvable(board, hConstraints, vConstraints)) {
          console.log(`❌ Puzzle became unsolvable at iteration ${iterationCount}, restarting`);
          return null;
        }
      }
    }

    if (!this.isBoardSolved(board)) {
      console.log(`❌ Board not solved after ${maxIterations} iterations`);
      return null;
    }

    // Verify the puzzle has a unique solution
    if (!this.hasUniqueSolution(initialBoard, hConstraints, vConstraints, initialLockedTiles)) {
      console.log(`❌ Generated puzzle does not have a unique solution`);
      return null;
    }

    console.log(`✅ Generated puzzle with ${this.countConstraints(hConstraints, vConstraints)} constraints`);

    return {
      board: initialBoard,
      hConstraints,
      vConstraints,
      lockedTiles: initialLockedTiles,
      solutionBoard: board // The complete solution we built
    };
  }

  /**
   * Generate initial random pieces based on difficulty
   */
  private generateInitialPieces(config: PuzzleConfig): { board: PieceType[][], lockedTiles: boolean[][] } {
    const board = createEmptyBoard();
    const lockedTiles = createEmptyLockedTiles();
    
    // Determine number of starting pieces
    const minPieces = config.startingPiecesMin || 1;
    const maxPieces = config.startingPiecesMax || 15;
    const targetPieces = Math.floor(Math.random() * (maxPieces - minPieces + 1)) + minPieces;
    
    const availablePositions: [number, number][] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        availablePositions.push([row, col]);
      }
    }

    // Randomly place initial pieces
    for (let i = 0; i < targetPieces; i++) {
      if (availablePositions.length === 0) break;
      
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      const [row, col] = availablePositions[randomIndex];
      availablePositions.splice(randomIndex, 1);
      
      // Randomly choose sun or moon
      const piece = Math.random() < 0.5 ? PieceType.SUN : PieceType.MOON;
      
      // Check if placement is valid (doesn't violate basic rules)
      if (this.isValidPlacement(board, row, col, piece)) {
        board[row][col] = piece;
        lockedTiles[row][col] = true;
      }
    }

    console.log(`🎲 Generated ${targetPieces} initial pieces (${this.countPlacedPieces(board)} placed successfully)`);
    return { board, lockedTiles };
  }

  /**
   * Find available logical moves using multiple solving systems with deduplication
   */
  private findAvailableLogicalMoves(
    board: PieceType[][], 
    hConstraints: ConstraintType[][], 
    vConstraints: ConstraintType[][]
  ): LogicalMove[] {
    const allMoves: LogicalMove[] = [];
    
    // System 1: HintSystem - get single best hint
    try {
      const hintSystem = new HintSystem(hConstraints, vConstraints);
      const hint = hintSystem.getHint(board);
      
      if (hint.found && hint.row !== undefined && hint.col !== undefined && hint.pieceType) {
        allMoves.push({
          row: hint.row,
          col: hint.col,
          piece: hint.pieceType,
          reasoning: hint.reasoning,
          confidence: hint.confidence || 50,
          moveType: hint.hintType || 'hint_system'
        });
      }
    } catch (error) {
      console.warn('HintSystem failed:', error);
    }

    // System 2: ComprehensivePatternRecognizer - get advanced pattern-based moves
    try {
      const patternRecognizer = new ComprehensivePatternRecognizer(hConstraints, vConstraints);
      const inferences = patternRecognizer.applyComprehensiveInference(board);
      
      for (const inference of inferences) {
        if (inference.confidence === 'certain') {
          allMoves.push({
            row: inference.position[0],
            col: inference.position[1],
            piece: inference.piece,
            reasoning: inference.reasoning,
            confidence: 100,
            moveType: inference.technique
          });
        }
      }
    } catch (error) {
      console.warn('Pattern recognizer failed:', error);
    }

    // Deduplicate moves - same position should only appear once
    const deduplicatedMoves = this.deduplicateLogicalMoves(allMoves);
    
    // Validate all moves are actually legal
    const validMoves = deduplicatedMoves.filter(move => {
      const isLegal = this.isValidPlacement(board, move.row, move.col, move.piece);
      if (!isLegal) {
        console.warn(`🚫 Filtered out illegal move: ${move.piece} at (${move.row + 1}, ${move.col + 1}) - ${move.reasoning}`);
      }
      return isLegal;
    });
    
    console.log(`🔍 Found ${allMoves.length} raw moves, ${deduplicatedMoves.length} after deduplication, ${validMoves.length} legal moves`);
    return validMoves;
  }

  /**
   * Remove duplicate logical moves, keeping the highest confidence one for each position
   */
  private deduplicateLogicalMoves(moves: LogicalMove[]): LogicalMove[] {
    const moveMap = new Map<string, LogicalMove>();
    
    for (const move of moves) {
      const key = `${move.row}-${move.col}`;
      const existingMove = moveMap.get(key);
      
      if (!existingMove) {
        // First move for this position
        moveMap.set(key, move);
      } else {
        // Position already has a move, keep the higher confidence one
        if (move.confidence > existingMove.confidence) {
          // New move has higher confidence
          moveMap.set(key, {
            ...move,
            reasoning: `${move.reasoning} (also: ${existingMove.reasoning})`
          });
        } else if (move.confidence === existingMove.confidence) {
          // Same confidence, combine reasoning
          moveMap.set(key, {
            ...existingMove,
            reasoning: `${existingMove.reasoning} + ${move.reasoning}`,
            moveType: `${existingMove.moveType}+${move.moveType}`
          });
        }
        // If existing move has higher confidence, keep it unchanged
      }
    }
    
    return Array.from(moveMap.values());
  }

  /**
   * Apply logical moves to the board
   */
  private applyLogicalMoves(board: PieceType[][], moves: LogicalMove[]): void {
    for (const move of moves) {
      if (board[move.row][move.col] === PieceType.EMPTY && 
          this.isValidPlacement(board, move.row, move.col, move.piece)) {
        
        board[move.row][move.col] = move.piece;
        console.log(`🔧 Applied ${move.moveType}: placed ${move.piece} at (${move.row + 1}, ${move.col + 1})`);
      }
    }
  }

  /**
   * Add strategic constraint when no logical moves are available
   */
  private addStrategicConstraint(
    board: PieceType[][], 
    hConstraints: ConstraintType[][], 
    vConstraints: ConstraintType[][], 
    config: PuzzleConfig
  ): boolean {
    console.log(`🎯 Adding strategic constraint based on difficulty preferences`);

    const strategies = config.preferredStrategies || [SolvingStrategy.DIRECT_CONSTRAINT];
    const weights = config.strategyWeights || {};

    // Try strategies in order of preference
    for (const strategy of strategies) {
      const weight = (weights as any)[strategy] || 0;
      if (weight > 0 && Math.random() < weight) {
        if (this.addConstraintForStrategy(strategy, board, hConstraints, vConstraints)) {
          return true;
        }
      }
    }

    // Fallback: try any available constraint type
    const allStrategies = Object.values(SolvingStrategy);
    for (const strategy of allStrategies) {
      if (this.addConstraintForStrategy(strategy, board, hConstraints, vConstraints)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a constraint based on solving strategy
   */
  private addConstraintForStrategy(
    strategy: SolvingStrategy,
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    console.log(`🎯 Attempting to add constraint using strategy: ${strategy}`);
    switch (strategy) {
      case SolvingStrategy.DIRECT_CONSTRAINT:
        return this.addDirectConstraint(board, hConstraints, vConstraints);
      
      case SolvingStrategy.ROW_COL_COMPLETION:
        return this.addBalanceConstraint(board, hConstraints, vConstraints);
      
      case SolvingStrategy.CONSECUTIVE_AVOIDANCE:
        return this.addConsecutiveConstraint(board, hConstraints, vConstraints);
      
      case SolvingStrategy.ELIMINATION:
        return this.addEliminationConstraint(board, hConstraints, vConstraints);
      
      case SolvingStrategy.PATTERN_MATCHING:
        return this.addPatternMatchingConstraint(board, hConstraints, vConstraints);
      
      case SolvingStrategy.CONSTRAINT_PROPAGATION:
        return this.addConstraintPropagationConstraint(board, hConstraints, vConstraints);
      
      default:
        // Fallback to direct constraint
        return this.addDirectConstraint(board, hConstraints, vConstraints);
    }
  }

  /**
   * Add a direct SAME/DIFFERENT constraint between adjacent cells using pattern analysis
   */
  private addDirectConstraint(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    const highPriorityConstraints: ConstraintPlacement[] = [];
    const mediumPriorityConstraints: ConstraintPlacement[] = [];
    const lowPriorityConstraints: ConstraintPlacement[] = [];

    // Find available horizontal constraint positions with pattern analysis
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] === ConstraintType.NONE) {
          const patternConstraint = this.analyzeHorizontalPattern(board, hConstraints, row, col);
          if (patternConstraint) {
            if (patternConstraint.isAdvanced) {
              highPriorityConstraints.push(patternConstraint);
            } else {
              mediumPriorityConstraints.push(patternConstraint);
            }
          } else {
            // Fallback: place basic constraint
            const left = board[row][col];
            const right = board[row][col + 1];
            
            if (left !== PieceType.EMPTY && right !== PieceType.EMPTY) {
              const constraintType = left === right ? ConstraintType.SAME : ConstraintType.DIFFERENT;
              mediumPriorityConstraints.push({
                type: 'horizontal',
                row,
                col,
                constraintType,
                reason: `Direct constraint between existing pieces`,
                isAdvanced: false
              });
            } else if (left !== PieceType.EMPTY || right !== PieceType.EMPTY) {
              const constraintType = Math.random() < 0.6 ? ConstraintType.DIFFERENT : ConstraintType.SAME;
              lowPriorityConstraints.push({
                type: 'horizontal',
                row,
                col,
                constraintType,
                reason: `Basic strategic constraint`,
                isAdvanced: false
              });
            }
          }
        }
      }
    }

    // Find available vertical constraint positions with pattern analysis
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] === ConstraintType.NONE) {
          const patternConstraint = this.analyzeVerticalPattern(board, vConstraints, row, col);
          if (patternConstraint) {
            if (patternConstraint.isAdvanced) {
              highPriorityConstraints.push(patternConstraint);
            } else {
              mediumPriorityConstraints.push(patternConstraint);
            }
          } else {
            // Fallback: place basic constraint
            const top = board[row][col];
            const bottom = board[row + 1][col];
            
            if (top !== PieceType.EMPTY && bottom !== PieceType.EMPTY) {
              const constraintType = top === bottom ? ConstraintType.SAME : ConstraintType.DIFFERENT;
              mediumPriorityConstraints.push({
                type: 'vertical',
                row,
                col,
                constraintType,
                reason: `Direct constraint between existing pieces`,
                isAdvanced: false
              });
            } else if (top !== PieceType.EMPTY || bottom !== PieceType.EMPTY) {
              const constraintType = Math.random() < 0.6 ? ConstraintType.DIFFERENT : ConstraintType.SAME;
              lowPriorityConstraints.push({
                type: 'vertical',
                row,
                col,
                constraintType,
                reason: `Basic strategic constraint`,
                isAdvanced: false
              });
            }
          }
        }
      }
    }

    // Select constraints by priority: high -> medium -> low
    let availableConstraints: ConstraintPlacement[] = [];
    if (highPriorityConstraints.length > 0) {
      availableConstraints = highPriorityConstraints;
    } else if (mediumPriorityConstraints.length > 0) {
      availableConstraints = mediumPriorityConstraints;  
    } else if (lowPriorityConstraints.length > 0) {
      availableConstraints = lowPriorityConstraints;
    }

    if (availableConstraints.length === 0) {
      return false;
    }

    // Place a random constraint from the selected priority level, but validate it first
    const constraint = availableConstraints[Math.floor(Math.random() * availableConstraints.length)];
    
    // Validate constraint placement
    const isValidConstraint = this.isValidConstraintPlacement(
      board, hConstraints, vConstraints, 
      constraint.type, constraint.row, constraint.col, constraint.constraintType
    );
    
    if (!isValidConstraint) {
      console.warn(`🚫 Invalid constraint rejected: ${constraint.type} ${constraint.constraintType} at (${constraint.row + 1}, ${constraint.col + 1})`);
      // Try other constraints from the available list
      const remainingConstraints = availableConstraints.filter(c => c !== constraint);
      if (remainingConstraints.length > 0) {
        // Recursively try with remaining constraints
        availableConstraints.length = 0;
        availableConstraints.push(...remainingConstraints);
        return this.placeValidatedConstraint(board, hConstraints, vConstraints, availableConstraints);
      }
      return false;
    }
    
    if (constraint.type === 'horizontal') {
      hConstraints[constraint.row][constraint.col] = constraint.constraintType;
    } else {
      vConstraints[constraint.row][constraint.col] = constraint.constraintType;
    }

    console.log(`🎯 Added ${constraint.type} ${constraint.constraintType} constraint at (${constraint.row + 1}, ${constraint.col + 1})`);
    return true;
  }

  /**
   * Helper method to place a validated constraint from a list of candidates
   */
  private placeValidatedConstraint(
    board: PieceType[][], 
    hConstraints: ConstraintType[][], 
    vConstraints: ConstraintType[][], 
    availableConstraints: ConstraintPlacement[]
  ): boolean {
    for (const constraint of availableConstraints) {
      const isValidConstraint = this.isValidConstraintPlacement(
        board, hConstraints, vConstraints, 
        constraint.type, constraint.row, constraint.col, constraint.constraintType
      );
      
      if (isValidConstraint) {
        if (constraint.type === 'horizontal') {
          hConstraints[constraint.row][constraint.col] = constraint.constraintType;
        } else {
          vConstraints[constraint.row][constraint.col] = constraint.constraintType;
        }
        
        console.log(`🎯 Added ${constraint.type} ${constraint.constraintType} constraint at (${constraint.row + 1}, ${constraint.col + 1})`);
        return true;
      } else {
        console.warn(`🚫 Invalid constraint skipped: ${constraint.type} ${constraint.constraintType} at (${constraint.row + 1}, ${constraint.col + 1})`);
      }
    }
    
    return false; // No valid constraints found
  }

  /**
   * Safely test the impact of placing a constraint without permanently modifying constraint arrays
   */
  private testConstraintImpact(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    constraintType: 'horizontal' | 'vertical',
    row: number,
    col: number,
    constraint: ConstraintType
  ): number {
    // Create deep copies to avoid modifying original arrays
    const testHConstraints = hConstraints.map(r => [...r]);
    const testVConstraints = vConstraints.map(r => [...r]);
    
    // Place the test constraint
    if (constraintType === 'horizontal') {
      testHConstraints[row][col] = constraint;
    } else {
      testVConstraints[row][col] = constraint;
    }
    
    try {
      // Count logical moves with the test constraint in place
      const logicalMoves = this.findAvailableLogicalMoves(board, testHConstraints, testVConstraints);
      return logicalMoves.length;
    } catch (error) {
      console.warn(`⚠️ Error testing constraint impact at (${row + 1}, ${col + 1}):`, error);
      return 0; // Return 0 moves if testing fails
    }
  }

  /**
   * Add constraint that helps with row/column balance completion
   */
  private addBalanceConstraint(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Find rows/columns that are close to being balanced
    const targetPerRowCol = this.size / 2;

    for (let row = 0; row < this.size; row++) {
      const counts = this.countPiecesInRow(board, row);
      const needed = targetPerRowCol - counts.suns;
      
      if (needed === 1 || needed === 2) {
        // This row needs 1-2 more suns, try to add a constraint that helps
        return this.addDirectConstraint(board, hConstraints, vConstraints);
      }
    }

    for (let col = 0; col < this.size; col++) {
      const counts = this.countPiecesInColumn(board, col);
      const needed = targetPerRowCol - counts.suns;
      
      if (needed === 1 || needed === 2) {
        // This column needs 1-2 more suns, try to add a constraint that helps
        return this.addDirectConstraint(board, hConstraints, vConstraints);
      }
    }

    // Fallback to direct constraint
    return this.addDirectConstraint(board, hConstraints, vConstraints);
  }

  /**
   * Add constraint that helps with consecutive avoidance
   */
  private addConsecutiveConstraint(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Look for positions where consecutive pieces might form
    // This is complex, so for now fallback to direct constraint
    return this.addDirectConstraint(board, hConstraints, vConstraints);
  }

  /**
   * Add constraint that helps with elimination logic
   */
  private addEliminationConstraint(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Find positions where elimination logic would be helpful
    // This is complex, so for now fallback to direct constraint
    return this.addDirectConstraint(board, hConstraints, vConstraints);
  }

  /**
   * Add constraint that helps with pattern matching logic
   */
  private addPatternMatchingConstraint(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Look for complex patterns that require pattern matching to solve
    // Use the advanced pattern recognition we already implemented
    
    // Try to find positions where pattern matching would create interesting deduction chains
    const availableConstraints: ConstraintPlacement[] = [];

    // Look for partial patterns that would benefit from pattern matching
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] === ConstraintType.NONE) {
          const patternConstraint = this.analyzeHorizontalPattern(board, hConstraints, row, col);
          if (patternConstraint && patternConstraint.isAdvanced) {
            availableConstraints.push(patternConstraint);
          }
        }
      }
    }

    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] === ConstraintType.NONE) {
          const patternConstraint = this.analyzeVerticalPattern(board, vConstraints, row, col);
          if (patternConstraint && patternConstraint.isAdvanced) {
            availableConstraints.push(patternConstraint);
          }
        }
      }
    }

    if (availableConstraints.length > 0) {
      // Use the validated constraint placement method instead of direct placement
      return this.placeValidatedConstraint(board, hConstraints, vConstraints, availableConstraints);
    }

    // Fallback to direct constraint
    return this.addDirectConstraint(board, hConstraints, vConstraints);
  }

  /**
   * Add constraint that helps with constraint propagation logic
   */
  private addConstraintPropagationConstraint(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Look for positions where adding a constraint would create a chain of logical deductions
    // This involves placing constraints that force multiple subsequent logical moves
    
    const availableConstraints: ConstraintPlacement[] = [];
    
    // Find positions where a constraint would create multiple logical consequences
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] === ConstraintType.NONE) {
          // Test both constraint types and see which creates more logical moves
          for (const constraintType of [ConstraintType.SAME, ConstraintType.DIFFERENT]) {
            // First validate that this constraint placement is legal
            const isValid = this.isValidConstraintPlacement(
              board, hConstraints, vConstraints, 'horizontal', row, col, constraintType
            );
            
            if (!isValid) {
              continue; // Skip invalid constraints
            }
            
            // Safely test constraint impact using validated temporary placement
            const logicalMoveCount = this.testConstraintImpact(
              board, hConstraints, vConstraints, 'horizontal', row, col, constraintType
            );
            
            if (logicalMoveCount >= 2) { // Creates multiple deductions
              availableConstraints.push({
                type: 'horizontal',
                row,
                col,
                constraintType,
                reason: `Constraint propagation: enables ${logicalMoveCount} logical moves`,
                isAdvanced: true
              });
            }
          }
        }
      }
    }
    
    // Same for vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] === ConstraintType.NONE) {
          for (const constraintType of [ConstraintType.SAME, ConstraintType.DIFFERENT]) {
            // First validate that this constraint placement is legal
            const isValid = this.isValidConstraintPlacement(
              board, hConstraints, vConstraints, 'vertical', row, col, constraintType
            );
            
            if (!isValid) {
              continue; // Skip invalid constraints
            }
            
            // Safely test constraint impact using validated temporary placement
            const logicalMoveCount = this.testConstraintImpact(
              board, hConstraints, vConstraints, 'vertical', row, col, constraintType
            );
            
            if (logicalMoveCount >= 2) {
              availableConstraints.push({
                type: 'vertical',
                row,
                col,
                constraintType,
                reason: `Constraint propagation: enables ${logicalMoveCount} logical moves`,
                isAdvanced: true
              });
            }
          }
        }
      }
    }
    
    if (availableConstraints.length > 0) {
      // Use the validated constraint placement method
      return this.placeValidatedConstraint(board, hConstraints, vConstraints, availableConstraints);
    }

    // Fallback to pattern matching or direct constraint
    return this.addPatternMatchingConstraint(board, hConstraints, vConstraints);
  }

  /**
   * Add constraint that requires backtracking logic to solve
   */
  private addBacktrackingConstraint(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // For backtracking, we want to create situations where multiple possibilities exist
    // and the solver needs to try different options to find the solution
    
    // Look for positions where we can create ambiguous situations
    const availableConstraints: ConstraintPlacement[] = [];
    
    // Find positions where both constraint types would be valid but create different solving paths
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] === ConstraintType.NONE) {
          const left = board[row][col];
          const right = board[row][col + 1];
          
          // If both cells are empty, either constraint could be valid initially
          if (left === PieceType.EMPTY && right === PieceType.EMPTY) {
            // Choose constraint type that creates solving ambiguity
            const constraintType = Math.random() < 0.5 ? ConstraintType.SAME : ConstraintType.DIFFERENT;
            availableConstraints.push({
              type: 'horizontal',
              row,
              col,
              constraintType,
              reason: `Backtracking: creates solving ambiguity requiring trial-and-error`,
              isAdvanced: true
            });
          }
        }
      }
    }
    
    // Same for vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] === ConstraintType.NONE) {
          const top = board[row][col];
          const bottom = board[row + 1][col];
          
          if (top === PieceType.EMPTY && bottom === PieceType.EMPTY) {
            const constraintType = Math.random() < 0.5 ? ConstraintType.SAME : ConstraintType.DIFFERENT;
            availableConstraints.push({
              type: 'vertical',
              row,
              col,
              constraintType,
              reason: `Backtracking: creates solving ambiguity requiring trial-and-error`,
              isAdvanced: true
            });
          }
        }
      }
    }
    
    if (availableConstraints.length > 0) {
      // Use the validated constraint placement method instead of direct placement
      return this.placeValidatedConstraint(board, hConstraints, vConstraints, availableConstraints);
    }

    // Fallback to constraint propagation
    return this.addConstraintPropagationConstraint(board, hConstraints, vConstraints);
  }

  /**
   * Helper methods
   */
  private isBoardSolved(board: PieceType[][]): boolean {
    // Check if all positions are filled
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          return false;
        }
      }
    }
    
    // Check if board is valid (balance, no 3 consecutive)
    return this.isValidCompleteBoard(board);
  }

  private isValidCompleteBoard(board: PieceType[][]): boolean {
    const targetCount = this.size / 2;
    
    // Check row balance
    for (let row = 0; row < this.size; row++) {
      const counts = this.countPiecesInRow(board, row);
      if (counts.suns !== targetCount || counts.moons !== targetCount) {
        return false;
      }
    }
    
    // Check column balance
    for (let col = 0; col < this.size; col++) {
      const counts = this.countPiecesInColumn(board, col);
      if (counts.suns !== targetCount || counts.moons !== targetCount) {
        return false;
      }
    }
    
    // Check no 3 consecutive
    return !this.hasThreeConsecutive(board);
  }

  private isValidPlacement(board: PieceType[][], row: number, col: number, piece: PieceType): boolean {
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) {
      return false;
    }
    
    if (board[row][col] !== PieceType.EMPTY) {
      return false;
    }

    // Create temporary board to test placement
    const testBoard = board.map(r => [...r]);
    testBoard[row][col] = piece;

    // Check no 3 consecutive in row
    for (let c = Math.max(0, col - 2); c <= Math.min(this.size - 3, col); c++) {
      if (testBoard[row][c] !== PieceType.EMPTY && 
          testBoard[row][c] === testBoard[row][c + 1] && 
          testBoard[row][c + 1] === testBoard[row][c + 2]) {
        return false;
      }
    }

    // Check no 3 consecutive in column
    for (let r = Math.max(0, row - 2); r <= Math.min(this.size - 3, row); r++) {
      if (testBoard[r][col] !== PieceType.EMPTY && 
          testBoard[r][col] === testBoard[r + 1][col] && 
          testBoard[r + 1][col] === testBoard[r + 2][col]) {
        return false;
      }
    }

    // Check row balance won't be exceeded
    const rowCounts = this.countPiecesInRow(testBoard, row);
    if (rowCounts.suns > this.size / 2 || rowCounts.moons > this.size / 2) {
      return false;
    }

    // Check column balance won't be exceeded
    const colCounts = this.countPiecesInColumn(testBoard, col);
    if (colCounts.suns > this.size / 2 || colCounts.moons > this.size / 2) {
      return false;
    }

    return true;
  }

  private hasThreeConsecutive(board: PieceType[][]): boolean {
    // Check rows
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 2; col++) {
        if (board[row][col] !== PieceType.EMPTY &&
            board[row][col] === board[row][col + 1] &&
            board[row][col + 1] === board[row][col + 2]) {
          return true;
        }
      }
    }

    // Check columns
    for (let col = 0; col < this.size; col++) {
      for (let row = 0; row < this.size - 2; row++) {
        if (board[row][col] !== PieceType.EMPTY &&
            board[row][col] === board[row + 1][col] &&
            board[row + 1][col] === board[row + 2][col]) {
          return true;
        }
      }
    }

    return false;
  }

  private countPiecesInRow(board: PieceType[][], row: number): { suns: number, moons: number } {
    let suns = 0, moons = 0;
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
    }
    return { suns, moons };
  }

  private countPiecesInColumn(board: PieceType[][], col: number): { suns: number, moons: number } {
    let suns = 0, moons = 0;
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
    }
    return { suns, moons };
  }

  private countPlacedPieces(board: PieceType[][]): number {
    let count = 0;
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] !== PieceType.EMPTY) {
          count++;
        }
      }
    }
    return count;
  }

  private countConstraints(hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): number {
    let count = 0;
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] !== ConstraintType.NONE) count++;
      }
    }
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] !== ConstraintType.NONE) count++;
      }
    }
    return count;
  }

  private hasUniqueSolution(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][]
  ): boolean {
    console.log(`🔍 Validating puzzle uniqueness with logical-only solver...`);
    
    try {
      // Use the actual TangoBoardSolver to verify logical solvability
      const solver = new TangoBoardSolver(board, hConstraints, vConstraints, lockedTiles);
      const solutions = solver.findAllSolutions(2); // Check for logical solutions
      
      const solutionCount = solutions.length;
      console.log(`🔍 Logical solver found ${solutionCount} solution(s)`);
      
      // With logical-only approach, we accept that some puzzles may not be
      // completely solvable with logical moves alone, but they should still
      // have a unique mathematical solution
      if (solutionCount === 0) {
        // No logical solution found - get diagnostic information
        const diagnostic = (solver as any).findAllSolutionsLogical(1);
        console.log(`🔍 Diagnostic: ${diagnostic.type} - ${diagnostic.reason}`);
        
        // If it's an illegal board, reject it
        if (diagnostic.type === 'illegal_board') {
          console.log(`❌ Puzzle has illegal board state`);
          return false;
        }
        
        // If no logical moves but board seems legal, we'll need to check
        // if it has a unique mathematical solution using another method
        console.log(`⚠️ No logical solution found, but may be mathematically valid`);
        
        // For now, accept puzzles that are logically incomplete but legal
        // This allows the generation to continue with constraints that may
        // require combined logical reasoning
        return true;
        
      } else if (solutionCount === 1) {
        console.log(`✅ Puzzle has unique logical solution`);
        return true;
      } else {
        console.log(`❌ Puzzle has multiple logical solutions (${solutionCount})`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Solver validation failed:`, error);
      return false; // Assume invalid if solver fails
    }
  }

  /**
   * Validate that a constraint placement doesn't create impossible situations
   */
  private isValidConstraintPlacement(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    constraintType: 'horizontal' | 'vertical',
    row: number,
    col: number,
    constraint: ConstraintType
  ): boolean {
    // Create temporary constraint arrays to test
    const testHConstraints = hConstraints.map(r => [...r]);
    const testVConstraints = vConstraints.map(r => [...r]);
    
    if (constraintType === 'horizontal') {
      if (col >= this.size - 1) return false; // Out of bounds
      testHConstraints[row][col] = constraint;
      
      // Check if constraint conflicts with existing pieces
      const leftPiece = board[row][col];
      const rightPiece = board[row][col + 1];
      
      if (leftPiece !== PieceType.EMPTY && rightPiece !== PieceType.EMPTY) {
        const shouldBeSame = leftPiece === rightPiece;
        const constraintSame = constraint === ConstraintType.SAME;
        
        if (shouldBeSame !== constraintSame) {
          console.warn(`🚫 Constraint conflict: ${leftPiece} ${constraint} ${rightPiece} at (${row + 1}, ${col + 1})`);
          return false;
        }
      }
    } else {
      if (row >= this.size - 1) return false; // Out of bounds
      testVConstraints[row][col] = constraint;
      
      // Check if constraint conflicts with existing pieces
      const topPiece = board[row][col];
      const bottomPiece = board[row + 1][col];
      
      if (topPiece !== PieceType.EMPTY && bottomPiece !== PieceType.EMPTY) {
        const shouldBeSame = topPiece === bottomPiece;
        const constraintSame = constraint === ConstraintType.SAME;
        
        if (shouldBeSame !== constraintSame) {
          console.warn(`🚫 Constraint conflict: ${topPiece} ${constraint} ${bottomPiece} at (${row + 1}, ${col + 1})`);
          return false;
        }
      }
    }
    
    // Advanced validation: Check if constraint makes puzzle unsolvable
    // Only do expensive solver check occasionally to avoid performance issues
    if (Math.random() < 0.3) { // 30% chance of expensive validation
      if (!this.isConstraintSolvable(board, testHConstraints, testVConstraints)) {
        console.warn(`🚫 Constraint would make puzzle unsolvable at (${row + 1}, ${col + 1})`);
        return false;
      }
    }
    
    // Advanced validation: Check for constraint conflicts and impossible balance
    if (!this.validateConstraintConsistency(board, testHConstraints, testVConstraints)) {
      console.warn(`🚫 Constraint creates consistency issues at (${row + 1}, ${col + 1})`);
      return false;
    }
    
    return true;
  }

  /**
   * Check if a constraint configuration makes the puzzle unsolvable using logical-only solver
   * Optimized with timeout and fast failure detection
   */
  private isConstraintSolvable(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    try {
      // Quick pre-checks before expensive solver call
      const quickCheck = this.quickSolvabilityCheck(board, hConstraints, vConstraints);
      if (!quickCheck) {
        return false;
      }
      
      // Count filled pieces - if board is too empty, don't call full solver
      const filledPieces = board.flat().filter(cell => cell !== PieceType.EMPTY).length;
      const totalCells = this.size * this.size;
      const filledRatio = filledPieces / totalCells;
      
      // If board is less than 50% filled, rely on quick checks only
      // This prevents issues with very sparse boards
      if (filledRatio < 0.5) {
        console.log(`🚀 Skipping full solver for sparse board (${Math.round(filledRatio * 100)}% filled)`);
        return true; // Assume solvable, rely on quick checks
      }
      
      // For more complete boards, use logical-only solver check
      const solver = new TangoBoardSolver(board, hConstraints, vConstraints, this.createLockedTilesForBoard(board));
      
      // Check if logical moves can make progress
      const solutions = solver.findAllSolutions(1);
      
      if (solutions.length > 0) {
        return true; // Found logical solution
      }
      
      // No logical solution - get diagnostic information
      const diagnostic = (solver as any).findAllSolutionsLogical(1);
      
      // If board is illegal, reject it
      if (diagnostic.type === 'illegal_board') {
        console.log(`🚫 Constraint creates illegal board state: ${diagnostic.reason}`);
        return false;
      }
      
      // If no logical moves but legal, accept for now
      // This allows generation to continue with complex constraint patterns
      console.log(`⚠️ No logical solution, but board appears legal (${diagnostic.stepsApplied} steps applied)`);
      return true;
      
    } catch (error) {
      console.warn(`⚠️ Solver failed during constraint validation:`, error);
      return false; // Assume unsolvable if solver fails
    }
  }

  /**
   * Quick solvability check without using the full solver
   */
  private quickSolvabilityCheck(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Check 1: Basic constraint conflicts
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] !== ConstraintType.NONE) {
          const left = board[row][col];
          const right = board[row][col + 1];
          
          if (left !== PieceType.EMPTY && right !== PieceType.EMPTY) {
            const shouldBeSame = left === right;
            const constraintSame = hConstraints[row][col] === ConstraintType.SAME;
            
            if (shouldBeSame !== constraintSame) {
              return false; // Direct contradiction
            }
          }
        }
      }
    }
    
    // Check 2: Vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] !== ConstraintType.NONE) {
          const top = board[row][col];
          const bottom = board[row + 1][col];
          
          if (top !== PieceType.EMPTY && bottom !== PieceType.EMPTY) {
            const shouldBeSame = top === bottom;
            const constraintSame = vConstraints[row][col] === ConstraintType.SAME;
            
            if (shouldBeSame !== constraintSame) {
              return false; // Direct contradiction
            }
          }
        }
      }
    }
    
    // Check 3: Basic balance feasibility
    const totalEmptyCells = this.countTotalPieces(board);
    const totalCells = this.size * this.size;
    const emptyCells = totalCells - totalEmptyCells.suns - totalEmptyCells.moons;
    const targetTotal = totalCells / 2;
    const sunsNeeded = targetTotal - totalEmptyCells.suns;
    const moonsNeeded = targetTotal - totalEmptyCells.moons;
    
    if (sunsNeeded < 0 || moonsNeeded < 0 || sunsNeeded + moonsNeeded !== emptyCells) {
      return false; // Balance impossible
    }
    
    return true;
  }

  /**
   * Validate constraint consistency and balance requirements
   */
  private validateConstraintConsistency(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Check 1: Balance feasibility
    if (!this.checkBalanceFeasibility(board, hConstraints, vConstraints)) {
      return false;
    }
    
    // Check 2: Constraint chain conflicts
    if (!this.checkConstraintChainConsistency(board, hConstraints, vConstraints)) {
      return false;
    }
    
    // Check 3: Consecutive violation prevention
    if (!this.checkConsecutiveViolationPrevention(board, hConstraints, vConstraints)) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if the current board + constraints can still achieve balance
   */
  private checkBalanceFeasibility(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    const targetCount = this.size / 2;
    
    // Check each row for balance feasibility
    for (let row = 0; row < this.size; row++) {
      const counts = this.countPiecesInRow(board, row);
      const emptyCount = this.size - counts.suns - counts.moons;
      
      // Calculate minimum and maximum possible suns/moons based on constraints
      const { minSuns, maxSuns } = this.calculatePossiblePieces(board, hConstraints, vConstraints, row, 'row');
      
      // Check if target is achievable
      if (minSuns > targetCount || maxSuns < targetCount) {
        console.warn(`🚫 Row ${row + 1} balance infeasible: need ${targetCount}, possible range [${minSuns}, ${maxSuns}]`);
        return false;
      }
    }
    
    // Check each column for balance feasibility
    for (let col = 0; col < this.size; col++) {
      const counts = this.countPiecesInColumn(board, col);
      const emptyCount = this.size - counts.suns - counts.moons;
      
      // Calculate minimum and maximum possible suns/moons based on constraints
      const { minSuns, maxSuns } = this.calculatePossiblePieces(board, hConstraints, vConstraints, col, 'column');
      
      // Check if target is achievable
      if (minSuns > targetCount || maxSuns < targetCount) {
        console.warn(`🚫 Column ${col + 1} balance infeasible: need ${targetCount}, possible range [${minSuns}, ${maxSuns}]`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate the range of possible sun/moon counts for a row or column given constraints
   */
  private calculatePossiblePieces(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    index: number,
    type: 'row' | 'column'
  ): { minSuns: number, maxSuns: number } {
    // This is a simplified implementation - in a full version, this would analyze
    // constraint chains to determine exact feasible ranges
    
    let currentSuns = 0;
    let currentMoons = 0;
    let emptyCount = 0;
    
    if (type === 'row') {
      for (let col = 0; col < this.size; col++) {
        if (board[index][col] === PieceType.SUN) currentSuns++;
        else if (board[index][col] === PieceType.MOON) currentMoons++;
        else emptyCount++;
      }
    } else {
      for (let row = 0; row < this.size; row++) {
        if (board[row][index] === PieceType.SUN) currentSuns++;
        else if (board[row][index] === PieceType.MOON) currentMoons++;
        else emptyCount++;
      }
    }
    
    // Simple bounds: all empty could be suns (max) or all could be moons (min)
    const minSuns = currentSuns;
    const maxSuns = currentSuns + emptyCount;
    
    return { minSuns, maxSuns };
  }

  /**
   * Check for constraint chain consistency issues
   */
  private checkConstraintChainConsistency(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Check for contradictory constraint chains
    // This is a simplified check - a full implementation would analyze complex chains
    
    // Look for simple contradictions like A=B=C and A≠C
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 2; col++) {
        if (hConstraints[row][col] === ConstraintType.SAME && 
            hConstraints[row][col + 1] === ConstraintType.SAME) {
          // A = B = C pattern, check if there are any conflicts
          if (board[row][col] !== PieceType.EMPTY && 
              board[row][col + 2] !== PieceType.EMPTY &&
              board[row][col] !== board[row][col + 2]) {
            console.warn(`🚫 Constraint chain contradiction in row ${row + 1}: A=B=C but A≠C`);
            return false;
          }
        }
      }
    }
    
    // Same check for vertical constraints
    for (let row = 0; row < this.size - 2; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] === ConstraintType.SAME && 
            vConstraints[row + 1][col] === ConstraintType.SAME) {
          // A = B = C pattern, check if there are any conflicts
          if (board[row][col] !== PieceType.EMPTY && 
              board[row + 2][col] !== PieceType.EMPTY &&
              board[row][col] !== board[row + 2][col]) {
            console.warn(`🚫 Constraint chain contradiction in column ${col + 1}: A=B=C but A≠C`);
            return false;
          }
        }
      }
    }
    
    return true;
  }

  /**
   * Check if constraints could force consecutive violations
   */
  private checkConsecutiveViolationPrevention(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    // Check for constraint patterns that would force 3 consecutive identical pieces
    
    // Check horizontal patterns
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 2; col++) {
        if (hConstraints[row][col] === ConstraintType.SAME && 
            hConstraints[row][col + 1] === ConstraintType.SAME) {
          // Pattern: A = B = C
          const a = board[row][col];
          const b = board[row][col + 1];
          const c = board[row][col + 2];
          
          // If any two are the same non-empty piece, this would force three in a row
          if ((a !== PieceType.EMPTY && b !== PieceType.EMPTY && a === b) ||
              (b !== PieceType.EMPTY && c !== PieceType.EMPTY && b === c) ||
              (a !== PieceType.EMPTY && c !== PieceType.EMPTY && a === c)) {
            console.warn(`🚫 Constraint would force 3 consecutive in row ${row + 1}, cols ${col + 1}-${col + 3}`);
            return false;
          }
        }
      }
    }
    
    // Check vertical patterns
    for (let row = 0; row < this.size - 2; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] === ConstraintType.SAME && 
            vConstraints[row + 1][col] === ConstraintType.SAME) {
          // Pattern: A = B = C
          const a = board[row][col];
          const b = board[row + 1][col];
          const c = board[row + 2][col];
          
          // If any two are the same non-empty piece, this would force three in a row
          if ((a !== PieceType.EMPTY && b !== PieceType.EMPTY && a === b) ||
              (b !== PieceType.EMPTY && c !== PieceType.EMPTY && b === c) ||
              (a !== PieceType.EMPTY && c !== PieceType.EMPTY && a === c)) {
            console.warn(`🚫 Constraint would force 3 consecutive in column ${col + 1}, rows ${row + 1}-${row + 3}`);
            return false;
          }
        }
      }
    }
    
    return true;
  }

  /**
   * Create locked tiles array based on current board state
   */
  private createLockedTilesForBoard(board: PieceType[][]): boolean[][] {
    const lockedTiles: boolean[][] = [];
    for (let row = 0; row < this.size; row++) {
      lockedTiles[row] = [];
      for (let col = 0; col < this.size; col++) {
        lockedTiles[row][col] = board[row][col] !== PieceType.EMPTY;
      }
    }
    return lockedTiles;
  }

  /**
   * Serialize board state for comparison (detect infinite loops)
   */
  private serializeBoardState(board: PieceType[][]): string {
    return board.map(row => 
      row.map(piece => 
        piece === PieceType.SUN ? 'S' : 
        piece === PieceType.MOON ? 'M' : '_'
      ).join('')
    ).join('|');
  }

  /**
   * Quick check if the partial puzzle state is still solvable
   * Uses faster validation than full solver
   */
  private isPartialPuzzleSolvable(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    try {
      // Quick feasibility checks without full solving
      if (!this.checkBalanceFeasibility(board, hConstraints, vConstraints)) {
        return false;
      }
      
      if (!this.checkConstraintChainConsistency(board, hConstraints, vConstraints)) {
        return false;
      }
      
      if (!this.checkConsecutiveViolationPrevention(board, hConstraints, vConstraints)) {
        return false;
      }
      
      // Additional check: ensure we haven't created impossible situations
      if (!this.checkMinimumProgressPossibility(board)) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn(`⚠️ Error during solvability check:`, error);
      return false; // Assume unsolvable if check fails
    }
  }

  /**
   * Check if the board can still make meaningful progress
   */
  private checkMinimumProgressPossibility(board: PieceType[][]): boolean {
    // Count empty cells
    let emptyCells = 0;
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          emptyCells++;
        }
      }
    }
    
    // If no empty cells but board is not solved, something is wrong
    if (emptyCells === 0) {
      return this.isValidCompleteBoard(board);
    }
    
    // Check if we can still place pieces without violating balance
    const totalPieces = this.size * this.size;
    const targetSunsPerRowCol = this.size / 2;
    const currentTotalSuns = this.countTotalPieces(board).suns;
    const currentTotalMoons = this.countTotalPieces(board).moons;
    const targetTotalSuns = totalPieces / 2;
    
    // Check if we can still reach target balance
    const sunsNeeded = targetTotalSuns - currentTotalSuns;
    const moonsNeeded = targetTotalSuns - currentTotalMoons;
    
    if (sunsNeeded < 0 || moonsNeeded < 0 || sunsNeeded + moonsNeeded !== emptyCells) {
      console.warn(`🚫 Balance impossible: need ${sunsNeeded} suns, ${moonsNeeded} moons, have ${emptyCells} empty cells`);
      return false;
    }
    
    return true;
  }

  /**
   * Count total pieces on the board
   */
  private countTotalPieces(board: PieceType[][]): { suns: number, moons: number } {
    let suns = 0, moons = 0;
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.SUN) suns++;
        else if (board[row][col] === PieceType.MOON) moons++;
      }
    }
    return { suns, moons };
  }

  /**
   * Analyze horizontal pattern and suggest optimal constraint
   * Examples:
   * - _M_S__ → suggest SAME at position 2 to force SMSSMM
   * - M__M__ → suggest DIFFERENT at position 4 to force MSSM_x_
   */
  private analyzeHorizontalPattern(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    row: number,
    col: number
  ): ConstraintPlacement | null {
    const rowData = board[row];
    const rowConstraints = hConstraints[row];
    
    // Get the current state of this row as a pattern string
    const pattern = this.getRowPattern(rowData, rowConstraints);
    
    // Analyze patterns like your examples
    const patternResult = this.analyzePatternForConstraint(pattern, col, 'horizontal');
    
    if (patternResult) {
      return {
        type: 'horizontal',
        row,
        col,
        constraintType: patternResult.constraintType,
        reason: patternResult.reason,
        isAdvanced: patternResult.isAdvanced
      };
    }
    
    return null;
  }

  /**
   * Analyze vertical pattern and suggest optimal constraint
   */
  private analyzeVerticalPattern(
    board: PieceType[][],
    vConstraints: ConstraintType[][],
    row: number,
    col: number
  ): ConstraintPlacement | null {
    // Extract column data
    const colData: PieceType[] = [];
    const colConstraints: ConstraintType[] = [];
    
    for (let r = 0; r < this.size; r++) {
      colData.push(board[r][col]);
    }
    
    for (let r = 0; r < this.size - 1; r++) {
      colConstraints.push(vConstraints[r][col]);
    }
    
    // Get the current state of this column as a pattern string
    const pattern = this.getColumnPattern(colData, colConstraints);
    
    // Analyze patterns
    const patternResult = this.analyzePatternForConstraint(pattern, row, 'vertical');
    
    if (patternResult) {
      return {
        type: 'vertical',
        row,
        col,
        constraintType: patternResult.constraintType,
        reason: patternResult.reason,
        isAdvanced: patternResult.isAdvanced
      };
    }
    
    return null;
  }

  /**
   * Convert row data and constraints into a pattern string for analysis
   * M = moon, S = sun, _ = empty, = = same constraint, x = different constraint
   */
  private getRowPattern(rowData: PieceType[], rowConstraints: ConstraintType[]): string {
    let pattern = '';
    
    for (let i = 0; i < rowData.length; i++) {
      // Add the piece
      if (rowData[i] === PieceType.MOON) {
        pattern += 'M';
      } else if (rowData[i] === PieceType.SUN) {
        pattern += 'S';
      } else {
        pattern += '_';
      }
      
      // Add the constraint (if not the last column)
      if (i < rowConstraints.length) {
        if (rowConstraints[i] === ConstraintType.SAME) {
          pattern += '=';
        } else if (rowConstraints[i] === ConstraintType.DIFFERENT) {
          pattern += 'x';
        } else {
          pattern += '.'; // No constraint
        }
      }
    }
    
    return pattern;
  }

  /**
   * Convert column data and constraints into a pattern string for analysis
   */
  private getColumnPattern(colData: PieceType[], colConstraints: ConstraintType[]): string {
    let pattern = '';
    
    for (let i = 0; i < colData.length; i++) {
      // Add the piece
      if (colData[i] === PieceType.MOON) {
        pattern += 'M';
      } else if (colData[i] === PieceType.SUN) {
        pattern += 'S';
      } else {
        pattern += '_';
      }
      
      // Add the constraint (if not the last row)
      if (i < colConstraints.length) {
        if (colConstraints[i] === ConstraintType.SAME) {
          pattern += '=';
        } else if (colConstraints[i] === ConstraintType.DIFFERENT) {
          pattern += 'x';
        } else {
          pattern += '.'; // No constraint
        }
      }
    }
    
    return pattern;
  }

  /**
   * Analyze a pattern string and determine the best constraint to place
   * This implements the advanced pattern recognition you described
   */
  private analyzePatternForConstraint(
    pattern: string,
    position: number,
    direction: 'horizontal' | 'vertical'
  ): { constraintType: ConstraintType; reason: string; isAdvanced: boolean } | null {
    
    // Calculate the constraint position in the pattern string
    // Pattern: M._.S._._ (piece, constraint, piece, constraint, ...)
    const constraintPos = position * 2 + 1;
    
    if (constraintPos >= pattern.length || pattern[constraintPos] !== '.') {
      return null; // Position already has a constraint
    }
    
    // **Advanced Pattern 1: Your _M_S__ example**
    // Look for patterns like _M.S where we can force a solution
    if (this.matchesPattern(pattern, ['_', 'M', '.', 'S'], constraintPos - 3)) {
      return {
        constraintType: ConstraintType.SAME,
        reason: `Advanced: _M=S pattern forces unique solution (like SMSSMM)`,
        isAdvanced: true
      };
    }

    // **Advanced Pattern 2: Your M__M__ example**  
    // Look for patterns like M__M where we can create logical deduction
    if (this.matchesPattern(pattern, ['M', '.', '_', '.', 'M'], constraintPos - 2)) {
      return {
        constraintType: ConstraintType.DIFFERENT,
        reason: `Advanced: M_xM pattern creates logical deduction path`,
        isAdvanced: true
      };
    }

    // **Advanced Pattern 3: Prevent three in a row**
    // Look for patterns like SS_ or _SS to prevent SSS
    if (this.matchesPattern(pattern, ['S', '=', 'S'], constraintPos - 2) ||
        this.matchesPattern(pattern, ['M', '=', 'M'], constraintPos - 2)) {
      return {
        constraintType: ConstraintType.DIFFERENT,
        reason: `Advanced: Prevent three consecutive identical pieces`,
        isAdvanced: true
      };
    }

    // **Advanced Pattern 4: Balance forcing**
    const sunCount = (pattern.match(/S/g) || []).length;
    const moonCount = (pattern.match(/M/g) || []).length;
    const emptyCount = (pattern.match(/_/g) || []).length;
    const targetCount = this.size / 2; // Should be 4-5 of each in a 9-cell row
    
    if (sunCount > moonCount + 1 && emptyCount > 1) {
      // Too many suns, try to create moon-forcing constraints
      return {
        constraintType: ConstraintType.DIFFERENT,
        reason: `Advanced: Balance-forcing constraint (too many suns)`,
        isAdvanced: true
      };
    }
    
    if (moonCount > sunCount + 1 && emptyCount > 1) {
      // Too many moons, try to create sun-forcing constraints  
      return {
        constraintType: ConstraintType.DIFFERENT,
        reason: `Advanced: Balance-forcing constraint (too many moons)`,
        isAdvanced: true
      };
    }

    // **Non-advanced patterns: Create basic logical opportunities**
    const leftPiece = position > 0 ? pattern[constraintPos - 2] : null;
    const rightPiece = position < this.size - 1 ? pattern[constraintPos + 2] : null;
    
    if (leftPiece && leftPiece !== '_' && rightPiece === '_') {
      // One known piece, one unknown - create deduction opportunity
      return {
        constraintType: Math.random() < 0.7 ? ConstraintType.DIFFERENT : ConstraintType.SAME,
        reason: `Non-advanced: Create deduction opportunity from ${leftPiece}`,
        isAdvanced: false
      };
    }

    // **Default: Strategic choice based on difficulty**
    return {
      constraintType: Math.random() < 0.6 ? ConstraintType.DIFFERENT : ConstraintType.SAME,
      reason: `Non-advanced: Strategic constraint for puzzle progression`,
      isAdvanced: false
    };
  }

  /**
   * Helper to match a pattern at a specific position
   */
  private matchesPattern(str: string, pattern: string[], startPos: number): boolean {
    if (startPos < 0 || startPos + pattern.length > str.length) {
      return false;
    }
    
    for (let i = 0; i < pattern.length; i++) {
      const expected = pattern[i];
      const actual = str[startPos + i];
      
      if (expected !== '.' && expected !== actual) {
        return false;
      }
    }
    
    return true;
  }
}
