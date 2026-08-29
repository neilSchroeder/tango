/**
 * Improved Tango board solver with enhanced rule-based deduction.
 * Focuses on systematic application of game rules for better solving efficiency.
 */

import { 
  PieceType, 
  ConstraintType, 
  BOARD_SIZE, 
  MAX_PIECES_PER_ROW_COL,
  type HintResult 
} from '../types';
import { BacktrackSolver } from './BacktrackSolver';

/**
 * Domain-based constraint system with CDCL (Conflict-Driven Clause Learning)
 */
interface VariableDomain {
  position: [number, number];
  possibleValues: Set<PieceType>;
  isLocked: boolean;
  decisionLevel?: number; // For CDCL: track when this assignment was made
  reason?: ConflictClause; // For CDCL: why this value was assigned
}

interface DomainState {
  domains: Map<string, VariableDomain>;
  constraints: ConstraintNetwork;
  decisionLevel: number; // Current decision level for CDCL
  assignments: Assignment[]; // Assignment trail for CDCL
}

interface ConstraintNetwork {
  directConstraints: Array<{
    pos1: [number, number];
    pos2: [number, number];
    type: ConstraintType;
  }>;
  balanceConstraints: Array<{
    type: 'row' | 'column';
    index: number;
  }>;
  consecutiveConstraints: Array<{
    positions: Array<[number, number]>;
    direction: 'horizontal' | 'vertical';
  }>;
  learnedClauses: ConflictClause[]; // CDCL: Learned conflict clauses
}

/**
 * CDCL (Conflict-Driven Clause Learning) Components
 */
interface Assignment {
  variable: string; // Position key
  value: PieceType;
  decisionLevel: number;
  isDecision: boolean; // true if decision, false if propagated
  reason?: ConflictClause; // Why this assignment was made (for propagated assignments)
}

interface ConflictClause {
  literals: Literal[]; // Variables that must not all be true simultaneously
  learnedAt: number; // Decision level when this clause was learned
  activity: number; // For clause deletion heuristics
}

interface Literal {
  variable: string; // Position key
  value: PieceType;
  negated: boolean; // true = "variable must NOT be value", false = "variable must be value"
}

interface ConflictAnalysis {
  conflictClause: ConflictClause;
  backtrackLevel: number; // Level to backtrack to (non-chronological)
}

export class TangoBoardSolver {
  private originalBoard: PieceType[][];
  private hConstraints: ConstraintType[][];
  private vConstraints: ConstraintType[][];
  private lockedTiles: boolean[][];
  private size = BOARD_SIZE;
  private emptyPositions: [number, number][];
  
  // New domain-based solving components
  private useDomainBasedSolving = true; // Feature flag for domain-based approach
  private useCDCL = true; // Feature flag for CDCL (Conflict-Driven Clause Learning)
  private constraintNetwork: ConstraintNetwork;
  private initialDomains: Map<string, VariableDomain>;

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

    // Find empty positions that need to be filled
    this.emptyPositions = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (!lockedTiles[row][col]) {
          this.emptyPositions.push([row, col]);
        }
      }
    }

    // Initialize domain-based solving components
    this.constraintNetwork = this.buildConstraintNetwork();
    this.initialDomains = this.initializeDomains();
    
  }

  /**
   * Build constraint network for domain-based solving
   */
  private buildConstraintNetwork(): ConstraintNetwork {
    const directConstraints: Array<{
      pos1: [number, number];
      pos2: [number, number];
      type: ConstraintType;
    }> = [];

    // Build horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (this.hConstraints[row][col] !== ConstraintType.NONE) {
          directConstraints.push({
            pos1: [row, col],
            pos2: [row, col + 1],
            type: this.hConstraints[row][col]
          });
        }
      }
    }

    // Build vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.vConstraints[row][col] !== ConstraintType.NONE) {
          directConstraints.push({
            pos1: [row, col],
            pos2: [row + 1, col],
            type: this.vConstraints[row][col]
          });
        }
      }
    }

    // Build balance constraints
    const balanceConstraints: Array<{
      type: 'row' | 'column';
      index: number;
    }> = [];

    for (let i = 0; i < this.size; i++) {
      balanceConstraints.push({ type: 'row', index: i });
      balanceConstraints.push({ type: 'column', index: i });
    }

    // Build consecutive constraints
    const consecutiveConstraints: Array<{
      positions: Array<[number, number]>;
      direction: 'horizontal' | 'vertical';
    }> = [];

    // Horizontal consecutive constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col <= this.size - 3; col++) {
        consecutiveConstraints.push({
          positions: [[row, col], [row, col + 1], [row, col + 2]],
          direction: 'horizontal'
        });
      }
    }

    // Vertical consecutive constraints
    for (let row = 0; row <= this.size - 3; row++) {
      for (let col = 0; col < this.size; col++) {
        consecutiveConstraints.push({
          positions: [[row, col], [row + 1, col], [row + 2, col]],
          direction: 'vertical'
        });
      }
    }

    return {
      directConstraints,
      balanceConstraints,
      consecutiveConstraints,
      learnedClauses: [] // Initialize empty learned clauses for CDCL
    };
  }

  /**
   * Initialize domains for all variables
   */
  private initializeDomains(): Map<string, VariableDomain> {
    const domains = new Map<string, VariableDomain>();

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const key = `${row},${col}`;
        const isLocked = this.lockedTiles[row][col];
        
        if (isLocked) {
          // Locked tiles have only their current value in domain
          domains.set(key, {
            position: [row, col],
            possibleValues: new Set([this.originalBoard[row][col]]),
            isLocked: true,
            decisionLevel: 0, // Locked tiles are at decision level 0
            reason: undefined
          });
        } else {
          // Empty tiles can be either SUN or MOON
          domains.set(key, {
            position: [row, col],
            possibleValues: new Set([PieceType.SUN, PieceType.MOON]),
            isLocked: false,
            decisionLevel: undefined,
            reason: undefined
          });
        }
      }
    }

    return domains;
  }

  /**
   * Create domain state for solving with CDCL support
   */
  private createDomainState(): DomainState {
    // Deep copy of initial domains
    const domains = new Map<string, VariableDomain>();
    for (const [key, domain] of this.initialDomains) {
      domains.set(key, {
        position: [...domain.position] as [number, number],
        possibleValues: new Set(domain.possibleValues),
        isLocked: domain.isLocked,
        decisionLevel: domain.isLocked ? 0 : undefined, // Locked tiles are at level 0
        reason: undefined
      });
    }

    return {
      domains,
      constraints: this.constraintNetwork,
      decisionLevel: 0, // Start at decision level 0
      assignments: [] // Empty assignment trail
    };
  }

  
  private checkLearnedClauses(domainState: DomainState): string[] {
    const conflicts: string[] = [];

    for (const clause of domainState.constraints.learnedClauses) {
      let satisfiedLiterals = 0;
      let unsatisfiedLiterals = 0;
      const conflictingVars: string[] = [];

      for (const literal of clause.literals) {
        const domain = domainState.domains.get(literal.variable);
        if (!domain) continue;

        if (domain.possibleValues.size === 1) {
          const assignedValue = Array.from(domain.possibleValues)[0];
          const literalSatisfied = literal.negated ? 
            (assignedValue !== literal.value) : 
            (assignedValue === literal.value);

          if (literalSatisfied) {
            satisfiedLiterals++;
          } else {
            unsatisfiedLiterals++;
            conflictingVars.push(literal.variable);
          }
        }
      }

      // If all literals are false, we have a conflict
      if (satisfiedLiterals === 0 && unsatisfiedLiterals === clause.literals.length) {
        conflicts.push(...conflictingVars);
      }
    }

    return conflicts;
  }

  /**
   * Domain-based constraint propagation with CDCL integration
   */
  private propagateConstraintsDomain(domainState: DomainState): boolean {
    let changed = true;
    let iterations = 0;
    const maxIterations = 50;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Check learned clauses first for early conflict detection
      const learnedConflicts = this.checkLearnedClauses(domainState);
      if (learnedConflicts.length > 0) {
        return false; // Conflict detected from learned clauses
      }

      // Apply direct constraints (SAME/DIFFERENT)
      if (this.propagateDirectConstraintsDomain(domainState)) {
        changed = true;
      }

      // Apply balance constraints
      if (this.propagateBalanceConstraintsDomain(domainState)) {
        changed = true;
      }

      // Apply consecutive constraints
      if (this.propagateConsecutiveConstraintsDomain(domainState)) {
        changed = true;
      }

      // Check for empty domains (conflicts)
      for (const [key, domain] of domainState.domains) {
        if (!domain.isLocked && domain.possibleValues.size === 0) {
          return false; // Conflict detected
        }
      }
    }

    return true;
  }

  /**
   * Propagate direct constraints in domain space
   */
  private propagateDirectConstraintsDomain(domainState: DomainState): boolean {
    let changed = false;

    for (const constraint of domainState.constraints.directConstraints) {
      const key1 = `${constraint.pos1[0]},${constraint.pos1[1]}`;
      const key2 = `${constraint.pos2[0]},${constraint.pos2[1]}`;
      
      const domain1 = domainState.domains.get(key1);
      const domain2 = domainState.domains.get(key2);

      if (!domain1 || !domain2) continue;

      // If one domain has a single value, constrain the other
      if (domain1.possibleValues.size === 1 && !domain2.isLocked) {
        const value1 = Array.from(domain1.possibleValues)[0];
        const oldSize = domain2.possibleValues.size;

        if (constraint.type === ConstraintType.SAME) {
          // Only keep the same value
          domain2.possibleValues = new Set([value1]);
        } else if (constraint.type === ConstraintType.DIFFERENT) {
          // Remove the same value
          domain2.possibleValues.delete(value1);
        }

        if (domain2.possibleValues.size !== oldSize) {
          changed = true;
        }
      }

      // Apply constraint in reverse direction
      if (domain2.possibleValues.size === 1 && !domain1.isLocked) {
        const value2 = Array.from(domain2.possibleValues)[0];
        const oldSize = domain1.possibleValues.size;

        if (constraint.type === ConstraintType.SAME) {
          // Only keep the same value
          domain1.possibleValues = new Set([value2]);
        } else if (constraint.type === ConstraintType.DIFFERENT) {
          // Remove the same value
          domain1.possibleValues.delete(value2);
        }

        if (domain1.possibleValues.size !== oldSize) {
          changed = true;
        }
      }
    }

    return changed;
  }

  /**
   * Propagate balance constraints in domain space
   */
  private propagateBalanceConstraintsDomain(domainState: DomainState): boolean {
    let changed = false;

    for (const balanceConstraint of domainState.constraints.balanceConstraints) {
      if (balanceConstraint.type === 'row') {
        changed = this.propagateRowBalanceDomain(domainState, balanceConstraint.index) || changed;
      } else {
        changed = this.propagateColumnBalanceDomain(domainState, balanceConstraint.index) || changed;
      }
    }

    return changed;
  }

  /**
   * Propagate row balance constraint in domain space
   */
  private propagateRowBalanceDomain(domainState: DomainState, row: number): boolean {
    let changed = false;
    let sunCount = 0;
    let moonCount = 0;
    const unassigned: string[] = [];

    // Count assigned pieces and collect unassigned positions
    for (let col = 0; col < this.size; col++) {
      const key = `${row},${col}`;
      const domain = domainState.domains.get(key);
      
      if (domain && domain.possibleValues.size === 1) {
        const value = Array.from(domain.possibleValues)[0];
        if (value === PieceType.SUN) sunCount++;
        else if (value === PieceType.MOON) moonCount++;
      } else if (domain && !domain.isLocked) {
        unassigned.push(key);
      }
    }

    // If we have 3 of one type, remaining must be the other type
    if (sunCount === MAX_PIECES_PER_ROW_COL) {
      for (const key of unassigned) {
        const domain = domainState.domains.get(key);
        if (domain && domain.possibleValues.has(PieceType.SUN)) {
          domain.possibleValues.delete(PieceType.SUN);
          changed = true;
        }
      }
    }

    if (moonCount === MAX_PIECES_PER_ROW_COL) {
      for (const key of unassigned) {
        const domain = domainState.domains.get(key);
        if (domain && domain.possibleValues.has(PieceType.MOON)) {
          domain.possibleValues.delete(PieceType.MOON);
          changed = true;
        }
      }
    }

    return changed;
  }

  /**
   * Propagate column balance constraint in domain space
   */
  private propagateColumnBalanceDomain(domainState: DomainState, col: number): boolean {
    let changed = false;
    let sunCount = 0;
    let moonCount = 0;
    const unassigned: string[] = [];

    // Count assigned pieces and collect unassigned positions
    for (let row = 0; row < this.size; row++) {
      const key = `${row},${col}`;
      const domain = domainState.domains.get(key);
      
      if (domain && domain.possibleValues.size === 1) {
        const value = Array.from(domain.possibleValues)[0];
        if (value === PieceType.SUN) sunCount++;
        else if (value === PieceType.MOON) moonCount++;
      } else if (domain && !domain.isLocked) {
        unassigned.push(key);
      }
    }

    // If we have 3 of one type, remaining must be the other type
    if (sunCount === MAX_PIECES_PER_ROW_COL) {
      for (const key of unassigned) {
        const domain = domainState.domains.get(key);
        if (domain && domain.possibleValues.has(PieceType.SUN)) {
          domain.possibleValues.delete(PieceType.SUN);
          changed = true;
        }
      }
    }

    if (moonCount === MAX_PIECES_PER_ROW_COL) {
      for (const key of unassigned) {
        const domain = domainState.domains.get(key);
        if (domain && domain.possibleValues.has(PieceType.MOON)) {
          domain.possibleValues.delete(PieceType.MOON);
          changed = true;
        }
      }
    }

    return changed;
  }

  /**
   * Propagate consecutive constraints in domain space
   */
  private propagateConsecutiveConstraintsDomain(domainState: DomainState): boolean {
    let changed = false;

    for (const consConstraint of domainState.constraints.consecutiveConstraints) {
      changed = this.propagateConsecutiveSequenceDomain(domainState, consConstraint.positions) || changed;
    }

    return changed;
  }

  /**
   * Propagate consecutive constraint for a specific sequence
   */
  private propagateConsecutiveSequenceDomain(domainState: DomainState, positions: Array<[number, number]>): boolean {
    let changed = false;
    
    const domains = positions.map(pos => {
      const key = `${pos[0]},${pos[1]}`;
      return domainState.domains.get(key);
    }).filter(d => d !== undefined) as VariableDomain[];

    if (domains.length !== 3) return false;

    // Check for XX_ pattern - if first two are same, third must be different
    if (domains[0].possibleValues.size === 1 && domains[1].possibleValues.size === 1) {
      const val0 = Array.from(domains[0].possibleValues)[0];
      const val1 = Array.from(domains[1].possibleValues)[0];
      
      if (val0 === val1 && !domains[2].isLocked) {
        if (domains[2].possibleValues.has(val0)) {
          domains[2].possibleValues.delete(val0);
          changed = true;
        }
      }
    }

    // Check for _XX pattern - if last two are same, first must be different
    if (domains[1].possibleValues.size === 1 && domains[2].possibleValues.size === 1) {
      const val1 = Array.from(domains[1].possibleValues)[0];
      const val2 = Array.from(domains[2].possibleValues)[0];
      
      if (val1 === val2 && !domains[0].isLocked) {
        if (domains[0].possibleValues.has(val1)) {
          domains[0].possibleValues.delete(val1);
          changed = true;
        }
      }
    }

    // Check for X_X pattern - if first and third are same, middle must be different
    if (domains[0].possibleValues.size === 1 && domains[2].possibleValues.size === 1) {
      const val0 = Array.from(domains[0].possibleValues)[0];
      const val2 = Array.from(domains[2].possibleValues)[0];
      
      if (val0 === val2 && !domains[1].isLocked) {
        if (domains[1].possibleValues.has(val0)) {
          domains[1].possibleValues.delete(val0);
          changed = true;
        }
      }
    }

    return changed;
  }

  /**
   * Find all valid solutions using domain-based constraint propagation + backtracking
   * Falls back to original method if domain-based approach fails
   */
  findAllSolutions(maxSolutions: number = 10): PieceType[][][] {
    const startTime = Date.now();
    const timeout = 1000; // 1 seconds timeout

    // Try domain-based approach first
    if (this.useDomainBasedSolving) {
      try {
        const domainSolutions = this.findAllSolutionsDomain(maxSolutions, startTime, timeout);
        
        // Check for timeout
        if (Date.now() - startTime > timeout) {
          console.warn('Timeout during domain-based solution finding');
          return []; // Return empty solution set on timeout
        }
        
        // Validate that domain solutions work with original validation
        const validatedSolutions = domainSolutions.filter(solution => 
          this.isCompleteAndValid(solution)
        );
        
        if (validatedSolutions.length > 0) {
          // console.log(`Domain-based solver found ${validatedSolutions.length} solutions`);
          return validatedSolutions;
        }
      } catch (error) {
        console.warn('Domain-based solving failed, falling back to original method:', error);
      }
    }

    // Check for timeout before falling back
    if (Date.now() - startTime > timeout) {
      console.warn('Timeout before falling back to original solver');
      return []; // Return empty solution set on timeout
    }

    // Fallback to BacktrackSolver
    console.log('Using BacktrackSolver for backtracking');
    const backtrackSolver = new BacktrackSolver(
      this.originalBoard, 
      this.hConstraints, 
      this.vConstraints, 
      this.lockedTiles
    );
    return backtrackSolver.findAllSolutions(maxSolutions);
  }

  /**
   * Domain-based solution finding with optional CDCL
   */
  private findAllSolutionsDomain(
    maxSolutions: number = 10, 
    startTime: number = Date.now(),
    timeout: number = 2000
  ): PieceType[][][] {
    const solutions: PieceType[][][] = [];
    const domainState = this.createDomainState();

    // Apply initial constraint propagation
    if (!this.propagateConstraintsDomain(domainState)) {
      return solutions; // No valid solution possible
    }

    // Check for timeout
    if (Date.now() - startTime > timeout) {
      console.warn('Timeout during initial constraint propagation');
      return solutions;
    }

    if (this.useCDCL) {
      // CDCL not implemented yet, fall back to BacktrackSolver
      console.warn('CDCL not implemented, using BacktrackSolver');
      const backtrackSolver = new BacktrackSolver(
        this.originalBoard, 
        this.hConstraints, 
        this.vConstraints, 
        this.lockedTiles
      );
      return backtrackSolver.findAllSolutions(maxSolutions);
    } else {
      // Use BacktrackSolver for traditional backtracking
      const backtrackSolver = new BacktrackSolver(
        this.originalBoard, 
        this.hConstraints, 
        this.vConstraints, 
        this.lockedTiles
      );
      return backtrackSolver.findAllSolutions(maxSolutions);
    }
  }

  // Add helper method to count valid piece options for a position
  private countValidPieces(board: PieceType[][], row: number, col: number): number {
    let count = 0;
    if (this.canPlacePiece(board, row, col, PieceType.SUN)) count++;
    if (this.canPlacePiece(board, row, col, PieceType.MOON)) count++;
    return count;
  }

  // Add faster position validation that doesn't require full constraint propagation
  private isPositionValid(board: PieceType[][], row: number, col: number): boolean {
    // Quick local validity checks without full propagation
    const piece = board[row][col];
    
    // Check immediate consecutive violations
    if (!this.checkConsecutiveHorizontal(board, row, col) || 
        !this.checkConsecutiveVertical(board, row, col)) {
      return false;
    }
    
    // Check immediate constraint violations
    if (!this.checkConstraints(board, row, col)) {
      return false;
    }
    
    // Check immediate balance violations
    const rowCounts = this.countPiecesInRow(board, row);
    const colCounts = this.countPiecesInColumn(board, col);
    
    if (rowCounts.suns > MAX_PIECES_PER_ROW_COL || rowCounts.moons > MAX_PIECES_PER_ROW_COL ||
        colCounts.suns > MAX_PIECES_PER_ROW_COL || colCounts.moons > MAX_PIECES_PER_ROW_COL) {
      return false;
    }
    
    return true;
  }

  // Incremental propagation to avoid full board copying
  private applyIncrementalPropagation(board: PieceType[][], changedRow: number, changedCol: number): {
    success: boolean;
    changes: Array<{row: number, col: number, oldValue: PieceType, newValue: PieceType}>;
  } {
    const changes: Array<{row: number, col: number, oldValue: PieceType, newValue: PieceType}> = [];
    
    // Only propagate constraints that could be affected by this change
    const affectedPositions = this.getAffectedPositions(changedRow, changedCol);
    
    for (const [row, col] of affectedPositions) {
      if (board[row][col] === PieceType.EMPTY) {
        // Check if this position now has only one valid option
        const validPieces: PieceType[] = [];
        for (const piece of [PieceType.SUN, PieceType.MOON]) {
          if (this.canPlacePiece(board, row, col, piece)) {
            validPieces.push(piece);
          }
        }
        
        if (validPieces.length === 0) {
          // Conflict detected, restore and return failure
          this.restorePropagationChanges(board, changes);
          return { success: false, changes: [] };
        }
        
        if (validPieces.length === 1) {
          // Force this piece
          const oldValue = board[row][col];
          const newValue = validPieces[0];
          board[row][col] = newValue;
          changes.push({ row, col, oldValue, newValue });
        }
      }
    }
    
    return { success: true, changes };
  }
  
  private getAffectedPositions(changedRow: number, changedCol: number): Array<[number, number]> {
    const affected: Array<[number, number]> = [];
    
    // Add positions in the same row and column
    for (let c = 0; c < this.size; c++) {
      if (c !== changedCol) affected.push([changedRow, c]);
    }
    for (let r = 0; r < this.size; r++) {
      if (r !== changedRow) affected.push([r, changedCol]);
    }
    
    // Add positions connected by constraints
    const constraintPositions = [
      [changedRow, changedCol - 1], [changedRow, changedCol + 1],
      [changedRow - 1, changedCol], [changedRow + 1, changedCol]
    ];
    
    for (const [r, c] of constraintPositions) {
      if (r >= 0 && r < this.size && c >= 0 && c < this.size) {
        affected.push([r, c]);
      }
    }
    
    return affected;
  }
  
  private restorePropagationChanges(
    board: PieceType[][], 
    changes: Array<{row: number, col: number, oldValue: PieceType, newValue: PieceType}>
  ): void {
    for (const change of changes.reverse()) {
      board[change.row][change.col] = change.oldValue;
    }
  }

  /**
   * Enable or disable domain-based solving (for testing/debugging)
   */
  setUseDomainBasedSolving(enabled: boolean): void {
    this.useDomainBasedSolving = enabled;
  }

  /**
   * Enable or disable CDCL (Conflict-Driven Clause Learning)
   */
  setUseCDCL(enabled: boolean): void {
    this.useCDCL = enabled;
  }

  /**
   * Get current solving method being used
   */
  getSolvingMethod(): string {
    if (!this.useDomainBasedSolving) {
      return 'board-based (legacy fallback)';
    }
    
    let method = 'domain-based';
    if (this.useCDCL) {
      method += ' + CDCL';
    }
    return method;
  }

  /**
   * Apply constraint propagation to fill in forced moves
   */
  private applyConstraintPropagation(board: PieceType[][]): boolean {
    let madeProgress = true;
    let iterations = 0;
    const maxIterations = 50; // Prevent infinite loops

    while (madeProgress && iterations < maxIterations) {
      madeProgress = false;
      iterations++;

      // Apply each type of constraint propagation
      const techniques = [
        () => this.applyDirectConstraints(board),
        () => this.applyConsecutiveRules(board),
        () => this.applyBalanceRules(board),
        () => this.applyPatternDeduction(board),
        () => this.applyAdvancedPatterns(board)
      ];

      for (const technique of techniques) {
        if (technique()) {
          madeProgress = true;
          // Check if board is still valid after changes
          if (!this.isBoardStateValid(board)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Apply direct constraint deductions (= and ≠ symbols)
   */
  private applyDirectConstraints(board: PieceType[][]): boolean {
    let madeChanges = false;

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] !== PieceType.EMPTY) {
          const piece = board[row][col];

          // Apply horizontal constraints
          if (col < this.size - 1 && this.hConstraints[row][col] !== ConstraintType.NONE) {
            const constraint = this.hConstraints[row][col];
            const rightCol = col + 1;
            
            if (board[row][rightCol] === PieceType.EMPTY) {
              let requiredPiece: PieceType;
              
              if (constraint === ConstraintType.SAME) {
                requiredPiece = piece;
              } else { // DIFFERENT
                requiredPiece = piece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
              }

              if (this.canPlacePiece(board, row, rightCol, requiredPiece)) {
                board[row][rightCol] = requiredPiece;
                madeChanges = true;
              }
            }
          }

          if (col > 0 && this.hConstraints[row][col - 1] !== ConstraintType.NONE) {
            const constraint = this.hConstraints[row][col - 1];
            const leftCol = col - 1;
            
            if (board[row][leftCol] === PieceType.EMPTY) {
              let requiredPiece: PieceType;
              
              if (constraint === ConstraintType.SAME) {
                requiredPiece = piece;
              } else { // DIFFERENT
                requiredPiece = piece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
              }

              if (this.canPlacePiece(board, row, leftCol, requiredPiece)) {
                board[row][leftCol] = requiredPiece;
                madeChanges = true;
              }
            }
          }

          // Apply vertical constraints
          if (row < this.size - 1 && this.vConstraints[row][col] !== ConstraintType.NONE) {
            const constraint = this.vConstraints[row][col];
            const bottomRow = row + 1;
            
            if (board[bottomRow][col] === PieceType.EMPTY) {
              let requiredPiece: PieceType;
              
              if (constraint === ConstraintType.SAME) {
                requiredPiece = piece;
              } else { // DIFFERENT
                requiredPiece = piece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
              }

              if (this.canPlacePiece(board, bottomRow, col, requiredPiece)) {
                board[bottomRow][col] = requiredPiece;
                madeChanges = true;
              }
            }
          }

          if (row > 0 && this.vConstraints[row - 1][col] !== ConstraintType.NONE) {
            const constraint = this.vConstraints[row - 1][col];
            const topRow = row - 1;
            
            if (board[topRow][col] === PieceType.EMPTY) {
              let requiredPiece: PieceType;
              
              if (constraint === ConstraintType.SAME) {
                requiredPiece = piece;
              } else { // DIFFERENT
                requiredPiece = piece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
              }

              if (this.canPlacePiece(board, topRow, col, requiredPiece)) {
                board[topRow][col] = requiredPiece;
                madeChanges = true;
              }
            }
          }
        }
      }
    }

    return madeChanges;
  }

  /**
   * Apply consecutive rule deductions (no 3 in a row/column)
   */
  private applyConsecutiveRules(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check horizontal patterns
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          // Pattern: XX_ -> must place opposite
          if (col >= 2 && board[row][col - 1] !== PieceType.EMPTY && 
              board[row][col - 1] === board[row][col - 2]) {
            const opposite = board[row][col - 1] === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            if (this.canPlacePiece(board, row, col, opposite)) {
              board[row][col] = opposite;
              madeChanges = true;
            }
          }
          // Pattern: _XX -> must place opposite
          else if (col <= this.size - 3 && board[row][col + 1] !== PieceType.EMPTY && 
                   board[row][col + 1] === board[row][col + 2]) {
            const opposite = board[row][col + 1] === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            if (this.canPlacePiece(board, row, col, opposite)) {
              board[row][col] = opposite;
              madeChanges = true;
            }
          }
          // Pattern: X_X -> middle must be opposite
          else if (col >= 1 && col <= this.size - 2 && 
                   board[row][col - 1] !== PieceType.EMPTY &&
                   board[row][col + 1] !== PieceType.EMPTY &&
                   board[row][col - 1] === board[row][col + 1]) {
            const opposite = board[row][col - 1] === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            if (this.canPlacePiece(board, row, col, opposite)) {
              board[row][col] = opposite;
              madeChanges = true;
            }
          }
        }
      }
    }

    // Check vertical patterns
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          // Pattern: XX_ (vertical) -> must place opposite
          if (row >= 2 && board[row - 1][col] !== PieceType.EMPTY && 
              board[row - 1][col] === board[row - 2][col]) {
            const opposite = board[row - 1][col] === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            if (this.canPlacePiece(board, row, col, opposite)) {
              board[row][col] = opposite;
              madeChanges = true;
            }
          }
          // Pattern: _XX (vertical) -> must place opposite
          else if (row <= this.size - 3 && board[row + 1][col] !== PieceType.EMPTY && 
                   board[row + 1][col] === board[row + 2][col]) {
            const opposite = board[row + 1][col] === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            if (this.canPlacePiece(board, row, col, opposite)) {
              board[row][col] = opposite;
              madeChanges = true;
            }
          }
          // Pattern: X_X (vertical) -> middle must be opposite
          else if (row >= 1 && row <= this.size - 2 && 
                   board[row - 1][col] !== PieceType.EMPTY &&
                   board[row + 1][col] !== PieceType.EMPTY &&
                   board[row - 1][col] === board[row + 1][col]) {
            const opposite = board[row - 1][col] === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            if (this.canPlacePiece(board, row, col, opposite)) {
              board[row][col] = opposite;
              madeChanges = true;
            }
          }
        }
      }
    }

    return madeChanges;
  }

  /**
   * Apply balance rule deductions (3 of each type per row/column)
   */
  private applyBalanceRules(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check rows
    for (let row = 0; row < this.size; row++) {
      const counts = this.countPiecesInRow(board, row);
      
      // If we have 3 of one type, fill remaining with other type
      if (counts.suns === MAX_PIECES_PER_ROW_COL) {
        for (let col = 0; col < this.size; col++) {
          if (board[row][col] === PieceType.EMPTY) {
            if (this.canPlacePiece(board, row, col, PieceType.MOON)) {
              board[row][col] = PieceType.MOON;
              madeChanges = true;
            }
          }
        }
      } else if (counts.moons === MAX_PIECES_PER_ROW_COL) {
        for (let col = 0; col < this.size; col++) {
          if (board[row][col] === PieceType.EMPTY) {
            if (this.canPlacePiece(board, row, col, PieceType.SUN)) {
              board[row][col] = PieceType.SUN;
              madeChanges = true;
            }
          }
        }
      }
    }

    // Check columns
    for (let col = 0; col < this.size; col++) {
      const counts = this.countPiecesInColumn(board, col);
      
      // If we have 3 of one type, fill remaining with other type
      if (counts.suns === MAX_PIECES_PER_ROW_COL) {
        for (let row = 0; row < this.size; row++) {
          if (board[row][col] === PieceType.EMPTY) {
            if (this.canPlacePiece(board, row, col, PieceType.MOON)) {
              board[row][col] = PieceType.MOON;
              madeChanges = true;
            }
          }
        }
      } else if (counts.moons === MAX_PIECES_PER_ROW_COL) {
        for (let row = 0; row < this.size; row++) {
          if (board[row][col] === PieceType.EMPTY) {
            if (this.canPlacePiece(board, row, col, PieceType.SUN)) {
              board[row][col] = PieceType.SUN;
              madeChanges = true;
            }
          }
        }
      }
    }

    // Apply advanced balance rule with constraint inference
    madeChanges = this.applyAdvancedBalanceRule(board) || madeChanges;

    return madeChanges;
  }

  /**
   * Apply advanced balance rule: If a row/column has 3 filled tiles and 3 empty tiles,
   * and there's an 'x' constraint between two empty tiles, then the third empty tile
   * can be inferred based on the balance rule.
   * 
   * Example: _ x _ _ S M M → _ x _ S S M M
   * The third empty position must be S to satisfy the balance rule (3 S, 3 M)
   */
  private applyAdvancedBalanceRule(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check rows
    for (let row = 0; row < this.size; row++) {
      madeChanges = this.applyAdvancedBalanceForRow(board, row) || madeChanges;
    }

    // Check columns
    for (let col = 0; col < this.size; col++) {
      madeChanges = this.applyAdvancedBalanceForColumn(board, col) || madeChanges;
    }

    return madeChanges;
  }

  /**
   * Apply advanced balance rule for a specific row
   */
  private applyAdvancedBalanceForRow(board: PieceType[][], row: number): boolean {
    let madeChanges = false;
    
    const counts = this.countPiecesInRow(board, row);
    const emptyCount = this.size - counts.suns - counts.moons;
    
    // Only apply if we have exactly 3 filled and 3 empty tiles
    if (counts.suns + counts.moons !== 3 || emptyCount !== 3) {
      return false;
    }
    
    // Find empty positions and constraints between them
    const emptyPositions: number[] = [];
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.EMPTY) {
        emptyPositions.push(col);
      }
    }
    
    // Look for 'x' constraints between empty positions
    for (let i = 0; i < emptyPositions.length - 1; i++) {
      const pos1 = emptyPositions[i];
      const pos2 = emptyPositions[i + 1];
      
      // Check if there's an 'x' constraint between these positions
      if (pos2 === pos1 + 1 && this.hConstraints[row][pos1] === ConstraintType.DIFFERENT) {
        // We have an 'x' constraint between two consecutive empty positions
        // Find the third empty position
        const thirdPos = emptyPositions.find(pos => pos !== pos1 && pos !== pos2);
        if (thirdPos !== undefined) {
          // Determine what piece type is needed to balance
          const neededSuns = MAX_PIECES_PER_ROW_COL - counts.suns;
          const neededMoons = MAX_PIECES_PER_ROW_COL - counts.moons;
          
          // If we need more of one type, place it in the third position
          if (neededSuns > neededMoons && this.canPlacePiece(board, row, thirdPos, PieceType.SUN)) {
            board[row][thirdPos] = PieceType.SUN;
            madeChanges = true;
          } else if (neededMoons > neededSuns && this.canPlacePiece(board, row, thirdPos, PieceType.MOON)) {
            board[row][thirdPos] = PieceType.MOON;
            madeChanges = true;
          }
        }
      }
    }
    
    return madeChanges;
  }

  /**
   * Apply advanced balance rule for a specific column
   */
  private applyAdvancedBalanceForColumn(board: PieceType[][], col: number): boolean {
    let madeChanges = false;
    
    const counts = this.countPiecesInColumn(board, col);
    const emptyCount = this.size - counts.suns - counts.moons;
    
    // Only apply if we have exactly 3 filled and 3 empty tiles
    if (counts.suns + counts.moons !== 3 || emptyCount !== 3) {
      return false;
    }
    
    // Find empty positions and constraints between them
    const emptyPositions: number[] = [];
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.EMPTY) {
        emptyPositions.push(row);
      }
    }
    
    // Look for 'x' constraints between empty positions
    for (let i = 0; i < emptyPositions.length - 1; i++) {
      const pos1 = emptyPositions[i];
      const pos2 = emptyPositions[i + 1];
      
      // Check if there's an 'x' constraint between these positions
      if (pos2 === pos1 + 1 && this.vConstraints[pos1][col] === ConstraintType.DIFFERENT) {
        // We have an 'x' constraint between two consecutive empty positions
        // Find the third empty position
        const thirdPos = emptyPositions.find(pos => pos !== pos1 && pos !== pos2);
        if (thirdPos !== undefined) {
          // Determine what piece type is needed to balance
          const neededSuns = MAX_PIECES_PER_ROW_COL - counts.suns;
          const neededMoons = MAX_PIECES_PER_ROW_COL - counts.moons;
          
          // If we need more of one type, place it in the third position
          if (neededSuns > neededMoons && this.canPlacePiece(board, thirdPos, col, PieceType.SUN)) {
            board[thirdPos][col] = PieceType.SUN;
            madeChanges = true;
          } else if (neededMoons > neededSuns && this.canPlacePiece(board, thirdPos, col, PieceType.MOON)) {
            board[thirdPos][col] = PieceType.MOON;
            madeChanges = true;
          }
        }
      }
    }
    
    return madeChanges;
  }

  /**
   * Apply pattern deduction for multi-cell sequences
   */
  private applyPatternDeduction(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Apply constraint-based patterns first
    madeChanges = this.applyConstraintPatterns(board) || madeChanges;

    // Look for patterns like: _ _ X where filling creates forced sequence
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 2; col++) {
        // Pattern: _ _ X
        if (board[row][col] === PieceType.EMPTY && 
            board[row][col + 1] === PieceType.EMPTY && 
            board[row][col + 2] !== PieceType.EMPTY) {
          
          const knownPiece = board[row][col + 2];
          const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          // First position must be opposite to avoid eventual XXX
          if (this.canPlacePiece(board, row, col, opposite)) {
            board[row][col] = opposite;
            madeChanges = true;
          }
        }
        
        // Pattern: X _ _
        if (board[row][col] !== PieceType.EMPTY && 
            board[row][col + 1] === PieceType.EMPTY && 
            board[row][col + 2] === PieceType.EMPTY) {
          
          const knownPiece = board[row][col];
          const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          // Second position must be opposite to avoid XXX
          if (this.canPlacePiece(board, row, col + 1, opposite)) {
            board[row][col + 1] = opposite;
            madeChanges = true;
          }
        }
      }
    }

    // Same patterns for columns
    for (let row = 0; row < this.size - 2; row++) {
      for (let col = 0; col < this.size; col++) {
        // Pattern: _ _ X (vertical)
        if (board[row][col] === PieceType.EMPTY && 
            board[row + 1][col] === PieceType.EMPTY && 
            board[row + 2][col] !== PieceType.EMPTY) {
          
          const knownPiece = board[row + 2][col];
          const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          if (this.canPlacePiece(board, row, col, opposite)) {
            board[row][col] = opposite;
            madeChanges = true;
          }
        }
        
        // Pattern: X _ _ (vertical)
        if (board[row][col] !== PieceType.EMPTY && 
            board[row + 1][col] === PieceType.EMPTY && 
            board[row + 2][col] === PieceType.EMPTY) {
          
          const knownPiece = board[row][col];
          const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          if (this.canPlacePiece(board, row + 1, col, opposite)) {
            board[row + 1][col] = opposite;
            madeChanges = true;
          }
        }
      }
    }

    return madeChanges;
  }

  /**
   * Apply constraint-based patterns that create forced sequences
   */
  private applyConstraintPatterns(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Pattern 1: Equal sign between two blank pieces with filled pieces on either end
    // X _ = _ Y pattern analysis
    madeChanges = this.applyEqualConstraintPattern(board) || madeChanges;
    
    // Pattern 2: Different constraint patterns
    madeChanges = this.applyDifferentConstraintPattern(board) || madeChanges;

    // Pattern 3: Advanced balance rule with two x constraints
    // A _x_ _x_ _ always yields A _x_ _x_ B (position agnostic)
    madeChanges = this.applyTwoXConstraintPattern(board) || madeChanges;

    // Pattern 4: Triple equals constraint pattern
    // A _=_ _=_ _ is always solvable as A B B A A B
    madeChanges = this.applyTripleEqualsPattern(board) || madeChanges;

    return madeChanges;
  }

  /**
   * Applies patterns involving equal constraints (=)
   * Pattern: X _ = _ Y where X and Y are filled pieces
   * This always results in the two blank pieces being filled with the opposite of X (and Y)
   */
  private applyEqualConstraintPattern(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check horizontal equal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (this.hConstraints[row][col] === ConstraintType.SAME) {
          // Look for patterns around this equal constraint
          madeChanges = this.processHorizontalEqualPattern(board, row, col) || madeChanges;
        }
      }
    }

    // Check vertical equal constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.vConstraints[row][col] === ConstraintType.SAME) {
          // Look for patterns around this equal constraint
          madeChanges = this.processVerticalEqualPattern(board, row, col) || madeChanges;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Process horizontal equal constraint patterns
   */
  private processHorizontalEqualPattern(board: PieceType[][], row: number, col: number): boolean {
    let madeChanges = false;
    const leftPos = col;
    const rightPos = col + 1;

    // Pattern: X _ = _ Y (where X and Y are filled, middle two are empty)
    if (leftPos >= 1 && rightPos < this.size - 1) {
      const farLeft = board[row][leftPos - 1];
      const left = board[row][leftPos];
      const right = board[row][rightPos];
      const farRight = board[row][rightPos + 1];

      if (farLeft !== PieceType.EMPTY && left === PieceType.EMPTY && 
          right === PieceType.EMPTY && farRight !== PieceType.EMPTY) {
        
        // Both middle pieces must be the same (due to = constraint)
        // And they must be opposite to the end pieces to avoid 3 consecutive
        const endPiece = farLeft; // Should be same as farRight due to game rules
        const oppositePiece = endPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
        
        if (this.canPlacePiece(board, row, leftPos, oppositePiece) && 
            this.canPlacePiece(board, row, rightPos, oppositePiece)) {
          board[row][leftPos] = oppositePiece;
          board[row][rightPos] = oppositePiece;
          madeChanges = true;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Process vertical equal constraint patterns
   */
  private processVerticalEqualPattern(board: PieceType[][], row: number, col: number): boolean {
    let madeChanges = false;
    const topPos = row;
    const bottomPos = row + 1;

    // Pattern: X _ = _ Y (vertical, where X and Y are filled, middle two are empty)
    if (topPos >= 1 && bottomPos < this.size - 1) {
      const farTop = board[topPos - 1][col];
      const top = board[topPos][col];
      const bottom = board[bottomPos][col];
      const farBottom = board[bottomPos + 1][col];

      if (farTop !== PieceType.EMPTY && top === PieceType.EMPTY && 
          bottom === PieceType.EMPTY && farBottom !== PieceType.EMPTY) {
        
        // Both middle pieces must be the same (due to = constraint)
        // And they must be opposite to the end pieces to avoid 3 consecutive
        const endPiece = farTop; // Should be same as farBottom due to game rules
        const oppositePiece = endPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
        
        if (this.canPlacePiece(board, topPos, col, oppositePiece) && 
            this.canPlacePiece(board, bottomPos, col, oppositePiece)) {
          board[topPos][col] = oppositePiece;
          board[bottomPos][col] = oppositePiece;
          madeChanges = true;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Applies patterns involving different constraints (×)
   */
  private applyDifferentConstraintPattern(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Apply complex mixed constraint patterns
    madeChanges = this.applyMixedConstraintSequences(board) || madeChanges;

    return madeChanges;
  }

  /**
   * Apply advanced balance rule with two x constraints
   * Pattern: A _x_ _x_ _ always yields A _x_ _x_ B (position agnostic)
   * All permutations are true for the location of A and B, as long as there are 
   * two pairs of empty tiles with an 'x' constraint between them
   */
  private applyTwoXConstraintPattern(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check horizontal patterns
    madeChanges = this.applyHorizontalTwoXPattern(board) || madeChanges;
    
    // Check vertical patterns
    madeChanges = this.applyVerticalTwoXPattern(board) || madeChanges;

    return madeChanges;
  }

  /**
   * Apply horizontal two x constraint pattern
   * Pattern: A _x_ _x_ _ where A is known and the rest are empty
   */
  private applyHorizontalTwoXPattern(board: PieceType[][], row?: number): boolean {
    let madeChanges = false;
    const rowsToCheck = row !== undefined ? [row] : Array.from({ length: this.size }, (_, i) => i);

    for (const r of rowsToCheck) {
      // Look for pattern: A _x_ _x_ _ (5 positions needed)
      for (let col = 0; col <= this.size - 5; col++) {
        if (this.checkHorizontalTwoXPattern(board, r, col)) {
          madeChanges = this.applyHorizontalTwoXPatternSolution(board, r, col) || madeChanges;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Check if horizontal two x pattern exists at position
   */
  private checkHorizontalTwoXPattern(board: PieceType[][], row: number, col: number): boolean {
    // Pattern: [A] [_] [x] [_] [x] [_]
    //          0   1   2   3   4   5
    
    // Check if position 0 has a known piece
    if (board[row][col] === PieceType.EMPTY) return false;
    
    // Check for x constraints at positions 2 and 4
    if (col + 2 >= this.size || this.hConstraints[row][col + 2] !== ConstraintType.DIFFERENT) return false;
    if (col + 4 >= this.size || this.hConstraints[row][col + 4] !== ConstraintType.DIFFERENT) return false;
    
    // Check that positions 1, 3, 5 are empty
    const emptyPositions = [1, 3, 5];
    for (const pos of emptyPositions) {
      if (col + pos >= this.size || board[row][col + pos] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply solution for horizontal two x pattern: A _x_ _x_ _ → A B x A x B
   */
  private applyHorizontalTwoXPatternSolution(board: PieceType[][], row: number, col: number): boolean {
    const knownPiece = board[row][col]; // A
    const oppositePiece = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN; // B
    
    let madeChanges = false;
    
    // Fill pattern: A B x A x B
    const positions = [
      { pos: 1, piece: oppositePiece }, // Position 1 gets B
      { pos: 3, piece: knownPiece },    // Position 3 gets A  
      { pos: 5, piece: oppositePiece }  // Position 5 gets B
    ];
    
    for (const { pos, piece } of positions) {
      if (col + pos < this.size && board[row][col + pos] === PieceType.EMPTY) {
        if (this.canPlacePiece(board, row, col + pos, piece)) {
          board[row][col + pos] = piece;
          madeChanges = true;
        }
      }
    }
    
    return madeChanges;
  }

  /**
   * Apply vertical two x constraint pattern
   */
  private applyVerticalTwoXPattern(board: PieceType[][], col?: number): boolean {
    let madeChanges = false;
    const colsToCheck = col !== undefined ? [col] : Array.from({ length: this.size }, (_, i) => i);

    for (const c of colsToCheck) {
      // Look for pattern: A _x_ _x_ _ (5 positions needed)
      for (let row = 0; row <= this.size - 5; row++) {
        if (this.checkVerticalTwoXPattern(board, row, c)) {
          madeChanges = this.applyVerticalTwoXPatternSolution(board, row, c) || madeChanges;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Check if vertical two x pattern exists at position
   */
  private checkVerticalTwoXPattern(board: PieceType[][], row: number, col: number): boolean {
    // Pattern: [A] [_] [x] [_] [x] [_] (vertical)
    //          0   1   2   3   4   5
    
    // First, ensure we have enough room on the board for this pattern
    if (row + 5 >= this.size) return false;
    
    // Check if position 0 has a known piece
    if (board[row][col] === PieceType.EMPTY) return false;
    
    // Ensure all necessary vConstraints indices exist before accessing
    if (!this.vConstraints[row + 1] || 
        !this.vConstraints[row + 3] || 
        col < 0 || 
        col >= this.size) {
      return false;
    }
    
    // Check for x constraints at positions 1-2 and 3-4
    if (this.vConstraints[row + 1][col] !== ConstraintType.DIFFERENT) return false;
    if (this.vConstraints[row + 3][col] !== ConstraintType.DIFFERENT) return false;
    
    // Check that positions 1, 3, 5 are empty
    const emptyPositions = [1, 3, 5];
    for (const pos of emptyPositions) {
      if (board[row + pos][col] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply solution for vertical two x pattern: A _x_ _x_ _ → A B x A B A B
   */
  private applyVerticalTwoXPatternSolution(board: PieceType[][], row: number, col: number): boolean {
    const knownPiece = board[row][col]; // A
    const oppositePiece = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN; // B
    
    let madeChanges = false;
    
    // Fill pattern: A B x A x B
    const positions = [
      { pos: 1, piece: oppositePiece }, // Position 1 gets B
      { pos: 3, piece: knownPiece },    // Position 3 gets A  
      { pos: 5, piece: oppositePiece }  // Position 5 gets B
    ];
    
    for (const { pos, piece } of positions) {
      if (row + pos < this.size && board[row + pos][col] === PieceType.EMPTY) {
        if (this.canPlacePiece(board, row + pos, col, piece)) {
          board[row + pos][col] = piece;
          madeChanges = true;
        }
      }
    }
    
    return madeChanges;
  }

  /**
   * Apply triple equals constraint pattern
   * Pattern: A _=_ _=_ _ is always solvable as A B B A A B
   */
  private applyTripleEqualsPattern(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check horizontal patterns
    madeChanges = this.applyHorizontalDoubleEqualsPattern(board) || madeChanges;
    
    // Check vertical patterns  
    madeChanges = this.applyVerticalTripleEqualsPattern(board) || madeChanges;

    return madeChanges;
  }

  /**
   * Apply horizontal triple equals pattern
   * Pattern: A _=_ _=_ _ where A is known and the rest are empty
   */
  private applyHorizontalDoubleEqualsPattern(board: PieceType[][], row?: number): boolean {
    let madeChanges = false;
    const rowsToCheck = row !== undefined ? [row] : Array.from({ length: this.size }, (_, i) => i);

    for (const r of rowsToCheck) {
      // Look for pattern: A _=_ _=_ _ (BOARD_SIZE positions needed)
      for (let col = 0; col <= this.size - BOARD_SIZE; col++) {
        if (this.checkHorizontalTripleEqualsPattern(board, r, col)) {
          madeChanges = this.applyHorizontalDoubleEqualsPatternSolution(board, r, col) || madeChanges;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Check if horizontal triple equals pattern exists at position
   */
  private checkHorizontalTripleEqualsPattern(board: PieceType[][], row: number, col: number): boolean {
    // Pattern: [A] [_] [=] [_] [=] [_]
    //          0   1   2   3   4   5
    
    // Check if position 0 has a known piece
    if (board[row][col] === PieceType.EMPTY) return false;
    
    // Check for = constraints at positions 2 and 4
    if (col + 2 >= this.size || this.hConstraints[row][col + 2] !== ConstraintType.SAME) return false;
    if (col + 4 >= this.size || this.hConstraints[row][col + 4] !== ConstraintType.SAME) return false;
    
    // Check that positions 1, 3, 5 are empty
    const emptyPositions = [1, 3, 5];
    for (const pos of emptyPositions) {
      if (col + pos >= this.size || board[row][col + pos] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply solution for horizontal triple equals pattern: A _=_ _=_ _ → A B B A A B
   */
  private applyHorizontalDoubleEqualsPatternSolution(board: PieceType[][], row: number, col: number): boolean {
    const knownPiece = board[row][col]; // A
    const oppositePiece = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN; // B
    
    let madeChanges = false;
    
    // Fill pattern: A B = B = A (which gives us A B B A A B when expanded)
    const positions = [
      { pos: 1, piece: oppositePiece }, // Position 1 gets B
      { pos: 3, piece: oppositePiece }, // Position 3 gets B (same as pos 1 due to =)
      { pos: 5, piece: knownPiece }     // Position 5 gets A (same as pos 3 due to =)
    ];
    
    for (const { pos, piece } of positions) {
      if (col + pos < this.size && board[row][col + pos] === PieceType.EMPTY) {
        if (this.canPlacePiece(board, row, col + pos, piece)) {
          board[row][col + pos] = piece;
          madeChanges = true;
        }
      }
    }
    
    return madeChanges;
  }

  /**
   * Apply vertical triple equals pattern
   */
  private applyVerticalTripleEqualsPattern(board: PieceType[][], col?: number): boolean {
    let madeChanges = false;
    const colsToCheck = col !== undefined ? [col] : Array.from({ length: this.size }, (_, i) => i);

    for (const c of colsToCheck) {
      // Look for pattern: A _=_ _=_ _ (6 positions needed)
      for (let row = 0; row <= this.size - 6; row++) {
        if (this.checkVerticalTripleEqualsPattern(board, row, c)) {
          madeChanges = this.applyVerticalTripleEqualsPatternSolution(board, row, c) || madeChanges;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Check if vertical triple equals pattern exists at position
   */
  private checkVerticalTripleEqualsPattern(board: PieceType[][], row: number, col: number): boolean {
    // Pattern: [A] [_] [=] [_] [=] [_] (vertical)
    //          0   1   2   3   4   5
    
    // Check if position 0 has a known piece
    if (board[row][col] === PieceType.EMPTY) return false;
    
    // Check for = constraints at positions 2 and 4
    if (row + 2 >= this.size || this.vConstraints[row + 2][col] !== ConstraintType.SAME) return false;
    if (row + 4 >= this.size || this.vConstraints[row + 4][col] !== ConstraintType.SAME) return false;
    
    // Check that positions 1, 3, 5 are empty
    const emptyPositions = [1, 3, 5];
    for (const pos of emptyPositions) {
      if (row + pos >= this.size || board[row + pos][col] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply solution for vertical triple equals pattern: A _=_ _=_ _ → A B B A A B
   */
  private applyVerticalTripleEqualsPatternSolution(board: PieceType[][], row: number, col: number): boolean {
    const knownPiece = board[row][col]; // A
    const oppositePiece = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN; // B
    
    let madeChanges = false;
    
    // Fill pattern: A B = B = A (which gives us A B B A A B when expanded)
    const positions = [
      { pos: 1, piece: oppositePiece }, // Position 1 gets B
      { pos: 3, piece: oppositePiece }, // Position 3 gets B (same as pos 1 due to =)
      { pos: 5, piece: knownPiece }     // Position 5 gets A (same as pos 3 due to =)
    ];
    
    for (const { pos, piece } of positions) {
      if (row + pos < this.size && board[row + pos][col] === PieceType.EMPTY) {
        if (this.canPlacePiece(board, row + pos, col, piece)) {
          board[row + pos][col] = piece;
          madeChanges = true;
        }
      }
    }
    
    return madeChanges;
  }

  /**
   * Applies complex patterns involving multiple constraints
   * Pattern: S _ x _ x _ _ = _ → S S M S M M M M
   * Pattern: _ = _ _ x _ x _ S → M M S M S S S
   */
  private applyMixedConstraintSequences(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check horizontal sequences
    madeChanges = this.applyHorizontalMixedSequences(board) || madeChanges;
    
    // Check vertical sequences
    madeChanges = this.applyVerticalMixedSequences(board) || madeChanges;

    return madeChanges;
  }

  /**
   * Apply horizontal mixed constraint sequences
   */
  private applyHorizontalMixedSequences(board: PieceType[][], row?: number): boolean {
    let madeChanges = false;

    const rowsToCheck = row !== undefined ? [row] : Array.from({ length: this.size }, (_, i) => i);

    for (const r of rowsToCheck) {
      // Pattern: S _ x _ x _ _ = _  (9 positions, need at least that much space)
      for (let col = 0; col <= this.size - 9; col++) {
        if (this.checkHorizontalPattern1(board, r, col)) {
          madeChanges = this.applyHorizontalPattern1(board, r, col) || madeChanges;
        }
      }

      // Pattern: _ = _ _ x _ x _ S  (9 positions, reverse pattern)
      for (let col = 0; col <= this.size - 9; col++) {
        if (this.checkHorizontalPattern2(board, r, col)) {
          madeChanges = this.applyHorizontalPattern2(board, r, col) || madeChanges;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Apply vertical mixed constraint sequences
   */
  private applyVerticalMixedSequences(board: PieceType[][], col?: number): boolean {
    let madeChanges = false;

    const colsToCheck = col !== undefined ? [col] : Array.from({ length: this.size }, (_, i) => i);

    for (const c of colsToCheck) {
      // Pattern: S _ x _ x _ _ = _  (9 positions vertical)
      for (let row = 0; row <= this.size - 9; row++) {
        if (this.checkVerticalPattern1(board, row, c)) {
          madeChanges = this.applyVerticalPattern1(board, row, c) || madeChanges;
        }
      }

      // Pattern: _ = _ _ x _ x _ S  (9 positions vertical, reverse pattern)
      for (let row = 0; row <= this.size - 9; row++) {
        if (this.checkVerticalPattern2(board, row, c)) {
          madeChanges = this.applyVerticalPattern2(board, row, c) || madeChanges;
        }
      }
    }

    return madeChanges;
  }

  /**
   * Check for horizontal pattern: S _ x _ x _ _ = _
   */
  private checkHorizontalPattern1(board: PieceType[][], row: number, col: number): boolean {
    // Pattern positions: [S] [_] [x] [_] [x] [_] [_] [=] [_]
    //                    0   1   2   3   4   5   6   7   8
    
    // Check if we have the known piece at position 0
    if (board[row][col] === PieceType.EMPTY) return false;
    
    // Check for constraints at the right positions
    if (col + 2 < this.size && this.hConstraints[row][col + 2] !== ConstraintType.DIFFERENT) return false;
    if (col + 4 < this.size && this.hConstraints[row][col + 4] !== ConstraintType.DIFFERENT) return false;
    if (col + 7 < this.size && this.hConstraints[row][col + 7] !== ConstraintType.SAME) return false;
    
    // Check that target positions are empty
    const emptyPositions = [1, 3, 5, 6, 8];
    for (const pos of emptyPositions) {
      if (col + pos < this.size && board[row][col + pos] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply horizontal pattern: S _ x _ x _ _ = _ → S S M S M M M M
   */
  private applyHorizontalPattern1(board: PieceType[][], row: number, col: number): boolean {
    const startPiece = board[row][col];
    const opposite = startPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Pattern: S S M S M M M M M
    const sequence = [startPiece, startPiece, opposite, startPiece, opposite, opposite, opposite, opposite, opposite];
    
    let madeChanges = false;
    for (let i = 1; i < sequence.length && col + i < this.size; i++) {
      if (board[row][col + i] === PieceType.EMPTY && this.canPlacePiece(board, row, col + i, sequence[i])) {
        board[row][col + i] = sequence[i];
        madeChanges = true;
      }
    }
    
    return madeChanges;
  }

  /**
   * Check for horizontal pattern: _ = _ _ x _ x _ S
   */
  private checkHorizontalPattern2(board: PieceType[][], row: number, col: number): boolean {
    // Pattern positions: [_] [=] [_] [_] [x] [_] [x] [_] [S]
    //                    0   1   2   3   4   5   6   7   8
    
    // Check if we have the known piece at position 8
    if (col + 8 >= this.size || board[row][col + 8] === PieceType.EMPTY) return false;
    
    // Check for constraints at the right positions
    if (col + 1 < this.size && this.hConstraints[row][col + 1] !== ConstraintType.SAME) return false;
    if (col + 4 < this.size && this.hConstraints[row][col + 4] !== ConstraintType.DIFFERENT) return false;
    if (col + 6 < this.size && this.hConstraints[row][col + 6] !== ConstraintType.DIFFERENT) return false;
    
    // Check that target positions are empty
    const emptyPositions = [0, 2, 3, 5, 7];
    for (const pos of emptyPositions) {
      if (col + pos < this.size && board[row][col + pos] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply horizontal pattern: _ = _ _ x _ x _ S → M M S M S S S S
   */
  private applyHorizontalPattern2(board: PieceType[][], row: number, col: number): boolean {
    const endPiece = board[row][col + 8];
    const opposite = endPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Pattern: M M M M S M S S S
    const sequence = [opposite, opposite, opposite, opposite, endPiece, opposite, endPiece, endPiece, endPiece];
    
    let madeChanges = false;
    for (let i = 0; i < sequence.length - 1 && col + i < this.size; i++) {
      if (board[row][col + i] === PieceType.EMPTY && this.canPlacePiece(board, row, col + i, sequence[i])) {
        board[row][col + i] = sequence[i];
        madeChanges = true;
      }
    }
    
    return madeChanges;
  }

  /**
   * Check for vertical pattern: S _ x _ x _ _ = _
   */
  private checkVerticalPattern1(board: PieceType[][], row: number, col: number): boolean {
    // Check if we have the known piece at position 0
    if (board[row][col] === PieceType.EMPTY) return false;
    
    // Check for constraints at the right positions
    if (row + 2 < this.size && this.vConstraints[row + 2][col] !== ConstraintType.DIFFERENT) return false;
    if (row + 4 < this.size && this.vConstraints[row + 4][col] !== ConstraintType.DIFFERENT) return false;
    if (row + 7 < this.size && this.vConstraints[row + 7][col] !== ConstraintType.SAME) return false;
    
    // Check that target positions are empty
    const emptyPositions = [1, 3, 5, 6, 8];
    for (const pos of emptyPositions) {
      if (row + pos < this.size && board[row + pos][col] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply vertical pattern: S _ x _ x _ _ = _ → S S M S M M M M
   */
  private applyVerticalPattern1(board: PieceType[][], row: number, col: number): boolean {
    const startPiece = board[row][col];
    const opposite = startPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Pattern: S S M S M M M M M
    const sequence = [startPiece, startPiece, opposite, startPiece, opposite, opposite, opposite, opposite, opposite];
    
    let madeChanges = false;
    for (let i = 1; i < sequence.length && row + i < this.size; i++) {
      if (board[row + i][col] === PieceType.EMPTY && this.canPlacePiece(board, row + i, col, sequence[i])) {
        board[row + i][col] = sequence[i];
        madeChanges = true;
      }
    }
    
    return madeChanges;
  }

  /**
   * Check for vertical pattern: _ = _ _ x _ x _ S
   */
  private checkVerticalPattern2(board: PieceType[][], row: number, col: number): boolean {
    // Check if we have the known piece at position 8
    if (row + 8 >= this.size || board[row + 8][col] === PieceType.EMPTY) return false;
    
    // Check for constraints at the right positions
    if (row + 1 < this.size && this.vConstraints[row + 1][col] !== ConstraintType.SAME) return false;
    if (row + 4 < this.size && this.vConstraints[row + 4][col] !== ConstraintType.DIFFERENT) return false;
    if (row + 6 < this.size && this.vConstraints[row + 6][col] !== ConstraintType.DIFFERENT) return false;
    
    // Check that target positions are empty
    const emptyPositions = [0, 2, 3, 5, 7];
    for (const pos of emptyPositions) {
      if (row + pos < this.size && board[row + pos][col] !== PieceType.EMPTY) return false;
    }

    return true;
  }

  /**
   * Apply vertical pattern: _ = _ _ x _ x _ S → M M M M S M S S
   */
  private applyVerticalPattern2(board: PieceType[][], row: number, col: number): boolean {
    const endPiece = board[row + 8][col];
    const opposite = endPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Pattern: M M M M S M S S S
    const sequence = [opposite, opposite, opposite, opposite, endPiece, opposite, endPiece, endPiece, endPiece];
    
    let madeChanges = false;
    for (let i = 0; i < sequence.length - 1 && row + i < this.size; i++) {
      if (board[row + i][col] === PieceType.EMPTY && this.canPlacePiece(board, row + i, col, sequence[i])) {
        board[row + i][col] = sequence[i];
        madeChanges = true;
      }
    }
    
    return madeChanges;
  }

  /**
   * Apply advanced pattern recognition
   */
  private applyAdvancedPatterns(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check for cells that can only have one valid piece
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const validPieces: PieceType[] = [];
          
          for (const piece of [PieceType.SUN, PieceType.MOON]) {
            if (this.canPlacePiece(board, row, col, piece)) {
              validPieces.push(piece);
            }
          }
          
          if (validPieces.length === 1) {
            board[row][col] = validPieces[0];
            madeChanges = true;
          }
        }
      }
    }

    return madeChanges;
  }

  /**
   * Check if a piece can be validly placed at a position
   */
  private canPlacePiece(board: PieceType[][], row: number, col: number, piece: PieceType): boolean {
    // Temporarily place piece
    const original = board[row][col];
    board[row][col] = piece;
    
    const valid = this.isPlacementValid(board, row, col);
    
    // Restore original
    board[row][col] = original;
    
    return valid;
  }

  /**
   * Check if a piece placement is valid
   */
  private isPlacementValid(board: PieceType[][], row: number, col: number): boolean {
    const piece = board[row][col];

    // Check balance constraints
    const rowCounts = this.countPiecesInRow(board, row);
    const colCounts = this.countPiecesInColumn(board, col);

    if (rowCounts.suns > MAX_PIECES_PER_ROW_COL || rowCounts.moons > MAX_PIECES_PER_ROW_COL ||
        colCounts.suns > MAX_PIECES_PER_ROW_COL || colCounts.moons > MAX_PIECES_PER_ROW_COL) {
      return false;
    }

    // Check consecutive rule - horizontal
    if (!this.checkConsecutiveHorizontal(board, row, col)) {
      return false;
    }

    // Check consecutive rule - vertical
    if (!this.checkConsecutiveVertical(board, row, col)) {
      return false;
    }

    // Check constraint satisfaction
    return this.checkConstraints(board, row, col);
  }

  private checkConsecutiveHorizontal(board: PieceType[][], row: number, col: number): boolean {
    const piece = board[row][col];
    
    // Check all possible 3-consecutive patterns involving this position
    for (let startCol = Math.max(0, col - 2); startCol <= Math.min(this.size - 3, col); startCol++) {
      if (startCol + 2 < this.size) {
        const p1 = board[row][startCol];
        const p2 = board[row][startCol + 1];
        const p3 = board[row][startCol + 2];
        
        if (p1 !== PieceType.EMPTY && p1 === p2 && p2 === p3) {
          return false;
        }
      }
    }
    
    return true;
  }

  private checkConsecutiveVertical(board: PieceType[][], row: number, col: number): boolean {
    const piece = board[row][col];
    
    // Check all possible 3-consecutive patterns involving this position
    for (let startRow = Math.max(0, row - 2); startRow <= Math.min(this.size - 3, row); startRow++) {
      if (startRow + 2 < this.size) {
        const p1 = board[startRow][col];
        const p2 = board[startRow + 1][col];
        const p3 = board[startRow + 2][col];
        
        if (p1 !== PieceType.EMPTY && p1 === p2 && p2 === p3) {
          return false;
        }
      }
    }
    
    return true;
  }

  private checkConstraints(board: PieceType[][], row: number, col: number): boolean {
    const piece = board[row][col];

    // Check horizontal constraints
    if (col > 0 && this.hConstraints[row][col - 1] !== ConstraintType.NONE) {
      const leftPiece = board[row][col - 1];
      if (leftPiece !== PieceType.EMPTY) {
        const constraint = this.hConstraints[row][col - 1];
        if (constraint === ConstraintType.SAME && leftPiece !== piece) return false;
        if (constraint === ConstraintType.DIFFERENT && leftPiece === piece) return false;
      }
    }

    if (col < this.size - 1 && this.hConstraints[row][col] !== ConstraintType.NONE) {
      const rightPiece = board[row][col + 1];
      if (rightPiece !== PieceType.EMPTY) {
        const constraint = this.hConstraints[row][col];
        if (constraint === ConstraintType.SAME && piece !== rightPiece) return false;
        if (constraint === ConstraintType.DIFFERENT && piece === rightPiece) return false;
      }
    }

    // Check vertical constraints
    if (row > 0 && this.vConstraints[row - 1][col] !== ConstraintType.NONE) {
      const topPiece = board[row - 1][col];
      if (topPiece !== PieceType.EMPTY) {
        const constraint = this.vConstraints[row - 1][col];
        if (constraint === ConstraintType.SAME && topPiece !== piece) return false;
        if (constraint === ConstraintType.DIFFERENT && topPiece === piece) return false;
      }
    }

    if (row < this.size - 1 && this.vConstraints[row][col] !== ConstraintType.NONE) {
      const bottomPiece = board[row + 1][col];
      if (bottomPiece !== PieceType.EMPTY) {
        const constraint = this.vConstraints[row][col];
        if (constraint === ConstraintType.SAME && piece !== bottomPiece) return false;
        if (constraint === ConstraintType.DIFFERENT && piece === bottomPiece) return false;
      }
    }

    return true;
  }

  private countPiecesInRow(board: PieceType[][], row: number): {suns: number; moons: number; empty: number} {
    let suns = 0, moons = 0, empty = 0;
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
      else empty++;
    }
    return {suns, moons, empty};
  }

  private countPiecesInColumn(board: PieceType[][], col: number): {suns: number; moons: number; empty: number} {
    let suns = 0, moons = 0, empty = 0;
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
      else empty++;
    }
    return {suns, moons, empty};
  }

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

  private orderPiecesByLikelihood(board: PieceType[][], row: number, col: number): PieceType[] {
    // Simple heuristic: try the piece that maintains better balance first
    const rowCounts = this.countPiecesInRow(board, row);
    const colCounts = this.countPiecesInColumn(board, col);
    
    const sunImbalance = Math.abs((rowCounts.suns + colCounts.suns) - (rowCounts.moons + colCounts.moons + 1));
    const moonImbalance = Math.abs((rowCounts.suns + colCounts.suns + 1) - (rowCounts.moons + colCounts.moons));
    
    if (sunImbalance < moonImbalance) {
      return [PieceType.MOON, PieceType.SUN];
    } else {
      return [PieceType.SUN, PieceType.MOON];
    }
  }

  private isBoardStateValid(board: PieceType[][]): boolean {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] !== PieceType.EMPTY) {
          if (!this.isPlacementValid(board, row, col)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  private isCompleteAndValid(board: PieceType[][]): boolean {
    // Check all positions are filled
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          return false;
        }
      }
    }

    // Check balance rule (3 suns and 3 moons per row/column)
    for (let row = 0; row < this.size; row++) {
      const counts = this.countPiecesInRow(board, row);
      if (counts.suns !== MAX_PIECES_PER_ROW_COL || counts.moons !== MAX_PIECES_PER_ROW_COL) {
        return false;
      }
    }

    for (let col = 0; col < this.size; col++) {
      const counts = this.countPiecesInColumn(board, col);
      if (counts.suns !== MAX_PIECES_PER_ROW_COL || counts.moons !== MAX_PIECES_PER_ROW_COL) {
        return false;
      }
    }

    // Check no more than 2 consecutive pieces
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 2; col++) {
        if (board[row][col] === board[row][col + 1] && 
            board[row][col + 1] === board[row][col + 2]) {
          return false;
        }
      }
    }

    for (let row = 0; row < this.size - 2; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === board[row + 1][col] && 
            board[row + 1][col] === board[row + 2][col]) {
          return false;
        }
      }
    }

    // Check all constraints are satisfied
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (this.hConstraints[row][col] !== ConstraintType.NONE) {
          const left = board[row][col];
          const right = board[row][col + 1];
          if (this.hConstraints[row][col] === ConstraintType.SAME && left !== right) {
            return false;
          }
          if (this.hConstraints[row][col] === ConstraintType.DIFFERENT && left === right) {
            return false;
          }
        }
      }
    }

    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.vConstraints[row][col] !== ConstraintType.NONE) {
          const top = board[row][col];
          const bottom = board[row + 1][col];
          if (this.vConstraints[row][col] === ConstraintType.SAME && top !== bottom) {
            return false;
          }
          if (this.vConstraints[row][col] === ConstraintType.DIFFERENT && top === bottom) {
            return false;
          }
        }
      }
    }

    return true;
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

    // Check for advanced balance rule with constraint inference
    const advancedBalanceMove = this.checkAdvancedBalanceMove(board, row, col);
    if (advancedBalanceMove) return advancedBalanceMove;

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
      if (this.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Two ${existing}s are already consecutive in row ${row + 1} at positions (${row + 1}, ${col - 1}) and (${row + 1}, ${col}). To prevent three consecutive ${existing}s (which violates the game rules), position (${row + 1}, ${col + 1}) must be ${required}.`,
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
      if (this.canPlacePiece(board, row, col, required)) {
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
      if (this.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `There are ${existing}s on both sides of this position in row ${row + 1}. To prevent three consecutive pieces (which violates the game rules), this position must be ${required}.`,
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
      if (this.canPlacePiece(board, row, col, required)) {
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
      if (this.canPlacePiece(board, row, col, required)) {
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
      if (this.canPlacePiece(board, row, col, required)) {
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
          
          if (this.canPlacePiece(board, row, col, required)) {
            const direction = adj.dr === 0 ? (adj.dc === -1 ? 'left' : 'right') : (adj.dr === -1 ? 'above' : 'below');
            const adjacentPos = adj.dr === 0 ? 
              `(${row + 1}, ${col + adj.dc + 1})` : 
              `(${row + adj.dr + 1}, ${col + 1})`;
            return {
              row, col,
              piece: required,
              reasoning: `The '${symbol}' constraint between positions (${row + 1}, ${col + 1}) and ${adjacentPos} requires this position to have the ${constraintName} piece as the ${adjPiece} ${direction} it. Therefore, place ${required} here.`,
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
    
    const rowCounts = this.countPiecesInRow(board, row);
    const colCounts = this.countPiecesInColumn(board, col);

    // If row already has 3 of one type, remaining must be other type
    if (rowCounts.suns === MAX_PIECES_PER_ROW_COL) {
      if (this.canPlacePiece(board, row, col, PieceType.MOON)) {
        return {
          row, col,
          piece: PieceType.MOON,
          reasoning: `Row ${row + 1} already has the maximum of 3 suns (at ${this.getSunPositionsInRow(board, row).join(', ')}). The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be moon.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
    } else if (rowCounts.moons === MAX_PIECES_PER_ROW_COL) {
      if (this.canPlacePiece(board, row, col, PieceType.SUN)) {
        return {
          row, col,
          piece: PieceType.SUN,
          reasoning: `Row ${row + 1} already has the maximum of 3 moons (at ${this.getMoonPositionsInRow(board, row).join(', ')}). The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be sun.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
    }

    // If column already has 3 of one type, remaining must be other type
    if (colCounts.suns === MAX_PIECES_PER_ROW_COL) {
      if (this.canPlacePiece(board, row, col, PieceType.MOON)) {
        return {
          row, col,
          piece: PieceType.MOON,
          reasoning: `Column ${col + 1} already has the maximum of 3 suns (at ${this.getSunPositionsInCol(board, col).join(', ')}). The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be moon.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
    } else if (colCounts.moons === MAX_PIECES_PER_ROW_COL) {
      if (this.canPlacePiece(board, row, col, PieceType.SUN)) {
        return {
          row, col,
          piece: PieceType.SUN,
          reasoning: `Column ${col + 1} already has the maximum of 3 moons (at ${this.getMoonPositionsInCol(board, col).join(', ')}). The game rule requires equal numbers of each piece, so position (${row + 1}, ${col + 1}) must be sun.`,
          confidence: 95,
          moveType: 'balance'
        };
      }
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
    
    const counts = this.countPiecesInRow(board, row);
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
          
          if (neededSuns > neededMoons && this.canPlacePiece(board, row, col, PieceType.SUN)) {
            return {
              row, col,
              piece: PieceType.SUN,
              reasoning: `Row ${row + 1} has 3 filled tiles and 3 empty tiles. There's an 'x' constraint between positions ${pos1 + 1} and ${pos2 + 1}, which limits their placement options. To satisfy the balance rule (3 suns, 3 moons), position (${row + 1}, ${col + 1}) must be sun.`,
              confidence: 90,
              moveType: 'balance'
            };
          } else if (neededMoons > neededSuns && this.canPlacePiece(board, row, col, PieceType.MOON)) {
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
    
    const counts = this.countPiecesInColumn(board, col);
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
          
          if (neededSuns > neededMoons && this.canPlacePiece(board, row, col, PieceType.SUN)) {
            return {
              row, col,
              piece: PieceType.SUN,
              reasoning: `Column ${col + 1} has 3 filled tiles and 3 empty tiles. There's an 'x' constraint between positions ${pos1 + 1} and ${pos2 + 1}, which limits their placement options. To satisfy the balance rule (3 suns, 3 moons), position (${row + 1}, ${col + 1}) must be sun.`,
              confidence: 90,
              moveType: 'balance'
            };
          } else if (neededMoons > neededSuns && this.canPlacePiece(board, row, col, PieceType.MOON)) {
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
      if (this.canPlacePiece(board, row, col, piece)) {
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
    const rowCounts = this.countPiecesInRow(board, row);
    const colCounts = this.countPiecesInColumn(board, col);
    
    if (piece === PieceType.SUN && rowCounts.suns > MAX_PIECES_PER_ROW_COL) {
      const sunPositions = this.getSunPositionsInRow(board, row);
      return `placing sun would give row ${row + 1} a total of ${rowCounts.suns} suns (currently at ${sunPositions.join(', ')}), exceeding the maximum of 3 per row`;
    }
    if (piece === PieceType.MOON && rowCounts.moons > MAX_PIECES_PER_ROW_COL) {
      const moonPositions = this.getMoonPositionsInRow(board, row);
      return `placing moon would give row ${row + 1} a total of ${rowCounts.moons} moons (currently at ${moonPositions.join(', ')}), exceeding the maximum of 3 per row`;
    }
    if (piece === PieceType.SUN && colCounts.suns > MAX_PIECES_PER_ROW_COL) {
      const sunPositions = this.getSunPositionsInCol(board, col);
      return `placing sun would give column ${col + 1} a total of ${colCounts.suns} suns (currently at ${sunPositions.join(', ')}), exceeding the maximum of 3 per column`;
    }
    if (piece === PieceType.MOON && colCounts.moons > MAX_PIECES_PER_ROW_COL) {
      const moonPositions = this.getMoonPositionsInCol(board, col);
      return `placing moon would give column ${col + 1} a total of ${colCounts.moons} moons (currently at ${moonPositions.join(', ')}), exceeding the maximum of 3 per column`;
    }

    return null;
  }

  private getConstraintViolationDetail(board: PieceType[][], row: number, col: number): string | null {
    const currentPiece = board[row][col];
    
    // Check horizontal constraints
    if (col > 0 && row < this.hConstraints.length && col - 1 < this.hConstraints[row].length) {
      const leftConstraint = this.hConstraints[row][col - 1];
      const leftPiece = board[row][col - 1];
      
      if (leftConstraint === ConstraintType.SAME && leftPiece !== PieceType.EMPTY && currentPiece !== leftPiece) {
        return `placing ${currentPiece} would violate the '=' constraint between positions (${row + 1}, ${col}) and (${row + 1}, ${col + 1}) requiring it to match the ${leftPiece} to its left`;
      }
      if (leftConstraint === ConstraintType.DIFFERENT && leftPiece !== PieceType.EMPTY && currentPiece === leftPiece) {
        return `placing ${currentPiece} would violate the '×' constraint between positions (${row + 1}, ${col}) and (${row + 1}, ${col + 1}) requiring it to be different from the ${leftPiece} to its left`;
      }
    }
    
    if (col < this.size - 1 && row < this.hConstraints.length && col < this.hConstraints[row].length) {
      const rightConstraint = this.hConstraints[row][col];
      const rightPiece = board[row][col + 1];
      
      if (rightConstraint === ConstraintType.SAME && rightPiece !== PieceType.EMPTY && currentPiece !== rightPiece) {
        return `placing ${currentPiece} would violate the '=' constraint between positions (${row + 1}, ${col + 1}) and (${row + 1}, ${col + 2}) requiring it to match the ${rightPiece} to its right`;
      }
      if (rightConstraint === ConstraintType.DIFFERENT && rightPiece !== PieceType.EMPTY && currentPiece === rightPiece) {
        return `placing ${currentPiece} would violate the '×' constraint between positions (${row + 1}, ${col + 1}) and (${row + 1}, ${col + 2}) requiring it to be different from the ${rightPiece} to its right`;
      }
    }
    
    // Check vertical constraints
    if (row > 0 && row - 1 < this.vConstraints.length && col < this.vConstraints[row - 1].length) {
      const topConstraint = this.vConstraints[row - 1][col];
      const topPiece = board[row - 1][col];
      
      if (topConstraint === ConstraintType.SAME && topPiece !== PieceType.EMPTY && currentPiece !== topPiece) {
        return `placing ${currentPiece} would violate the '=' constraint between positions (${row}, ${col + 1}) and (${row + 1}, ${col + 1}) requiring it to match the ${topPiece} above it`;
      }
      if (topConstraint === ConstraintType.DIFFERENT && topPiece !== PieceType.EMPTY && currentPiece === topPiece) {
        return `placing ${currentPiece} would violate the '×' constraint between positions (${row}, ${col + 1}) and (${row + 1}, ${col + 1}) requiring it to be different from the ${topPiece} above it`;
      }
    }
    
    if (row < this.size - 1 && row < this.vConstraints.length && col < this.vConstraints[row].length) {
      const bottomConstraint = this.vConstraints[row][col];
      const bottomPiece = board[row + 1][col];
      
      if (bottomConstraint === ConstraintType.SAME && bottomPiece !== PieceType.EMPTY && currentPiece !== bottomPiece) {
        return `placing ${currentPiece} would violate the '=' constraint between positions (${row + 1}, ${col + 1}) and (${row + 2}, ${col + 1}) requiring it to match the ${bottomPiece} below it`;
      }
      if (bottomConstraint === ConstraintType.DIFFERENT && bottomPiece !== PieceType.EMPTY && currentPiece === bottomPiece) {
        return `placing ${currentPiece} would violate the '×' constraint between positions (${row + 1}, ${col + 1}) and (${row + 2}, ${col + 1}) requiring it to be different from the ${bottomPiece} below it`;
      }
    }
    
    return null;
  }

  /**
   * Get positions of suns in a specific row for detailed explanations
   */
  private getSunPositionsInRow(board: PieceType[][], row: number): string[] {
    const positions: string[] = [];
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.SUN) {
        positions.push(`(${row + 1}, ${col + 1})`);
      }
    }
    return positions;
  }

  /**
   * Get positions of moons in a specific row for detailed explanations
   */
  private getMoonPositionsInRow(board: PieceType[][], row: number): string[] {
    const positions: string[] = [];
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.MOON) {
        positions.push(`(${row + 1}, ${col + 1})`);
      }
    }
    return positions;
  }

  /**
   * Get positions of suns in a specific column for detailed explanations
   */
  private getSunPositionsInCol(board: PieceType[][], col: number): string[] {
    const positions: string[] = [];
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.SUN) {
        positions.push(`(${row + 1}, ${col + 1})`);
      }
    }
    return positions;
  }

  /**
   * Get positions of moons in a specific column for detailed explanations
   */
  private getMoonPositionsInCol(board: PieceType[][], col: number): string[] {
    const positions: string[] = [];
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.MOON) {
        positions.push(`(${row + 1}, ${col + 1})`);
      }
    }
    return positions;
  }

}
