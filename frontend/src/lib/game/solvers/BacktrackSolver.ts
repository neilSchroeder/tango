import { 
  PieceType, 
  ConstraintType, 
  BOARD_SIZE, 
  MAX_PIECES_PER_ROW_COL,
  type HintResult 
} from '../types';

import { 
  BaseSolver, 
  type VariableDomain,
  type ConstraintNetwork,
  type Assignment,
  type ConflictClause,
  type Literal,
  type DomainState
} from './BaseSolver';

export class BacktrackSolver extends BaseSolver {
    private visitedStates: Set<string> = new Set();
    private maxDepth: number = 100;

    /**
     * Solve the puzzle using backtracking with domain-based constraint propagation
     */
    findAllSolutions(maxSolutions: number = 10): PieceType[][][] {
        const startTime = Date.now();
        const timeout = 2000; // 2 second timeout
        
        return this.findAllSolutionsDomain(maxSolutions, startTime, timeout);
    }

    /**
     * Get a hint for the next logical move
     */
    getHint(): HintResult {
        const domainState = this.createDomainState();
        
        // Apply constraint propagation to find forced moves
        if (!this.propagateConstraintsDomain(domainState)) {
            return {
                found: false,
                reasoning: "No valid solution possible",
                hintType: 'none'
            };
        }

        // Find the first position with only one possible value
        for (const [varKey, domain] of domainState.domains) {
            if (!domain.isLocked && domain.possibleValues.size === 1) {
                const [row, col] = varKey.split(',').map(Number);
                const piece = Array.from(domain.possibleValues)[0];
                
                return {
                    found: true,
                    row,
                    col,
                    pieceType: piece,
                    reasoning: this.generateHintReasoning(domainState, varKey, piece),
                    confidence: 95,
                    hintType: 'logical_deduction',
                    educationalValue: 'high'
                };
            }
        }

        // No forced moves found
        return {
            found: false,
            reasoning: "No logical moves found. Try exploring different possibilities.",
            hintType: 'strategic_guidance'
        };
    }

    /**
     * Domain-based solution finding with backtracking
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

        return this.findSolutionsWithBacktracking(domainState, maxSolutions, startTime, timeout);
    }

    /**
     * Get unassigned variables from domain state
     */
    private getUnassignedVariablesDomain(domainState: DomainState): string[] {
        const unassigned: string[] = [];
        
        for (const [key, domain] of domainState.domains) {
            if (!domain.isLocked && domain.possibleValues.size > 1) {
                unassigned.push(key);
            }
        }
        
        // Sort by domain size (most constrained first)
        unassigned.sort((a, b) => {
            const domainA = domainState.domains.get(a)!;
            const domainB = domainState.domains.get(b)!;
            return domainA.possibleValues.size - domainB.possibleValues.size;
        });
        
        return unassigned;
    }

    /**
     * Check if board is complete from domain state
     */
    private isBoardCompleteFromDomain(domainState: DomainState): boolean {
        for (const [key, domain] of domainState.domains) {
            if (!domain.isLocked && domain.possibleValues.size !== 1) {
                return false;
            }
        }
        return true;
    }

    /**
     * Backup domain state for backtracking
     */
    private backupDomainState(domainState: DomainState): Map<string, Set<PieceType>> {
        const backup = new Map<string, Set<PieceType>>();
        
        for (const [key, domain] of domainState.domains) {
            backup.set(key, new Set(domain.possibleValues));
        }
        
        return backup;
    }

    /**
     * Restore domain state from backup
     */
    private restoreDomainState(domainState: DomainState, backup: Map<string, Set<PieceType>>): void {
        for (const [key, values] of backup) {
            const domain = domainState.domains.get(key);
            if (domain) {
                domain.possibleValues = new Set(values);
            }
        }
    }

    /**
     * Create initial board with only locked pieces
     */
    private createInitialBoard(): PieceType[][] {
        const board: PieceType[][] = Array(this.size).fill(null).map(() => 
            Array(this.size).fill(PieceType.EMPTY)
        );

        // Copy locked pieces
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
     * Apply constraint propagation to fill in forced moves
     */
    private applyConstraintPropagation(board: PieceType[][]): boolean {
        // Convert board to domain state and use domain-based propagation
        const domainState = this.createDomainState();
        
        // Update domain state with current board
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                const key = `${row},${col}`;
                const domain = domainState.domains.get(key);
                if (domain && board[row][col] !== PieceType.EMPTY) {
                    domain.possibleValues = new Set([board[row][col]]);
                }
            }
        }
        
        const success = this.propagateConstraintsDomain(domainState);
        
        // Apply changes back to board
        if (success) {
            for (const [key, domain] of domainState.domains) {
                if (domain.possibleValues.size === 1) {
                    const [row, col] = key.split(',').map(Number);
                    const piece = Array.from(domain.possibleValues)[0];
                    if (board[row][col] === PieceType.EMPTY) {
                        board[row][col] = piece;
                    }
                }
            }
        }
        
        return success;
    }

    /**
     * Find empty positions on the board
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
     * Count valid piece options for a position
     */
    private countValidPieces(board: PieceType[][], row: number, col: number): number {
        let count = 0;
        if (this.canPlacePiece(board, row, col, PieceType.SUN)) count++;
        if (this.canPlacePiece(board, row, col, PieceType.MOON)) count++;
        return count;
    }

    /**
     * Check if board is complete and valid
     */
    private isCompleteAndValid(board: PieceType[][]): boolean {
        // Check if board is complete
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if (board[row][col] === PieceType.EMPTY) {
                    return false;
                }
            }
        }

        // Check if board is valid
        return this.isBoardValid(board);
    }

    /**
     * Order pieces by likelihood to reduce backtracking
     */
    private orderPiecesByLikelihood(board: PieceType[][], row: number, col: number): PieceType[] {
        const pieces: PieceType[] = [];
        
        // Add valid pieces, prioritizing based on row/column balance
        const rowCounts = this.countPiecesInRow(board, row);
        const colCounts = this.countPiecesInColumn(board, col);
        
        const sunDeficit = MAX_PIECES_PER_ROW_COL - rowCounts.suns + MAX_PIECES_PER_ROW_COL - colCounts.suns;
        const moonDeficit = MAX_PIECES_PER_ROW_COL - rowCounts.moons + MAX_PIECES_PER_ROW_COL - colCounts.moons;
        
        if (sunDeficit >= moonDeficit) {
            if (this.canPlacePiece(board, row, col, PieceType.SUN)) pieces.push(PieceType.SUN);
            if (this.canPlacePiece(board, row, col, PieceType.MOON)) pieces.push(PieceType.MOON);
        } else {
            if (this.canPlacePiece(board, row, col, PieceType.MOON)) pieces.push(PieceType.MOON);
            if (this.canPlacePiece(board, row, col, PieceType.SUN)) pieces.push(PieceType.SUN);
        }
        
        return pieces;
    }

    /**
     * Check if a piece can be placed at a position
     */
    private canPlacePiece(board: PieceType[][], row: number, col: number, piece: PieceType): boolean {
        if (board[row][col] !== PieceType.EMPTY) {
            return false;
        }

        // Temporarily place the piece
        board[row][col] = piece;
        
        const valid = this.isPositionValid(board, row, col);
        
        // Remove the piece
        board[row][col] = PieceType.EMPTY;
        
        return valid;
    }

    /**
     * Check if position is valid after placement
     */
    private isPositionValid(board: PieceType[][], row: number, col: number): boolean {
        // Check consecutive constraints
        if (!this.checkConsecutiveHorizontal(board, row, col) || 
            !this.checkConsecutiveVertical(board, row, col)) {
            return false;
        }
        
        // Check direct constraints
        if (!this.checkDirectConstraints(board, row, col)) {
            return false;
        }
        
        // Check balance constraints
        const rowCounts = this.countPiecesInRow(board, row);
        const colCounts = this.countPiecesInColumn(board, col);
        
        if (rowCounts.suns > MAX_PIECES_PER_ROW_COL || rowCounts.moons > MAX_PIECES_PER_ROW_COL ||
            colCounts.suns > MAX_PIECES_PER_ROW_COL || colCounts.moons > MAX_PIECES_PER_ROW_COL) {
            return false;
        }
        
        return true;
    }

    /**
     * Apply incremental constraint propagation
     */
    private applyIncrementalPropagation(board: PieceType[][], changedRow: number, changedCol: number): {
        success: boolean;
        changes: Array<{row: number, col: number, oldValue: PieceType, newValue: PieceType}>;
    } {
        // For now, just return success without changes
        // This could be optimized to only propagate constraints affecting the changed position
        return { success: true, changes: [] };
    }

    /**
     * Restore changes from incremental propagation
     */
    private restorePropagationChanges(
        board: PieceType[][], 
        changes: Array<{row: number, col: number, oldValue: PieceType, newValue: PieceType}>
    ): void {
        for (const change of changes) {
            board[change.row][change.col] = change.oldValue;
        }
    }

    /**
     * Check if board is valid according to all constraints
     */
    private isBoardValid(board: PieceType[][]): boolean {
        // Check consecutive constraints
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if (!this.checkConsecutiveHorizontal(board, row, col) || 
                    !this.checkConsecutiveVertical(board, row, col)) {
                    return false;
                }
            }
        }

        // Check direct constraints
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if (!this.checkDirectConstraints(board, row, col)) {
                    return false;
                }
            }
        }

        // Check balance constraints
        for (let row = 0; row < this.size; row++) {
            const rowCounts = this.countPiecesInRow(board, row);
            if (rowCounts.suns !== MAX_PIECES_PER_ROW_COL || rowCounts.moons !== MAX_PIECES_PER_ROW_COL) {
                return false;
            }
        }

        for (let col = 0; col < this.size; col++) {
            const colCounts = this.countPiecesInColumn(board, col);
            if (colCounts.suns !== MAX_PIECES_PER_ROW_COL || colCounts.moons !== MAX_PIECES_PER_ROW_COL) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check horizontal consecutive constraint at position
     */
    private checkConsecutiveHorizontal(board: PieceType[][], row: number, col: number): boolean {
        const piece = board[row][col];
        if (piece === PieceType.EMPTY) return true;

        // Check if this position creates 3 in a row horizontally
        for (let startCol = Math.max(0, col - 2); startCol <= Math.min(this.size - 3, col); startCol++) {
            if (startCol <= col && col <= startCol + 2) {
                let count = 0;
                for (let c = startCol; c < startCol + 3; c++) {
                    if (board[row][c] === piece) count++;
                }
                if (count === 3) return false;
            }
        }

        return true;
    }

    /**
     * Check vertical consecutive constraint at position
     */
    private checkConsecutiveVertical(board: PieceType[][], row: number, col: number): boolean {
        const piece = board[row][col];
        if (piece === PieceType.EMPTY) return true;

        // Check if this position creates 3 in a row vertically
        for (let startRow = Math.max(0, row - 2); startRow <= Math.min(this.size - 3, row); startRow++) {
            if (startRow <= row && row <= startRow + 2) {
                let count = 0;
                for (let r = startRow; r < startRow + 3; r++) {
                    if (board[r][col] === piece) count++;
                }
                if (count === 3) return false;
            }
        }

        return true;
    }

    /**
     * Check direct constraints (SAME/DIFFERENT) at position
     */
    private checkDirectConstraints(board: PieceType[][], row: number, col: number): boolean {
        const piece = board[row][col];
        if (piece === PieceType.EMPTY) return true;

        // Check horizontal constraints
        if (col > 0 && this.hConstraints[row][col - 1] !== ConstraintType.NONE) {
            const leftPiece = board[row][col - 1];
            const constraint = this.hConstraints[row][col - 1];
            
            if (leftPiece !== PieceType.EMPTY) {
                if (constraint === ConstraintType.SAME && piece !== leftPiece) return false;
                if (constraint === ConstraintType.DIFFERENT && piece === leftPiece) return false;
            }
        }

        if (col < this.size - 1 && this.hConstraints[row][col] !== ConstraintType.NONE) {
            const rightPiece = board[row][col + 1];
            const constraint = this.hConstraints[row][col];
            
            if (rightPiece !== PieceType.EMPTY) {
                if (constraint === ConstraintType.SAME && piece !== rightPiece) return false;
                if (constraint === ConstraintType.DIFFERENT && piece === rightPiece) return false;
            }
        }

        // Check vertical constraints
        if (row > 0 && this.vConstraints[row - 1][col] !== ConstraintType.NONE) {
            const topPiece = board[row - 1][col];
            const constraint = this.vConstraints[row - 1][col];
            
            if (topPiece !== PieceType.EMPTY) {
                if (constraint === ConstraintType.SAME && piece !== topPiece) return false;
                if (constraint === ConstraintType.DIFFERENT && piece === topPiece) return false;
            }
        }

        if (row < this.size - 1 && this.vConstraints[row][col] !== ConstraintType.NONE) {
            const bottomPiece = board[row + 1][col];
            const constraint = this.vConstraints[row][col];
            
            if (bottomPiece !== PieceType.EMPTY) {
                if (constraint === ConstraintType.SAME && piece !== bottomPiece) return false;
                if (constraint === ConstraintType.DIFFERENT && piece === bottomPiece) return false;
            }
        }

        return true;
    }

    /**
     * Count pieces in a row
     */
    private countPiecesInRow(board: PieceType[][], row: number): { suns: number; moons: number; empty: number } {
        let suns = 0;
        let moons = 0;
        let empty = 0;

        for (let col = 0; col < this.size; col++) {
            const piece = board[row][col];
            if (piece === PieceType.SUN) suns++;
            else if (piece === PieceType.MOON) moons++;
            else empty++;
        }

        return { suns, moons, empty };
    }

    /**
     * Count pieces in a column
     */
    private countPiecesInColumn(board: PieceType[][], col: number): { suns: number; moons: number; empty: number } {
        let suns = 0;
        let moons = 0;
        let empty = 0;

        for (let row = 0; row < this.size; row++) {
            const piece = board[row][col];
            if (piece === PieceType.SUN) suns++;
            else if (piece === PieceType.MOON) moons++;
            else empty++;
        }

        return { suns, moons, empty };
    }
    /**
     * Traditional backtracking-based solution finding (fallback when CDCL is disabled)
     */
    private findSolutionsWithBacktracking(
    domainState: DomainState, 
    maxSolutions: number,
    startTime: number = Date.now(),
    timeout: number = 2000
    ): PieceType[][][] {
    const solutions: PieceType[][][] = [];

    // Find unassigned variables
    const unassignedVars = this.getUnassignedVariablesDomain(domainState);
    
    // Use traditional backtracking
    const backtrack = (varIndex: number): void => {
        // Check for timeout
        if (Date.now() - startTime > timeout) {
        console.warn('Timeout during backtracking solution finding');
        return;
        }
        
        if (solutions.length >= maxSolutions) {
        return;
        }

        if (varIndex === unassignedVars.length) {
        // All variables assigned - check if solution is complete
        const board = this.domainStateToBoard(domainState);
        if (this.isBoardCompleteFromDomain(domainState)) {
            solutions.push(board);
        }
        return;
        }

        const varKey = unassignedVars[varIndex];
        const domain = domainState.domains.get(varKey);
        
        if (!domain || domain.isLocked) {
        backtrack(varIndex + 1);
        return;
        }

        // Try each possible value in domain
        const possibleValues = Array.from(domain.possibleValues);
        
        for (const value of possibleValues) {
        // Create backup of domain state
        const domainBackup = this.backupDomainState(domainState);
        
        // Assign value
        domain.possibleValues = new Set([value]);
        
        // Propagate constraints
        if (this.propagateConstraintsDomain(domainState)) {
            backtrack(varIndex + 1);
        }
        
        // Restore domain state
        this.restoreDomainState(domainState, domainBackup);
        }
    };

    backtrack(0);
    return solutions;
    }
    
      /**
       * Original board-based solution finding (fallback)
       */
      private discoverAllSolutionsWithBacktracking(
        maxSolutions: number = 10,
        startTime: number = Date.now(),
        timeout: number = 2000
      ): PieceType[][][] {
        const solutions: PieceType[][][] = [];
    
        // Create initial board with only locked pieces
        const board = this.createInitialBoard();
        
        // Apply constraint propagation first
        const propagated = this.applyConstraintPropagation(board);
        if (!propagated) {
          return solutions; // No valid solution possible
        }
    
        // Check for timeout
        if (Date.now() - startTime > timeout) {
          console.warn('Timeout during constraint propagation in original solver');
          return solutions;
        }
    
        // Use backtracking for remaining empty cells
        const remainingEmpty = this.findEmptyPositions(board);
        
        // Pre-sort positions by most constrained (fewer valid options) for better pruning
        remainingEmpty.sort((a, b) => {
          const [rowA, colA] = a;
          const [rowB, colB] = b;
          const optionsA = this.countValidPieces(board, rowA, colA);
          const optionsB = this.countValidPieces(board, rowB, colB);
          return optionsA - optionsB;
        });
        
        const backtrack = (pos: number): void => {
          // Check for timeout less frequently for better performance
          if (pos % 5 === 0 && Date.now() - startTime > timeout) {
            console.warn('Timeout during backtracking in original solver');
            return;
          }
          
          if (solutions.length >= maxSolutions) {
            return;
          }
    
          if (pos === remainingEmpty.length) {
            if (this.isCompleteAndValid(board)) {
              const solution = board.map(row => [...row]);
              solutions.push(solution);
            }
            return;
          }
    
          const [row, col] = remainingEmpty[pos];
    
          // Try pieces in order of likelihood based on current constraints
          const orderedPieces = this.orderPiecesByLikelihood(board, row, col);
    
          for (const piece of orderedPieces) {
            if (this.canPlacePiece(board, row, col, piece)) {
              board[row][col] = piece;
              
              // Early validation check - if this placement creates obvious conflicts, skip
              if (!this.isPositionValid(board, row, col)) {
                board[row][col] = PieceType.EMPTY;
                continue;
              }
              
              // Apply incremental constraint propagation instead of full board copy
              const propagationResult = this.applyIncrementalPropagation(board, row, col);
              
              if (propagationResult.success) {
                backtrack(pos + 1);
                
                // Restore changes made by incremental propagation
                this.restorePropagationChanges(board, propagationResult.changes);
              }
    
              board[row][col] = PieceType.EMPTY;
            }
          }
        };
    
        backtrack(0);
        return solutions;
      }
}