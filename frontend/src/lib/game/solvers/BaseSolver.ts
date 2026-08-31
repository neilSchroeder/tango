import { 
  PieceType, 
  ConstraintType, 
  BOARD_SIZE, 
  MAX_PIECES_PER_ROW_COL,
  type HintResult 
} from '../types';

/**
 * Shared interfaces for constraint-based solving
 */
export interface VariableDomain {
  position: [number, number];
  possibleValues: Set<PieceType>;
  isLocked: boolean;
  decisionLevel?: number;
  reason?: ConflictClause;
}

export interface ConstraintNetwork {
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
  learnedClauses: ConflictClause[];
}

export interface Assignment {
  variable: string;
  value: PieceType;
  decisionLevel: number;
  isDecision: boolean;
  reason?: ConflictClause;
}

export interface ConflictClause {
  literals: Literal[];
  learnedAt: number;
  activity: number;
}

export interface Literal {
  variable: string;
  value: PieceType;
  negated: boolean;
}

export interface DomainState {
  domains: Map<string, VariableDomain>;
  constraints: ConstraintNetwork;
  decisionLevel: number;
  assignments: Assignment[];
}

/**
 * Base class for Tango puzzle solvers with shared domain-based constraint solving functionality
 */
export abstract class BaseSolver {
  protected originalBoard: PieceType[][];
  protected hConstraints: ConstraintType[][];
  protected vConstraints: ConstraintType[][];
  protected lockedTiles: boolean[][];
  protected size = BOARD_SIZE;
  protected emptyPositions: [number, number][];
  
  protected constraintNetwork: ConstraintNetwork;
  protected initialDomains: Map<string, VariableDomain>;

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
        if (board[row][col] === PieceType.EMPTY && !lockedTiles[row][col]) {
          this.emptyPositions.push([row, col]);
        }
      }
    }

    this.constraintNetwork = this.buildConstraintNetwork();
    this.initialDomains = this.initializeDomains();
  }

  /**
   * Build constraint network for domain-based solving
   */
  protected buildConstraintNetwork(): ConstraintNetwork {
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
      for (let startCol = 0; startCol <= this.size - 3; startCol++) {
        consecutiveConstraints.push({
          positions: [
            [row, startCol],
            [row, startCol + 1],
            [row, startCol + 2]
          ],
          direction: 'horizontal'
        });
      }
    }

    // Vertical consecutive constraints
    for (let row = 0; row <= this.size - 3; row++) {
      for (let col = 0; col < this.size; col++) {
        consecutiveConstraints.push({
          positions: [
            [row, col],
            [row + 1, col],
            [row + 2, col]
          ],
          direction: 'vertical'
        });
      }
    }

    return {
      directConstraints,
      balanceConstraints,
      consecutiveConstraints,
      learnedClauses: []
    };
  }

  /**
   * Initialize domains for all variables
   */
  protected initializeDomains(): Map<string, VariableDomain> {
    const domains = new Map<string, VariableDomain>();

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const position: [number, number] = [row, col];
        const key = `${row},${col}`;
        const piece = this.originalBoard[row][col];
        const isLocked = this.lockedTiles[row][col] || piece !== PieceType.EMPTY;

        const possibleValues = new Set<PieceType>();
        
        if (isLocked) {
          // Locked tiles keep their current value
          if (piece !== PieceType.EMPTY) {
            possibleValues.add(piece);
          }
        } else {
          // Empty tiles can be either SUN or MOON initially
          possibleValues.add(PieceType.SUN);
          possibleValues.add(PieceType.MOON);
        }

        domains.set(key, {
          position,
          possibleValues,
          isLocked,
          decisionLevel: 0,
          reason: undefined
        });
      }
    }

    return domains;
  }

  /**
   * Create domain state for solving
   */
  protected createDomainState(): DomainState {
    const domains = new Map<string, VariableDomain>();
    for (const [key, domain] of this.initialDomains) {
      domains.set(key, {
        position: domain.position,
        possibleValues: new Set(domain.possibleValues),
        isLocked: domain.isLocked,
        decisionLevel: domain.decisionLevel,
        reason: domain.reason
      });
    }

    return {
      domains,
      constraints: this.constraintNetwork,
      decisionLevel: 0,
      assignments: []
    };
  }

  /**
   * Convert domain state back to board representation
   */
  protected domainStateToBoard(domainState: DomainState): PieceType[][] {
    const board: PieceType[][] = Array(this.size).fill(null).map(() => 
      Array(this.size).fill(PieceType.EMPTY)
    );

    for (const [key, domain] of domainState.domains) {
      const [row, col] = domain.position;
      
      if (domain.possibleValues.size === 1) {
        board[row][col] = Array.from(domain.possibleValues)[0];
      } else if (domain.isLocked) {
        board[row][col] = this.originalBoard[row][col];
      } else {
        board[row][col] = PieceType.EMPTY;
      }
    }

    return board;
  }

  /**
   * Domain-based constraint propagation
   */
  protected propagateConstraintsDomain(domainState: DomainState): boolean {
    let changed = true;
    let iterations = 0;
    const maxIterations = 20;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      if (this.propagateDirectConstraintsDomain(domainState)) {
        changed = true;
      }

      if (this.propagateBalanceConstraintsDomain(domainState)) {
        changed = true;
      }

      if (this.propagateConsecutiveConstraintsDomain(domainState)) {
        changed = true;
      }

      // Check for empty domains (conflicts)
      for (const [key, domain] of domainState.domains) {
        if (!domain.isLocked && domain.possibleValues.size === 0) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Propagate direct constraints in domain space
   */
  protected propagateDirectConstraintsDomain(domainState: DomainState): boolean {
    let changed = false;

    for (const constraint of domainState.constraints.directConstraints) {
      const pos1Key = `${constraint.pos1[0]},${constraint.pos1[1]}`;
      const pos2Key = `${constraint.pos2[0]},${constraint.pos2[1]}`;
      
      const domain1 = domainState.domains.get(pos1Key);
      const domain2 = domainState.domains.get(pos2Key);
      
      if (!domain1 || !domain2) continue;

      if (constraint.type === ConstraintType.SAME) {
        if (domain1.possibleValues.size === 1 && domain2.possibleValues.size > 1) {
          const value = Array.from(domain1.possibleValues)[0];
          if (domain2.possibleValues.has(value)) {
            domain2.possibleValues = new Set([value]);
            changed = true;
          } else if (!domain2.isLocked) {
            domain2.possibleValues.clear();
            return false;
          }
        } else if (domain2.possibleValues.size === 1 && domain1.possibleValues.size > 1) {
          const value = Array.from(domain2.possibleValues)[0];
          if (domain1.possibleValues.has(value)) {
            domain1.possibleValues = new Set([value]);
            changed = true;
          } else if (!domain1.isLocked) {
            domain1.possibleValues.clear();
            return false;
          }
        }
      } else if (constraint.type === ConstraintType.DIFFERENT) {
        if (domain1.possibleValues.size === 1 && domain2.possibleValues.size > 1) {
          const value = Array.from(domain1.possibleValues)[0];
          if (domain2.possibleValues.has(value)) {
            domain2.possibleValues.delete(value);
            changed = true;
          }
        } else if (domain2.possibleValues.size === 1 && domain1.possibleValues.size > 1) {
          const value = Array.from(domain2.possibleValues)[0];
          if (domain1.possibleValues.has(value)) {
            domain1.possibleValues.delete(value);
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  /**
   * Propagate balance constraints in domain space
   */
  protected propagateBalanceConstraintsDomain(domainState: DomainState): boolean {
    let changed = false;

    for (const balanceConstraint of domainState.constraints.balanceConstraints) {
      if (balanceConstraint.type === 'row') {
        if (this.propagateRowBalanceDomain(domainState, balanceConstraint.index)) {
          changed = true;
        }
      } else {
        if (this.propagateColumnBalanceDomain(domainState, balanceConstraint.index)) {
          changed = true;
        }
      }
    }

    return changed;
  }

  /**
   * Propagate row balance constraint in domain space
   */
  protected propagateRowBalanceDomain(domainState: DomainState, row: number): boolean {
    let changed = false;
    let sunCount = 0;
    let moonCount = 0;
    const unassigned: string[] = [];

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
  protected propagateColumnBalanceDomain(domainState: DomainState, col: number): boolean {
    let changed = false;
    let sunCount = 0;
    let moonCount = 0;
    const unassigned: string[] = [];

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
  protected propagateConsecutiveConstraintsDomain(domainState: DomainState): boolean {
    let changed = false;

    for (const consConstraint of domainState.constraints.consecutiveConstraints) {
      if (this.propagateConsecutiveSequenceDomain(domainState, consConstraint.positions)) {
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Propagate consecutive constraint for a specific sequence
   */
  protected propagateConsecutiveSequenceDomain(domainState: DomainState, positions: Array<[number, number]>): boolean {
    let changed = false;
    
    const domains = positions.map(pos => {
      const key = `${pos[0]},${pos[1]}`;
      return domainState.domains.get(key);
    }).filter(d => d !== undefined) as VariableDomain[];

    if (domains.length !== 3) return false;

    // Check for XX_ pattern - if first two are same, third must be different
    if (domains[0].possibleValues.size === 1 && domains[1].possibleValues.size === 1) {
      const val1 = Array.from(domains[0].possibleValues)[0];
      const val2 = Array.from(domains[1].possibleValues)[0];
      if (val1 === val2 && domains[2].possibleValues.has(val1)) {
        domains[2].possibleValues.delete(val1);
        changed = true;
      }
    }

    // Check for _XX pattern - if last two are same, first must be different
    if (domains[1].possibleValues.size === 1 && domains[2].possibleValues.size === 1) {
      const val1 = Array.from(domains[1].possibleValues)[0];
      const val2 = Array.from(domains[2].possibleValues)[0];
      if (val1 === val2 && domains[0].possibleValues.has(val1)) {
        domains[0].possibleValues.delete(val1);
        changed = true;
      }
    }

    // Check for X_X pattern - if first and third are same, middle must be different
    if (domains[0].possibleValues.size === 1 && domains[2].possibleValues.size === 1) {
      const val1 = Array.from(domains[0].possibleValues)[0];
      const val2 = Array.from(domains[2].possibleValues)[0];
      if (val1 === val2 && domains[1].possibleValues.has(val1)) {
        domains[1].possibleValues.delete(val1);
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Count pieces in a row from domain state
   */
  protected countPiecesInRowDomain(domainState: DomainState, row: number): { suns: number; moons: number; empty: number } {
    let suns = 0;
    let moons = 0;
    let empty = 0;

    for (let col = 0; col < this.size; col++) {
      const key = `${row},${col}`;
      const domain = domainState.domains.get(key);
      
      if (domain && domain.possibleValues.size === 1) {
        const piece = Array.from(domain.possibleValues)[0];
        if (piece === PieceType.SUN) suns++;
        else if (piece === PieceType.MOON) moons++;
      } else {
        empty++;
      }
    }

    return { suns, moons, empty };
  }

  /**
   * Count pieces in a column from domain state
   */
  protected countPiecesInColumnDomain(domainState: DomainState, col: number): { suns: number; moons: number; empty: number } {
    let suns = 0;
    let moons = 0;
    let empty = 0;

    for (let row = 0; row < this.size; row++) {
      const key = `${row},${col}`;
      const domain = domainState.domains.get(key);
      
      if (domain && domain.possibleValues.size === 1) {
        const piece = Array.from(domain.possibleValues)[0];
        if (piece === PieceType.SUN) suns++;
        else if (piece === PieceType.MOON) moons++;
      } else {
        empty++;
      }
    }

    return { suns, moons, empty };
  }

  /**
   * Generate reasoning for a hint
   */
  protected generateHintReasoning(domainState: DomainState, varKey: string, piece: PieceType): string {
    const [row, col] = varKey.split(',').map(Number);
    
    // Check for constraint-based reasoning
    for (const constraint of domainState.constraints.directConstraints) {
      const isPos1 = constraint.pos1[0] === row && constraint.pos1[1] === col;
      const isPos2 = constraint.pos2[0] === row && constraint.pos2[1] === col;
      
      if (isPos1 || isPos2) {
        const otherPos = isPos1 ? constraint.pos2 : constraint.pos1;
        const otherKey = `${otherPos[0]},${otherPos[1]}`;
        const otherDomain = domainState.domains.get(otherKey);
        
        if (otherDomain && otherDomain.possibleValues.size === 1) {
          const otherPiece = Array.from(otherDomain.possibleValues)[0];
          const symbol = constraint.type === ConstraintType.SAME ? '=' : '×';
          
          if (constraint.type === ConstraintType.SAME) {
            return `Must be ${piece === PieceType.SUN ? 'Sun' : 'Moon'} due to '${symbol}' constraint with position (${otherPos[0] + 1}, ${otherPos[1] + 1}) which is ${otherPiece === PieceType.SUN ? 'Sun' : 'Moon'}.`;
          } else {
            return `Must be ${piece === PieceType.SUN ? 'Sun' : 'Moon'} due to '${symbol}' constraint with position (${otherPos[0] + 1}, ${otherPos[1] + 1}) which is ${otherPiece === PieceType.SUN ? 'Sun' : 'Moon'}.`;
          }
        }
      }
    }

    // Check for balance-based reasoning
    const rowCounts = this.countPiecesInRowDomain(domainState, row);
    const colCounts = this.countPiecesInColumnDomain(domainState, col);
    
    if (piece === PieceType.SUN) {
      if (rowCounts.moons >= MAX_PIECES_PER_ROW_COL) {
        return `Must be Sun because row ${row + 1} already has ${rowCounts.moons} Moons.`;
      }
      if (colCounts.moons >= MAX_PIECES_PER_ROW_COL) {
        return `Must be Sun because column ${col + 1} already has ${colCounts.moons} Moons.`;
      }
    } else if (piece === PieceType.MOON) {
      if (rowCounts.suns >= MAX_PIECES_PER_ROW_COL) {
        return `Must be Moon because row ${row + 1} already has ${rowCounts.suns} Suns.`;
      }
      if (colCounts.suns >= MAX_PIECES_PER_ROW_COL) {
        return `Must be Moon because column ${col + 1} already has ${colCounts.suns} Suns.`;
      }
    }

    return `Only possible value based on constraint propagation.`;
  }

  // Abstract methods that must be implemented by subclasses
  abstract findAllSolutions(maxSolutions?: number): PieceType[][][];
  abstract getHint(): HintResult;
}
