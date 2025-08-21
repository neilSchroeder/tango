/**
 * Refactored Tango Board Solver
 * Main orchestrating class that uses modular components for solving
 */

import { 
  PieceType, 
  ConstraintType, 
  BOARD_SIZE, 
  MAX_PIECES_PER_ROW_COL,
  type HintResult 
} from '../types';

import type { 
  SolverConfig, 
  SolverResult, 
  DomainState,
  VSIDSConfig,
  VariableDomain
} from './types';

import { VSIDSManager } from './VSIDSManager';
import { CDCLManager } from './CDCLManager';
import { ConstraintNetworkManager } from './ConstraintNetworkManager';
import { DomainManager } from './DomainManager';
import { ConstraintPropagator } from './ConstraintPropagator';
import { PatternID } from './PatternID';
import type { PatternMove } from './PatternID';

export class TangoBoardSolver {
  private originalBoard: PieceType[][];
  private hConstraints: ConstraintType[][];
  private vConstraints: ConstraintType[][];
  private lockedTiles: boolean[][];
  private size = BOARD_SIZE;
  
  // Component instances
  private vsidsManager!: VSIDSManager;
  private cdclManager!: CDCLManager;
  private constraintNetworkManager!: ConstraintNetworkManager;
  private domainManager!: DomainManager;
  private constraintPropagator!: ConstraintPropagator;
  private patternId!: PatternID;
  
  // Configuration
  private config: SolverConfig;

  constructor(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][]
  ) {
    this.originalBoard = board;
    this.hConstraints = hConstraints;
    this.vConstraints = vConstraints;
    this.lockedTiles = lockedTiles;

    // Initialize configuration with optimal defaults
    this.config = {
      useDomainBasedSolving: true,
      useCDCL: true,
      useVSIDS: true,
      maxIterations: 10000,
      maxSolutions: 10
    };

    // Initialize components
    this.initializeComponents();
  }

  /**
   * Initialize all solver components
   */
  private initializeComponents(): void {
    // Create VSIDS manager with optimal configuration
    const vsidsConfig = VSIDSManager.createDefaultConfig();
    vsidsConfig.enabled = this.config.useVSIDS;
    this.vsidsManager = new VSIDSManager(vsidsConfig);

    // Create CDCL manager
    this.cdclManager = new CDCLManager(this.config.useCDCL);

    // Create other managers
    this.constraintNetworkManager = new ConstraintNetworkManager();
    this.domainManager = new DomainManager();
    this.constraintPropagator = new ConstraintPropagator(this.cdclManager);
    
    // Create pattern identifier
    this.patternId = new PatternID(this.size, this.hConstraints, this.vConstraints);
  }

  /**
   * Main solving method - find all solutions up to maxSolutions
   */
  findAllSolutions(maxSolutions: number = 10): PieceType[][][] {
    const startTime = Date.now();
    
    try {
      let result: SolverResult;

      if (this.config.useDomainBasedSolving) {
        result = this.solveWithDomainBasedApproach(maxSolutions);
      } else {
        result = this.solveWithLegacyApproach(maxSolutions);
      }

      const endTime = Date.now();
      result.timeMs = endTime - startTime;

      console.log(`Solver completed: ${result.solutions.length} solutions found using ${result.method} in ${result.timeMs}ms`);
      
      return result.solutions;
    } catch (error) {
      console.error('Solver failed:', error);
      return [];
    }
  }

  /**
   * Solve using the domain-based approach with CDCL and VSIDS
   */
  private solveWithDomainBasedApproach(maxSolutions: number): SolverResult {
    // Initialize domains and constraint network
    const initialDomains = this.domainManager.initializeDomains(this.originalBoard, this.lockedTiles);
    const constraintNetwork = this.constraintNetworkManager.buildConstraintNetwork(this.hConstraints, this.vConstraints);
    const domainState = this.domainManager.createDomainState(initialDomains, constraintNetwork);

    // Initialize VSIDS activities
    this.vsidsManager.initializeVariableActivities(domainState);

    const solutions: PieceType[][][] = [];
    let iterations = 0;
    let conflicts = 0;

    if (this.config.useCDCL) {
      const cdclResult = this.solveWithCDCL(domainState, maxSolutions);
      solutions.push(...cdclResult.solutions);
      iterations = cdclResult.iterations;
      conflicts = cdclResult.conflicts;
    } else {
      const backtrackResult = this.solveWithBacktracking(domainState, maxSolutions);
      solutions.push(...backtrackResult.solutions);
      iterations = backtrackResult.iterations;
    }

    let method = 'domain-based';
    if (this.config.useCDCL) method += ' + CDCL';
    if (this.config.useVSIDS) method += ' + VSIDS';

    return {
      solutions,
      method,
      iterations,
      conflicts,
      timeMs: 0 // Will be set by caller
    };
  }

  /**
   * Solve using CDCL (Conflict-Driven Clause Learning)
   */
  private solveWithCDCL(domainState: DomainState, maxSolutions: number): {
    solutions: PieceType[][][];
    iterations: number;
    conflicts: number;
  } {
    const solutions: PieceType[][][] = [];
    let iterations = 0;
    let conflicts = 0;

    const solve = (state: DomainState): void => {
      if (iterations >= this.config.maxIterations || solutions.length >= maxSolutions) {
        return;
      }
      iterations++;

      // Apply constraint propagation
      this.constraintPropagator.propagateAllConstraints(state);

      // Check for completion
      if (this.domainManager.isComplete(state)) {
        const solution = this.domainManager.domainStateToBoard(state);
        if (this.isValidSolution(solution)) {
          solutions.push(solution);
        }
        return;
      }

      // Check for conflicts
      const conflictVars = this.cdclManager.detectConflictVariables(state);
      if (conflictVars.length > 0) {
        conflicts++;
        
        // Analyze conflict and learn clause
        const analysis = this.cdclManager.analyzeConflict(state, conflictVars);
        this.cdclManager.learnClause(state, analysis.conflictClause);
        
        // Bump variable activities
        this.vsidsManager.bumpVariableActivity(conflictVars);
        this.vsidsManager.decayVariableActivities();
        
        // Backtrack to appropriate level
        this.cdclManager.backtrack(state, analysis.backtrackLevel);
        return;
      }

      // Select next variable using VSIDS or heuristic
      const variable = this.vsidsManager.selectVariable(state);
      if (!variable) return;

      const domain = state.domains.get(variable);
      if (!domain || domain.possibleValues.size <= 1) return;

      // Try each possible value
      for (const value of Array.from(domain.possibleValues)) {
        // Create a copy of the state for this branch
        const branchState = this.domainManager.copyDomainState(state);
        
        // Make decision
        this.cdclManager.makeDecision(branchState, variable, value);
        
        // Recurse
        solve(branchState);
        
        if (solutions.length >= maxSolutions) break;
      }
    };

    solve(domainState);

    return { solutions, iterations, conflicts };
  }

  /**
   * Solve using simple backtracking (fallback when CDCL is disabled)
   */
  private solveWithBacktracking(domainState: DomainState, maxSolutions: number): {
    solutions: PieceType[][][];
    iterations: number;
  } {
    const solutions: PieceType[][][] = [];
    let iterations = 0;

    const solve = (state: DomainState): void => {
      if (iterations >= this.config.maxIterations || solutions.length >= maxSolutions) {
        return;
      }
      iterations++;

      // Apply constraint propagation
      this.constraintPropagator.propagateAllConstraints(state);

      // Check for completion
      if (this.domainManager.isComplete(state)) {
        const solution = this.domainManager.domainStateToBoard(state);
        if (this.isValidSolution(solution)) {
          solutions.push(solution);
        }
        return;
      }

      // Check for conflicts
      if (this.domainManager.hasConflicts(state)) {
        return; // Backtrack
      }

      // Select next variable
      const variable = this.vsidsManager.selectVariable(state);
      if (!variable) return;

      const domain = state.domains.get(variable);
      if (!domain || domain.possibleValues.size <= 1) return;

      // Try each possible value
      for (const value of Array.from(domain.possibleValues)) {
        // Create a copy of the state for this branch
        const branchState = this.domainManager.copyDomainState(state);
        
        // Make assignment
        this.cdclManager.makeAssignment(branchState, variable, value);
        
        // Recurse
        solve(branchState);
        
        if (solutions.length >= maxSolutions) break;
      }
    };

    solve(domainState);

    return { solutions, iterations };
  }

  /**
   * Legacy board-based solving (fallback)
   */
  private solveWithLegacyApproach(maxSolutions: number): SolverResult {
    const solutions: PieceType[][][] = [];
    const board = this.originalBoard.map(row => [...row]);
    
    // Simple backtracking implementation
    const solve = (pos: number): void => {
      if (solutions.length >= maxSolutions) return;
      
      if (pos >= this.size * this.size) {
        if (this.isValidSolution(board)) {
          solutions.push(board.map(row => [...row]));
        }
        return;
      }

      const row = Math.floor(pos / this.size);
      const col = pos % this.size;

      if (this.lockedTiles[row][col]) {
        solve(pos + 1);
        return;
      }

      for (const piece of [PieceType.SUN, PieceType.MOON]) {
        board[row][col] = piece;
        if (this.isValidPlacement(board, row, col)) {
          solve(pos + 1);
        }
        board[row][col] = PieceType.EMPTY;
      }
    };

    solve(0);

    return {
      solutions,
      method: 'legacy backtracking',
      iterations: 0,
      conflicts: 0,
      timeMs: 0
    };
  }

  /**
   * Validate that a solution is complete and correct
   */
  private isValidSolution(board: PieceType[][]): boolean {
    const targetCount = this.size / 2;

    // Check row balance
    for (let row = 0; row < this.size; row++) {
      const counts = this.patternId.countPiecesInRow(board, row);
      if (counts.suns !== targetCount || counts.moons !== targetCount) {
        return false;
      }
    }

    // Check column balance
    for (let col = 0; col < this.size; col++) {
      const counts = this.patternId.countPiecesInColumn(board, col);
      if (counts.suns !== targetCount || counts.moons !== targetCount) {
        return false;
      }
    }

    // Check consecutive constraint
    if (this.hasThreeConsecutive(board)) {
      return false;
    }

    // Check direct constraints
    return this.validateDirectConstraints(board);
  }

  /**
   * Check if a placement at a specific position is valid
   */
  private isValidPlacement(board: PieceType[][], row: number, col: number): boolean {
    // Basic validation logic
    return !this.hasThreeConsecutive(board) && 
           this.checkBalanceConstraints(board, row, col) &&
           this.validateDirectConstraints(board);
  }

  /**
   * Create initial board with locked tiles
   */
  private createInitialBoard(): PieceType[][] {
    const board = Array(this.size).fill(null).map(() => 
      Array(this.size).fill(PieceType.EMPTY)
    );
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.lockedTiles[row][col]) {
          board[row][col] = this.originalBoard[row][col];
        }
      }
    }
    
    return board;
  }

  /**
   * Find all empty positions on the board
   */
  private findEmptyPositions(board: PieceType[][]): [number, number][] {
    const empty: [number, number][] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          empty.push([row, col]);
        }
      }
    }
    return empty;
  }

  /**
   * Order pieces by likelihood to reduce backtracking
   */
  private orderPiecesByLikelihood(board: PieceType[][], row: number, col: number): PieceType[] {
    const rowCounts = this.patternId.countPiecesInRow(board, row);
    const colCounts = this.patternId.countPiecesInColumn(board, col);
    
    const sunImbalance = Math.abs((rowCounts.suns + colCounts.suns) - (rowCounts.moons + colCounts.moons + 1));
    const moonImbalance = Math.abs((rowCounts.suns + colCounts.suns + 1) - (rowCounts.moons + colCounts.moons));
    
    if (sunImbalance < moonImbalance) {
      return [PieceType.MOON, PieceType.SUN];
    } else {
      return [PieceType.SUN, PieceType.MOON];
    }
  }

  /**
   * Check if current board state is valid (not necessarily complete)
   */
  private isBoardStateValid(board: PieceType[][]): boolean {
    return this.validateDirectConstraints(board) &&
           !this.hasThreeConsecutive(board) &&
           this.checkAllBalanceConstraints(board);
  }

  /**
   * Check if board is both complete and valid
   */
  private isCompleteAndValid(board: PieceType[][]): boolean {
    // Check if complete
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          return false;
        }
      }
    }
    
    // Check if valid
    return this.isValidSolution(board);
  }

  /**
   * Check balance constraints for all rows and columns
   */
  private checkAllBalanceConstraints(board: PieceType[][]): boolean {
    // Check all rows
    for (let row = 0; row < this.size; row++) {
      const counts = this.patternId.countPiecesInRow(board, row);
      if (counts.suns > MAX_PIECES_PER_ROW_COL || counts.moons > MAX_PIECES_PER_ROW_COL) {
        return false;
      }
    }
    
    // Check all columns
    for (let col = 0; col < this.size; col++) {
      const counts = this.patternId.countPiecesInColumn(board, col);
      if (counts.suns > MAX_PIECES_PER_ROW_COL || counts.moons > MAX_PIECES_PER_ROW_COL) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Utility method to check position equality
   */
  private positionsEqual(pos1: [number, number], pos2: [number, number]): boolean {
    return pos1[0] === pos2[0] && pos1[1] === pos2[1];
  }

  /**
   * Solve using domain-based backtracking approach
   */
  private solveDomainBased(domainState: DomainState, solutions: PieceType[][][], maxSolutions: number): void {
    if (solutions.length >= maxSolutions) return;
    
    // Use the domain manager to check if complete
    if (this.domainManager.isComplete(domainState)) {
      const solution = this.domainManager.domainStateToBoard(domainState);
      if (this.isValidSolution(solution)) {
        solutions.push(solution);
      }
      return;
    }
    
    // Get unassigned variable using VSIDS if enabled
    const variable = this.config.useVSIDS ? 
      this.vsidsManager.selectVariable(domainState) :
      this.selectVariableWithHeuristic(domainState);
      
    if (!variable) return;
    
    // Try each value in the domain
    const variableDomain = domainState.domains.get(variable);
    if (!variableDomain || variableDomain.possibleValues.size === 0) return;
    
    for (const value of variableDomain.possibleValues) {
      // Make assignment
      const backup = this.backupDomainState(domainState);
      
      // Set single value
      variableDomain.possibleValues.clear();
      variableDomain.possibleValues.add(value);
      
      // Propagate constraints
      this.constraintPropagator.propagateAllConstraints(domainState);
      
      // Recursively solve
      this.solveDomainBased(domainState, solutions, maxSolutions);
      
      // Restore state
      this.restoreDomainState(domainState, backup);
    }
  }

  /**
   * Select variable with heuristic (most constrained first)
   */
  private selectVariableWithHeuristic(domainState: DomainState): string | null {
    let bestVar: string | null = null;
    let minDomainSize = Infinity;
    
    for (const [varKey, variableDomain] of domainState.domains) {
      const domainSize = variableDomain.possibleValues.size;
      if (domainSize > 1 && domainSize < minDomainSize) {
        minDomainSize = domainSize;
        bestVar = varKey;
      }
    }
    
    return bestVar;
  }

  /**
   * Backup domain state for backtracking
   */
  private backupDomainState(domainState: DomainState): Map<string, VariableDomain> {
    const backup = new Map<string, VariableDomain>();
    for (const [varKey, variableDomain] of domainState.domains) {
      backup.set(varKey, {
        position: variableDomain.position,
        possibleValues: new Set(variableDomain.possibleValues),
        isLocked: variableDomain.isLocked,
        decisionLevel: variableDomain.decisionLevel,
        reason: variableDomain.reason
      });
    }
    return backup;
  }

  /**
   * Restore domain state after backtracking
   */
  private restoreDomainState(domainState: DomainState, backup: Map<string, VariableDomain>): void {
    for (const [varKey, variableDomain] of backup) {
      domainState.domains.set(varKey, {
        position: variableDomain.position,
        possibleValues: new Set(variableDomain.possibleValues),
        isLocked: variableDomain.isLocked,
        decisionLevel: variableDomain.decisionLevel,
        reason: variableDomain.reason
      });
    }
  }

  /**
   * Apply advanced constraint patterns for puzzle validation/generation
   */
  applyConstraintPatterns(board: PieceType[][]): boolean {
    return this.patternId.applyConstraintPatterns(board);
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

  private checkBalanceConstraints(board: PieceType[][], row: number, col: number): boolean {
    const rowCounts = this.patternId.countPiecesInRow(board, row);
    const colCounts = this.patternId.countPiecesInColumn(board, col);
    const maxAllowed = MAX_PIECES_PER_ROW_COL;
    
    return rowCounts.suns <= maxAllowed && rowCounts.moons <= maxAllowed &&
           colCounts.suns <= maxAllowed && colCounts.moons <= maxAllowed;
  }

  private validateDirectConstraints(board: PieceType[][]): boolean {
    // Validate horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        const constraint = this.hConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const left = board[row][col];
          const right = board[row][col + 1];
          
          if (left !== PieceType.EMPTY && right !== PieceType.EMPTY) {
            if (constraint === ConstraintType.SAME && left !== right) return false;
            if (constraint === ConstraintType.DIFFERENT && left === right) return false;
          }
        }
      }
    }

    // Validate vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        const constraint = this.vConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const top = board[row][col];
          const bottom = board[row + 1][col];
          
          if (top !== PieceType.EMPTY && bottom !== PieceType.EMPTY) {
            if (constraint === ConstraintType.SAME && top !== bottom) return false;
            if (constraint === ConstraintType.DIFFERENT && top === bottom) return false;
          }
        }
      }
    }

    return true;
  }

  // Configuration methods
  setUseDomainBasedSolving(enabled: boolean): void {
    this.config.useDomainBasedSolving = enabled;
  }

  setUseCDCL(enabled: boolean): void {
    this.config.useCDCL = enabled;
    this.cdclManager.setEnabled(enabled);
  }

  setUseVSIDS(enabled: boolean): void {
    this.config.useVSIDS = enabled;
    this.vsidsManager.setEnabled(enabled);
  }

  getSolvingMethod(): string {
    if (!this.config.useDomainBasedSolving) {
      return 'board-based (legacy fallback)';
    }
    
    let method = 'domain-based';
    if (this.config.useCDCL) method += ' + CDCL';
    if (this.config.useVSIDS) method += ' + VSIDS (optimal)';
    return method;
  }

  // Statistics and debugging
  getStatistics(): any {
    return {
      vsids: this.vsidsManager.getStatistics(),
      solving: {
        method: this.getSolvingMethod(),
        config: this.config
      }
    };
  }

  /**
   * Get a hint for the next logical move using improved deduction
   */
  getHint(): HintResult {
    // Use the current board state (including player moves) instead of just locked pieces
    const board: PieceType[][] = this.originalBoard.map(row => [...row]);

    // Apply constraint propagation to find logical moves
    const logicalMoves = this.findLogicalMovesWithReasons(board);

    if (logicalMoves.length > 0) {
      // Prioritize moves by educational value and confidence
      const sortedMoves = logicalMoves.sort((a, b) => {
        // First by confidence (higher is better)
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        // Then by move type priority
        const typeOrder = ['consecutive', 'constraint', 'balance', 'pattern', 'forced'];
        const aIndex = typeOrder.indexOf(a.moveType) >= 0 ? typeOrder.indexOf(a.moveType) : typeOrder.length;
        const bIndex = typeOrder.indexOf(b.moveType) >= 0 ? typeOrder.indexOf(b.moveType) : typeOrder.length;
        return aIndex - bIndex;
      });

      const bestMove = sortedMoves[0];
      
      return {
        found: true,
        row: bestMove.row,
        col: bestMove.col,
        pieceType: bestMove.piece,
        reasoning: bestMove.reasoning,
        confidence: bestMove.confidence,
        hintType: 'logical_deduction',
        educationalValue: bestMove.confidence >= 90 ? 'high' : bestMove.confidence >= 70 ? 'medium' : 'low',
      };
    }

    // If no logical moves found, return no hint rather than strategic guesses
    return {
      found: false,
      reasoning: "No logical deduction is possible at this time. Try making moves based on the game rules: no three consecutive pieces, equal numbers of suns and moons per row/column, and follow constraint symbols.",
      hintType: 'none',
      educationalValue: 'low',
    };
  }

  /**
   * Find logical moves with detailed reasoning
   */
  private findLogicalMovesWithReasons(board: PieceType[][]): Array<{
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  }> {
    const moves: Array<{
      row: number;
      col: number;
      piece: PieceType;
      reasoning: string;
      confidence: number;
      moveType: string;
    }> = [];

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const move = this.analyzePosition(board, row, col);
          if (move) {
            moves.push(move);
          }
        }
      }
    }

    return moves;
  }

  /**
   * Analyze a specific position for logical moves
   */
  private analyzePosition(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {

    // Check for consecutive rule applications
    const consecutiveMove = this.checkConsecutiveMove(board, row, col);
    if (consecutiveMove) return consecutiveMove;

    // Check for direct constraint applications
    const constraintMove = this.checkConstraintMove(board, row, col);
    if (constraintMove) return constraintMove;

    // Check for balance rule applications
    const balanceMove = this.checkBalanceMove(board, row, col);
    if (balanceMove) return balanceMove;

    // Check for advanced balance moves with constraint inference
    const advancedBalanceMove = this.checkAdvancedBalanceMove(board, row, col);
    if (advancedBalanceMove) return advancedBalanceMove;

    // Check for advanced constraint pattern moves
    const constraintPatternMove = this.patternId.checkConstraintPatternMove(board, row, col);
    if (constraintPatternMove) return constraintPatternMove;

    // Check for forced moves (only one valid option)
    const forcedMove = this.checkForcedMove(board, row, col);
    if (forcedMove) return forcedMove;

    return null;
  }

  private checkConsecutiveMove(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {
    
    // Check horizontal patterns
    // Pattern: XX_ -> must be opposite
    if (col >= 2 && board[row][col - 1] !== PieceType.EMPTY && 
        board[row][col - 1] === board[row][col - 2]) {
      const existing = board[row][col - 1];
      const required = existing === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      if (this.patternId.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Two ${existing}s are already consecutive in row ${row + 1}. To prevent three consecutive ${existing}s (which violates the game rules), position (${row + 1}, ${col + 1}) must be ${required}.`,
          confidence: 100,
          moveType: 'consecutive'
        };
      }
    }

    // Pattern: _XX -> must be opposite
    if (col <= this.size - 3 && board[row][col + 1] !== PieceType.EMPTY && 
        board[row][col + 1] === board[row][col + 2]) {
      const existing = board[row][col + 1];
      const required = existing === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      if (this.patternId.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Must place ${required} to prevent three consecutive ${existing}s in row ${row + 1}`,
          confidence: 100,
          moveType: 'consecutive'
        };
      }
    }

    // Pattern: X_X -> middle must be opposite
    if (col >= 1 && col <= this.size - 2 && 
        board[row][col - 1] !== PieceType.EMPTY && board[row][col + 1] !== PieceType.EMPTY &&
        board[row][col - 1] === board[row][col + 1]) {
      const existing = board[row][col - 1];
      const required = existing === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      if (this.patternId.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `There are ${existing}s on both sides of this position in row ${row + 1}. To prevent three consecutive pieces, this position must be ${required}.`,
          confidence: 100,
          moveType: 'consecutive'
        };
      }
    }

    // Check vertical patterns (same logic)
    if (row >= 2 && board[row - 1][col] !== PieceType.EMPTY && 
        board[row - 1][col] === board[row - 2][col]) {
      const existing = board[row - 1][col];
      const required = existing === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      if (this.patternId.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Must place ${required} to prevent three consecutive ${existing}s in column ${col + 1}`,
          confidence: 100,
          moveType: 'consecutive'
        };
      }
    }

    if (row <= this.size - 3 && board[row + 1][col] !== PieceType.EMPTY && 
        board[row + 1][col] === board[row + 2][col]) {
      const existing = board[row + 1][col];
      const required = existing === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      if (this.patternId.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Must place ${required} to prevent three consecutive ${existing}s in column ${col + 1}`,
          confidence: 100,
          moveType: 'consecutive'
        };
      }
    }

    if (row >= 1 && row <= this.size - 2 && 
        board[row - 1][col] !== PieceType.EMPTY && board[row + 1][col] !== PieceType.EMPTY &&
        board[row - 1][col] === board[row + 1][col]) {
      const existing = board[row - 1][col];
      const required = existing === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      if (this.patternId.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Must place ${required} between two ${existing}s to prevent three in a column`,
          confidence: 100,
          moveType: 'consecutive'
        };
      }
    }

    return null;
  }

  private checkConstraintMove(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {
    
    // Check adjacent cells for constraints
    const adjacentConstraints = [
      { dr: 0, dc: -1, constraints: this.hConstraints, constraintRow: row, constraintCol: col - 1 },
      { dr: 0, dc: 1, constraints: this.hConstraints, constraintRow: row, constraintCol: col },
      { dr: -1, dc: 0, constraints: this.vConstraints, constraintRow: row - 1, constraintCol: col },
      { dr: 1, dc: 0, constraints: this.vConstraints, constraintRow: row, constraintCol: col }
    ];

    for (const adj of adjacentConstraints) {
      const adjRow = row + adj.dr;
      const adjCol = col + adj.dc;
      
      if (adjRow >= 0 && adjRow < this.size && adjCol >= 0 && adjCol < this.size &&
          adj.constraintRow >= 0 && adj.constraintCol >= 0 &&
          adj.constraintRow < adj.constraints.length && adj.constraintCol < adj.constraints[0].length) {
        
        const constraint = adj.constraints[adj.constraintRow][adj.constraintCol];
        const adjPiece = board[adjRow][adjCol];
        
        if (constraint !== ConstraintType.NONE && adjPiece !== PieceType.EMPTY) {
          let required: PieceType;
          let symbol: string;
          let constraintName: string;
          
          if (constraint === ConstraintType.SAME) {
            required = adjPiece;
            symbol = '=';
            constraintName = 'same';
          } else {
            required = adjPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            symbol = '≠';
            constraintName = 'different';
          }
          
          if (this.patternId.canPlacePiece(board, row, col, required)) {
            const direction = adj.dr === 0 ? (adj.dc === -1 ? 'left' : 'right') : (adj.dr === -1 ? 'above' : 'below');
            return {
              row, col,
              piece: required,
              reasoning: `The '${symbol}' constraint requires this position to have the ${constraintName} piece as the ${adjPiece} ${direction} it. Therefore, place ${required} here.`,
              confidence: 95,
              moveType: 'constraint'
            };
          }
        }
      }
    }

    return null;
  }

  private checkBalanceMove(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {
    
    const rowCounts = this.patternId.countPiecesInRow(board, row);
    const colCounts = this.patternId.countPiecesInColumn(board, col);

    // If row already has 3 of one type, remaining must be other type
    if (rowCounts.suns === MAX_PIECES_PER_ROW_COL) {
      if (this.patternId.canPlacePiece(board, row, col, PieceType.MOON)) {
        return {
          row, col,
          piece: PieceType.MOON,
          reasoning: `Row ${row + 1} already has the maximum of 3 suns. The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be moon.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
    } else if (rowCounts.moons === MAX_PIECES_PER_ROW_COL) {
      if (this.patternId.canPlacePiece(board, row, col, PieceType.SUN)) {
        return {
          row, col,
          piece: PieceType.SUN,
          reasoning: `Row ${row + 1} already has the maximum of 3 moons. The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be sun.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
    }

    // If column already has 3 of one type, remaining must be other type
    if (colCounts.suns === MAX_PIECES_PER_ROW_COL) {
      if (this.patternId.canPlacePiece(board, row, col, PieceType.MOON)) {
        return {
          row, col,
          piece: PieceType.MOON,
          reasoning: `Column ${col + 1} already has the maximum of 3 suns. The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be moon.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
    } else if (colCounts.moons === MAX_PIECES_PER_ROW_COL) {
      if (this.patternId.canPlacePiece(board, row, col, PieceType.SUN)) {
        return {
          row, col,
          piece: PieceType.SUN,
          reasoning: `Column ${col + 1} already has the maximum of 3 moons. The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be sun.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
    }

    return null;
  }

  private checkForcedMove(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {
    
    const validPieces: PieceType[] = [];
    
    for (const piece of [PieceType.SUN, PieceType.MOON]) {
      if (this.patternId.canPlacePiece(board, row, col, piece)) {
        validPieces.push(piece);
      }
    }

    if (validPieces.length === 1) {
      const reasons = this.analyzeWhyOnlyChoice(board, row, col, validPieces[0]);
      return {
        row, col,
        piece: validPieces[0],
        reasoning: reasons,
        confidence: 90,
        moveType: 'forced'
      };
    }

    return null;
  }

  /**
   * Check for advanced balance moves with constraint inference
   */
  private checkAdvancedBalanceMove(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {
    
    // Check row-based advanced balance pattern
    const rowMove = this.checkAdvancedBalanceInRow(board, row, col);
    if (rowMove) return rowMove;
    
    // Check column-based advanced balance pattern
    const colMove = this.checkAdvancedBalanceInColumn(board, row, col);
    if (colMove) return colMove;
    
    return null;
  }

  /**
   * Check for advanced balance pattern in the row
   */
  private checkAdvancedBalanceInRow(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {
    
    const counts = this.patternId.countPiecesInRow(board, row);
    const emptyCount = this.size - counts.suns - counts.moons;
    
    // Only apply if we have exactly 3 filled and 3 empty tiles
    if (counts.suns + counts.moons !== 3 || emptyCount !== 3) {
      return null;
    }
    
    // Find empty positions in this row
    const emptyPositions: number[] = [];
    for (let c = 0; c < this.size; c++) {
      if (board[row][c] === PieceType.EMPTY) {
        emptyPositions.push(c);
      }
    }
    
    // Check if the current position is part of an advanced balance pattern
    if (!emptyPositions.includes(col)) {
      return null;
    }
    
    // Look for 'x' constraints between empty positions
    for (let i = 0; i < emptyPositions.length - 1; i++) {
      const pos1 = emptyPositions[i];
      const pos2 = emptyPositions[i + 1];
      
      // Check if there's an 'x' constraint between these consecutive empty positions
      if (pos2 === pos1 + 1 && this.hConstraints[row][pos1] === ConstraintType.DIFFERENT) {
        // Find the third empty position (not involved in the constraint)
        const thirdPos = emptyPositions.find(pos => pos !== pos1 && pos !== pos2);
        
        if (thirdPos === col) {
          // This is the position we can infer!
          const neededSuns = MAX_PIECES_PER_ROW_COL - counts.suns;
          const neededMoons = MAX_PIECES_PER_ROW_COL - counts.moons;
          
          if (neededSuns > neededMoons && this.patternId.canPlacePiece(board, row, col, PieceType.SUN)) {
            return {
              row, col,
              piece: PieceType.SUN,
              reasoning: `Row ${row + 1} has 3 filled tiles and 3 empty tiles. There's an 'x' constraint between positions ${pos1 + 1} and ${pos2 + 1}, which limits their placement options. To satisfy the balance rule (3 suns, 3 moons), position (${row + 1}, ${col + 1}) must be sun.`,
              confidence: 90,
              moveType: 'balance'
            };
          } else if (neededMoons > neededSuns && this.patternId.canPlacePiece(board, row, col, PieceType.MOON)) {
            return {
              row, col,
              piece: PieceType.MOON,
              reasoning: `Row ${row + 1} has 3 filled tiles and 3 empty tiles. There's an 'x' constraint between positions ${pos1 + 1} and ${pos2 + 1}, which limits their placement options. To satisfy the balance rule (3 suns, 3 moons), position (${row + 1}, ${col + 1}) must be moon.`,
              confidence: 90,
              moveType: 'balance'
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Check for advanced balance pattern in the column
   */
  private checkAdvancedBalanceInColumn(board: PieceType[][], row: number, col: number): {
    row: number;
    col: number;
    piece: PieceType;
    reasoning: string;
    confidence: number;
    moveType: string;
  } | null {
    
    const counts = this.patternId.countPiecesInColumn(board, col);
    const emptyCount = this.size - counts.suns - counts.moons;
    
    // Only apply if we have exactly 3 filled and 3 empty tiles
    if (counts.suns + counts.moons !== 3 || emptyCount !== 3) {
      return null;
    }
    
    // Find empty positions in this column
    const emptyPositions: number[] = [];
    for (let r = 0; r < this.size; r++) {
      if (board[r][col] === PieceType.EMPTY) {
        emptyPositions.push(r);
      }
    }
    
    // Check if the current position is part of an advanced balance pattern
    if (!emptyPositions.includes(row)) {
      return null;
    }
    
    // Look for 'x' constraints between empty positions
    for (let i = 0; i < emptyPositions.length - 1; i++) {
      const pos1 = emptyPositions[i];
      const pos2 = emptyPositions[i + 1];
      
      // Check if there's an 'x' constraint between these consecutive empty positions
      if (pos2 === pos1 + 1 && this.vConstraints[pos1][col] === ConstraintType.DIFFERENT) {
        // Find the third empty position (not involved in the constraint)
        const thirdPos = emptyPositions.find(pos => pos !== pos1 && pos !== pos2);
        
        if (thirdPos === row) {
          // This is the position we can infer!
          const neededSuns = MAX_PIECES_PER_ROW_COL - counts.suns;
          const neededMoons = MAX_PIECES_PER_ROW_COL - counts.moons;
          
          if (neededSuns > neededMoons && this.patternId.canPlacePiece(board, row, col, PieceType.SUN)) {
            return {
              row, col,
              piece: PieceType.SUN,
              reasoning: `Column ${col + 1} has 3 filled tiles and 3 empty tiles. There's an 'x' constraint between positions ${pos1 + 1} and ${pos2 + 1}, which limits their placement options. To satisfy the balance rule (3 suns, 3 moons), position (${row + 1}, ${col + 1}) must be sun.`,
              confidence: 90,
              moveType: 'balance'
            };
          } else if (neededMoons > neededSuns && this.patternId.canPlacePiece(board, row, col, PieceType.MOON)) {
            return {
              row, col,
              piece: PieceType.MOON,
              reasoning: `Column ${col + 1} has 3 filled tiles and 3 empty tiles. There's an 'x' constraint between positions ${pos1 + 1} and ${pos2 + 1}, which limits their placement options. To satisfy the balance rule (3 suns, 3 moons), position (${row + 1}, ${col + 1}) must be moon.`,
              confidence: 90,
              moveType: 'balance'
            };
          }
        }
      }
    }
    
    return null;
  }

  private analyzeWhyOnlyChoice(board: PieceType[][], row: number, col: number, piece: PieceType): string {
    const otherPiece = piece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    const reasons: string[] = [];

    // Test placing the other piece to see what breaks
    board[row][col] = otherPiece;

    // Check if it violates consecutive rules with specific details
    const consecutiveViolation = this.getConsecutiveViolationDetail(board, row, col, otherPiece);
    if (consecutiveViolation) {
      reasons.push(consecutiveViolation);
    }

    // Check if it violates balance rules with specific details
    const balanceViolation = this.getBalanceViolationDetail(board, row, col, otherPiece);
    if (balanceViolation) {
      reasons.push(balanceViolation);
    }

    // Check if it violates constraints with specific details
    const constraintViolation = this.getConstraintViolationDetail(board, row, col);
    if (constraintViolation) {
      reasons.push(constraintViolation);
    }

    board[row][col] = PieceType.EMPTY; // Reset

    if (reasons.length > 0) {
      // Combine all reasons for a comprehensive explanation
      if (reasons.length === 1) {
        return `Only ${piece} is valid at position (${row + 1}, ${col + 1}) because ${reasons[0]}.`;
      } else {
        const allButLast = reasons.slice(0, -1).join(', ');
        const last = reasons[reasons.length - 1];
        return `Only ${piece} is valid at position (${row + 1}, ${col + 1}) because ${allButLast}, and ${last}.`;
      }
    } else {
      // If no specific violation was found, provide general validation logic
      return `Only ${piece} is valid at position (${row + 1}, ${col + 1}) based on the current board state and game rules. Placing ${otherPiece} would violate one or more game constraints.`;
    }
  }

  /**
   * Get detailed explanation of consecutive rule violations
   */
  private getConsecutiveViolationDetail(board: PieceType[][], row: number, col: number, piece: PieceType): string | null {
    // Check horizontal consecutive violations
    for (let startCol = Math.max(0, col - 2); startCol <= Math.min(this.size - 3, col); startCol++) {
      let consecutiveCount = 0;
      let consecutivePositions: string[] = [];
      
      for (let c = startCol; c < startCol + 3; c++) {
        if (board[row][c] === piece) {
          consecutiveCount++;
          consecutivePositions.push(`(${row + 1}, ${c + 1})`);
        }
      }
      
      if (consecutiveCount === 3) {
        return `placing ${piece} would create three consecutive ${piece}s in row ${row + 1} at positions ${consecutivePositions.join(', ')}`;
      }
    }

    // Check vertical consecutive violations  
    for (let startRow = Math.max(0, row - 2); startRow <= Math.min(this.size - 3, row); startRow++) {
      let consecutiveCount = 0;
      let consecutivePositions: string[] = [];
      
      for (let r = startRow; r < startRow + 3; r++) {
        if (board[r][col] === piece) {
          consecutiveCount++;
          consecutivePositions.push(`(${r + 1}, ${col + 1})`);
        }
      }
      
      if (consecutiveCount === 3) {
        return `placing ${piece} would create three consecutive ${piece}s in column ${col + 1} at positions ${consecutivePositions.join(', ')}`;
      }
    }

    return null;
  }

  /**
   * Get detailed explanation of balance rule violations
   */
  private getBalanceViolationDetail(board: PieceType[][], row: number, col: number, piece: PieceType): string | null {
    const rowCounts = this.patternId.countPiecesInRow(board, row);
    const colCounts = this.patternId.countPiecesInColumn(board, col);

    if (piece === PieceType.SUN) {
      if (rowCounts.suns > MAX_PIECES_PER_ROW_COL) {
        return `placing sun would exceed the maximum of ${MAX_PIECES_PER_ROW_COL} suns allowed in row ${row + 1}`;
      }
      if (colCounts.suns > MAX_PIECES_PER_ROW_COL) {
        return `placing sun would exceed the maximum of ${MAX_PIECES_PER_ROW_COL} suns allowed in column ${col + 1}`;
      }
    } else {
      if (rowCounts.moons > MAX_PIECES_PER_ROW_COL) {
        return `placing moon would exceed the maximum of ${MAX_PIECES_PER_ROW_COL} moons allowed in row ${row + 1}`;
      }
      if (colCounts.moons > MAX_PIECES_PER_ROW_COL) {
        return `placing moon would exceed the maximum of ${MAX_PIECES_PER_ROW_COL} moons allowed in column ${col + 1}`;
      }
    }

    return null;
  }

  /**
   * Get detailed explanation of constraint violations
   */
  private getConstraintViolationDetail(board: PieceType[][], row: number, col: number): string | null {
    const piece = board[row][col];

    // Check horizontal constraints
    if (col > 0 && this.hConstraints[row][col - 1] !== ConstraintType.NONE) {
      const leftPiece = board[row][col - 1];
      if (leftPiece !== PieceType.EMPTY) {
        const constraint = this.hConstraints[row][col - 1];
        if (constraint === ConstraintType.SAME && leftPiece !== piece) {
          return `placing ${piece} violates the '=' constraint with ${leftPiece} to the left`;
        }
        if (constraint === ConstraintType.DIFFERENT && leftPiece === piece) {
          return `placing ${piece} violates the 'x' constraint with ${leftPiece} to the left`;
        }
      }
    }

    if (col < this.size - 1 && this.hConstraints[row][col] !== ConstraintType.NONE) {
      const rightPiece = board[row][col + 1];
      if (rightPiece !== PieceType.EMPTY) {
        const constraint = this.hConstraints[row][col];
        if (constraint === ConstraintType.SAME && piece !== rightPiece) {
          return `placing ${piece} violates the '=' constraint with ${rightPiece} to the right`;
        }
        if (constraint === ConstraintType.DIFFERENT && piece === rightPiece) {
          return `placing ${piece} violates the 'x' constraint with ${rightPiece} to the right`;
        }
      }
    }

    // Check vertical constraints
    if (row > 0 && this.vConstraints[row - 1][col] !== ConstraintType.NONE) {
      const topPiece = board[row - 1][col];
      if (topPiece !== PieceType.EMPTY) {
        const constraint = this.vConstraints[row - 1][col];
        if (constraint === ConstraintType.SAME && topPiece !== piece) {
          return `placing ${piece} violates the '=' constraint with ${topPiece} above`;
        }
        if (constraint === ConstraintType.DIFFERENT && topPiece === piece) {
          return `placing ${piece} violates the 'x' constraint with ${topPiece} above`;
        }
      }
    }

    if (row < this.size - 1 && this.vConstraints[row][col] !== ConstraintType.NONE) {
      const bottomPiece = board[row + 1][col];
      if (bottomPiece !== PieceType.EMPTY) {
        const constraint = this.vConstraints[row][col];
        if (constraint === ConstraintType.SAME && piece !== bottomPiece) {
          return `placing ${piece} violates the '=' constraint with ${bottomPiece} below`;
        }
        if (constraint === ConstraintType.DIFFERENT && piece === bottomPiece) {
          return `placing ${piece} violates the 'x' constraint with ${bottomPiece} below`;
        }
      }
    }

    return null;
  }

}
