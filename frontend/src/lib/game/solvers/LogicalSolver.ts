import { BOARD_SIZE, ConstraintType, PieceType } from '../types';

import { BoardValidator } from '../validators/BoardValidator';

export interface LogicalMove {
  row: number;
  col: number;
  piece: PieceType;
  reason: string;
}

export class LogicalSolver {
  private validator: BoardValidator;

  constructor(private readonly size: number = BOARD_SIZE) {
    this.validator = new BoardValidator(size);
  }
  
  /**
   * Finds all logical moves for the current board state
   * Returns a list of all moves that can be deduced from the current board
   */
  findAllLogicalMoves(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): LogicalMove[] {
    // Combine moves from all logical deduction methods
    const moves = [
      ...this.findConsecutiveMoves(board),
      ...this.findConstraintMoves(board, hConstraints, vConstraints),
      ...this.findBalanceMoves(board),
      ...this.findUniqueRowsColumnsMoves(board),
      ...this.findNakedPairsMoves(board),
      ...this.findAdvancedPatternMoves(board, hConstraints, vConstraints),
      ...this.findForcedMoves(board, hConstraints, vConstraints)
    ];
    
    return moves;
  }
  
  /**
   * Solves a puzzle using only basic techniques (consecutive patterns and constraints)
   * Used to check if a puzzle requires advanced techniques
   */
  solveWithBasicTechniques(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    let madeProgress = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (madeProgress && iterations < maxIterations) {
      madeProgress = false;
      iterations++;
      
      // Only use basic techniques - intentionally excluding advanced patterns,
      // naked singles, unique rows/columns, and naked pairs techniques
      const moves = [
        ...this.findConsecutiveMoves(board),
        ...this.findConstraintMoves(board, hConstraints, vConstraints)
      ];
      
      for (const move of moves) {
        if (board[move.row][move.col] === PieceType.EMPTY) {
          board[move.row][move.col] = move.piece;
          madeProgress = true;
        }
      }
    }
    
    return this.validator.isBoardComplete(board);
  }

  canSolveLogically(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    expectedSolution: PieceType[][],
    difficulty?: string
  ): boolean {
    const workingBoard = this.copyBoard(board);
    
    if (this.solveWithLogicalDeduction(workingBoard, hConstraints, vConstraints, difficulty)) {
      return this.validator.boardsMatch(workingBoard, expectedSolution);
    }
    
    return false;
  }

  private solveWithLogicalDeduction(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    difficulty?: string
  ): boolean {
    let madeProgress = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (madeProgress && iterations < maxIterations) {
      madeProgress = false;
      iterations++;
      
      const moves = [
        ...this.findConsecutiveMoves(board),
        ...this.findConstraintMoves(board, hConstraints, vConstraints),
        ...this.findBalanceMoves(board),
        ...this.findUniqueRowsColumnsMoves(board),
        ...this.findNakedPairsMoves(board),
        ...this.findAdvancedPatternMoves(board, hConstraints, vConstraints),
        ...this.findForcedMoves(board, hConstraints, vConstraints)
      ];
      
      // Sort moves by reliability
      const sortedMoves = this.sortMovesByReliability(moves, difficulty);
      
      for (const move of sortedMoves) {
        if (board[move.row][move.col] === PieceType.EMPTY) {
          board[move.row][move.col] = move.piece;
          madeProgress = true;
        }
      }
    }
    
    return this.validator.isBoardComplete(board);
  }

  private findConsecutiveMoves(board: PieceType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const piece = this.getConsecutiveMove(board, row, col);
          if (piece) {
            moves.push({
              row, col, piece,
              reason: 'Prevent three consecutive pieces'
            });
          }
        }
      }
    }
    
    return moves;
  }

  private getConsecutiveMove(board: PieceType[][], row: number, col: number): PieceType | null {
    // Check horizontal patterns
    const horizontalPiece = this.checkPatterns(board, row, col, [
      [[0, -1], [0, -2]], // XX_
      [[0, 1], [0, 2]],   // _XX
      [[0, -1], [0, 1]]   // X_X
    ]);
    
    if (horizontalPiece) return horizontalPiece;
    
    // Check vertical patterns
    return this.checkPatterns(board, row, col, [
      [[-1, 0], [-2, 0]], // XX_ (vertical)
      [[1, 0], [2, 0]],   // _XX (vertical)
      [[-1, 0], [1, 0]]   // X_X (vertical)
    ]);
  }

  private checkPatterns(
    board: PieceType[][],
    row: number,
    col: number,
    patterns: number[][][]
  ): PieceType | null {
    for (const pattern of patterns) {
      const [[dr1, dc1], [dr2, dc2]] = pattern;
      const r1 = row + dr1, c1 = col + dc1;
      const r2 = row + dr2, c2 = col + dc2;
      
      if (
        this.validator.isValidPosition(r1, c1) &&
        this.validator.isValidPosition(r2, c2) &&
        board[r1][c1] !== PieceType.EMPTY &&
        board[r1][c1] === board[r2][c2]
      ) {
        return board[r1][c1] === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      }
    }
    return null;
  }

  private findConstraintMoves(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): LogicalMove[] {
    const moves: LogicalMove[] = [];
    
    // Check horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        const constraint = hConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const move = this.getConstraintMove(
            board, row, col, row, col + 1, constraint, 'horizontal'
          );
          if (move) moves.push(move);
        }
      }
    }
    
    // Check vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        const constraint = vConstraints[row][col];
        if (constraint !== ConstraintType.NONE) {
          const move = this.getConstraintMove(
            board, row, col, row + 1, col, constraint, 'vertical'
          );
          if (move) moves.push(move);
        }
      }
    }
    
    return moves;
  }

  private getConstraintMove(
    board: PieceType[][],
    r1: number, c1: number,
    r2: number, c2: number,
    constraint: ConstraintType,
    direction: 'horizontal' | 'vertical'
  ): LogicalMove | null {
    const piece1 = board[r1][c1];
    const piece2 = board[r2][c2];
    
    if (piece1 !== PieceType.EMPTY && piece2 === PieceType.EMPTY) {
      const required = constraint === ConstraintType.SAME 
        ? piece1 
        : (piece1 === PieceType.SUN ? PieceType.MOON : PieceType.SUN);
      
      return {
        row: r2, col: c2, piece: required,
        reason: `${constraint} constraint with ${direction} neighbor`
      };
    }
    
    if (piece1 === PieceType.EMPTY && piece2 !== PieceType.EMPTY) {
      const required = constraint === ConstraintType.SAME 
        ? piece2 
        : (piece2 === PieceType.SUN ? PieceType.MOON : PieceType.SUN);
      
      return {
        row: r1, col: c1, piece: required,
        reason: `${constraint} constraint with ${direction} neighbor`
      };
    }
    
    return null;
  }

  private findBalanceMoves(board: PieceType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    const maxAllowed = this.size / 2;
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const rowCounts = this.validator.countPiecesInRow(board, row);
          const colCounts = this.validator.countPiecesInCol(board, col);
          
          if (rowCounts.suns === maxAllowed) {
            moves.push({
              row, col, piece: PieceType.MOON,
              reason: 'Row balance: maximum suns reached'
            });
            continue;
          }
          
          if (rowCounts.moons === maxAllowed) {
            moves.push({
              row, col, piece: PieceType.SUN,
              reason: 'Row balance: maximum moons reached'
            });
            continue;
          }
          
          if (colCounts.suns === maxAllowed) {
            moves.push({
              row, col, piece: PieceType.MOON,
              reason: 'Column balance: maximum suns reached'
            });
            continue;
          }
          
          if (colCounts.moons === maxAllowed) {
            moves.push({
              row, col, piece: PieceType.SUN,
              reason: 'Column balance: maximum moons reached'
            });
          }
        }
      }
    }
    
    return moves;
  }

  private findForcedMoves(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): LogicalMove[] {
    const moves: LogicalMove[] = [];
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const validPieces = [PieceType.SUN, PieceType.MOON].filter(piece =>
            this.isValidPlacementWithConstraints(board, row, col, piece, hConstraints, vConstraints)
          );
          
          if (validPieces.length === 1) {
            moves.push({
              row, col, piece: validPieces[0],
              reason: 'Only valid option due to constraints'
            });
          }
        }
      }
    }
    
    return moves;
  }

  private isValidPlacementWithConstraints(
    board: PieceType[][],
    row: number,
    col: number,
    piece: PieceType,
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    const original = board[row][col];
    board[row][col] = piece;
    
    const isValid = 
      this.validator.validatePlacement(board, row, col, piece) &&
      this.checkSymbolConstraints(board, row, col, hConstraints, vConstraints);
    
    board[row][col] = original;
    return isValid;
  }

  private checkSymbolConstraints(
    board: PieceType[][],
    row: number,
    col: number,
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): boolean {
    const piece = board[row][col];
    
    // Check horizontal constraints
    if (!this.checkConstraintDirection(board, row, col, piece, hConstraints, 'horizontal')) {
      return false;
    }
    
    // Check vertical constraints
    return this.checkConstraintDirection(board, row, col, piece, vConstraints, 'vertical');
  }

  private checkConstraintDirection(
    board: PieceType[][],
    row: number,
    col: number,
    piece: PieceType,
    constraints: ConstraintType[][],
    direction: 'horizontal' | 'vertical'
  ): boolean {
    // Check left/up constraint
    const [dr1, dc1] = direction === 'horizontal' ? [0, -1] : [-1, 0];
    if (this.validator.isValidPosition(row + dr1, col + dc1)) {
      const constraintRow = direction === 'horizontal' ? row : row + dr1;
      const constraintCol = direction === 'horizontal' ? col + dc1 : col;
      
      if (
        constraints[constraintRow] &&
        constraints[constraintRow][constraintCol] !== ConstraintType.NONE
      ) {
        const constraint = constraints[constraintRow][constraintCol];
        const otherPiece = board[row + dr1][col + dc1];
        
        if (otherPiece !== PieceType.EMPTY) {
          if (constraint === ConstraintType.SAME && piece !== otherPiece) return false;
          if (constraint === ConstraintType.DIFFERENT && piece === otherPiece) return false;
        }
      }
    }
    
    // Check right/down constraint
    const [dr2, dc2] = direction === 'horizontal' ? [0, 1] : [1, 0];
    if (this.validator.isValidPosition(row + dr2, col + dc2)) {
      const constraintRow = row;
      const constraintCol = col;
      
      if (
        constraints[constraintRow] &&
        constraints[constraintRow][constraintCol] !== ConstraintType.NONE
      ) {
        const constraint = constraints[constraintRow][constraintCol];
        const otherPiece = board[row + dr2][col + dc2];
        
        if (otherPiece !== PieceType.EMPTY) {
          if (constraint === ConstraintType.SAME && piece !== otherPiece) return false;
          if (constraint === ConstraintType.DIFFERENT && piece === otherPiece) return false;
        }
      }
    }
    
    return true;
  }

  private copyBoard(board: PieceType[][]): PieceType[][] {
    return board.map(row => [...row]);
  }

  /**
   * Sorts moves by reliability/priority
   */
  private sortMovesByReliability(moves: LogicalMove[], difficultyLevel?: string): LogicalMove[] {
    // Assign priorities based on the reliability of each deduction technique
    const getPriority = (move: LogicalMove): number => {
      // Standard priorities for all difficulties
      if (move.reason.includes('consecutive')) return 9; // Most reliable
      if (move.reason.includes('constraint')) return 8;
      if (move.reason.includes('balance')) return 5;
      if (move.reason.includes('uniqueness')) return 4;
      if (move.reason.includes('Advanced pattern')) return 3;
      if (move.reason.includes('constraint: all possible')) return 6;
      return 7; // Forced moves (most complex calculation)
    };
    
    return [...moves].sort((a, b) => getPriority(a) - getPriority(b));
  }

  /**
   * Finds moves based on unique rows/columns constraints
   */
  private findUniqueRowsColumnsMoves(board: PieceType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    
    // Check for nearly identical rows
    for (let row1 = 0; row1 < this.size; row1++) {
      for (let row2 = row1 + 1; row2 < this.size; row2++) {
        const differences = this.findDifferences(board, row1, row2, 'row');
        
        // If only one or two cells differ between rows and one is known
        if (differences.length === 2) {
          const [diff1, diff2] = differences;
          
          // If exactly one of the differences is filled
          if ((board[row1][diff1.col] !== PieceType.EMPTY && board[row2][diff2.col] === PieceType.EMPTY) ||
              (board[row1][diff1.col] === PieceType.EMPTY && board[row2][diff2.col] !== PieceType.EMPTY)) {
            
            const knownRow = board[row1][diff1.col] !== PieceType.EMPTY ? row1 : row2;
            const knownCol = board[row1][diff1.col] !== PieceType.EMPTY ? diff1.col : diff2.col;
            const emptyRow = knownRow === row1 ? row2 : row1;
            const emptyCol = knownCol === diff1.col ? diff2.col : diff1.col;
            
            // The empty cell must be different from the known cell to maintain uniqueness
            const oppositeValue = board[knownRow][knownCol] === PieceType.SUN ? 
                                 PieceType.MOON : PieceType.SUN;
            
            moves.push({
              row: emptyRow,
              col: emptyCol,
              piece: oppositeValue,
              reason: `Row uniqueness: rows ${row1} and ${row2} must differ`
            });
          }
        }
      }
    }
    
    // Similar logic for columns
    for (let col1 = 0; col1 < this.size; col1++) {
      for (let col2 = col1 + 1; col2 < this.size; col2++) {
        const differences = this.findDifferences(board, col1, col2, 'column');
        
        // If only one or two cells differ between columns and one is known
        if (differences.length === 2) {
          const [diff1, diff2] = differences;
          
          // If exactly one of the differences is filled
          if ((board[diff1.row][col1] !== PieceType.EMPTY && board[diff2.row][col2] === PieceType.EMPTY) ||
              (board[diff1.row][col1] === PieceType.EMPTY && board[diff2.row][col2] !== PieceType.EMPTY)) {
            
            const knownCol = board[diff1.row][col1] !== PieceType.EMPTY ? col1 : col2;
            const knownRow = board[diff1.row][col1] !== PieceType.EMPTY ? diff1.row : diff2.row;
            const emptyCol = knownCol === col1 ? col2 : col1;
            const emptyRow = knownRow === diff1.row ? diff2.row : diff1.row;
            
            // The empty cell must be different from the known cell to maintain uniqueness
            const oppositeValue = board[knownRow][knownCol] === PieceType.SUN ? 
                                 PieceType.MOON : PieceType.SUN;
            
            moves.push({
              row: emptyRow,
              col: emptyCol,
              piece: oppositeValue,
              reason: `Column uniqueness: columns ${col1} and ${col2} must differ`
            });
          }
        }
      }
    }
    
    return moves;
  }

  /**
   * Finds differing positions between two rows or columns
   */
  private findDifferences(
    board: PieceType[][], 
    index1: number, 
    index2: number, 
    type: 'row' | 'column'
  ): Array<{row: number, col: number}> {
    const differences: Array<{row: number, col: number}> = [];
    
    if (type === 'row') {
      for (let col = 0; col < this.size; col++) {
        if (board[index1][col] !== board[index2][col] || 
            board[index1][col] === PieceType.EMPTY || 
            board[index2][col] === PieceType.EMPTY) {
          differences.push({row: index1, col}, {row: index2, col});
        }
      }
    } else {
      for (let row = 0; row < this.size; row++) {
        if (board[row][index1] !== board[row][index2] || 
            board[row][index1] === PieceType.EMPTY || 
            board[row][index2] === PieceType.EMPTY) {
          differences.push({row, col: index1}, {row, col: index2});
        }
      }
    }
    
    return differences;
  }

  /**
   * Finds moves based on naked pairs/triples technique
   */
  private findNakedPairsMoves(board: PieceType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    
    // For each row, track which cells can accept which pieces
    for (let row = 0; row < this.size; row++) {
      const emptyCells: Array<{col: number, validPieces: PieceType[]}> = [];
      
      // Find all empty cells and determine valid pieces for each
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          const validPieces = [PieceType.SUN, PieceType.MOON].filter(piece => 
            this.validator.validatePlacement(board, row, col, piece)
          );
          emptyCells.push({col, validPieces});
        }
      }
      
      // Look for naked pairs (cells that can only accept the same 2 values)
      // In Binairo this is simplified since there are only 2 possible values total
      const maxSuns = this.countValidPiecesInRow(emptyCells, PieceType.SUN);
      const maxMoons = this.countValidPiecesInRow(emptyCells, PieceType.MOON);
      
      // If number of cells that can accept SUNs equals number of remaining SUNs needed
      if (maxSuns === this.size / 2 - this.validator.countPiecesInRow(board, row).suns) {
        // All cells that can accept SUNs must be SUNs
        for (const cell of emptyCells) {
          if (cell.validPieces.includes(PieceType.SUN)) {
            moves.push({
              row,
              col: cell.col,
              piece: PieceType.SUN,
              reason: 'Row constraint: all possible SUN cells must be SUNs'
            });
          }
        }
      }
      
      // Similar logic for MOONs
      if (maxMoons === this.size / 2 - this.validator.countPiecesInRow(board, row).moons) {
        for (const cell of emptyCells) {
          if (cell.validPieces.includes(PieceType.MOON)) {
            moves.push({
              row,
              col: cell.col,
              piece: PieceType.MOON,
              reason: 'Row constraint: all possible MOON cells must be MOONs'
            });
          }
        }
      }
    }
    
    // Similar logic for columns
    for (let col = 0; col < this.size; col++) {
      const emptyCells: Array<{row: number, validPieces: PieceType[]}> = [];
      
      // Find all empty cells and determine valid pieces for each
      for (let row = 0; row < this.size; row++) {
        if (board[row][col] === PieceType.EMPTY) {
          const validPieces = [PieceType.SUN, PieceType.MOON].filter(piece => 
            this.validator.validatePlacement(board, row, col, piece)
          );
          emptyCells.push({row, validPieces});
        }
      }
      
      // Same logic as for rows but for columns
      const maxSuns = this.countValidPiecesInColumn(emptyCells, PieceType.SUN);
      const maxMoons = this.countValidPiecesInColumn(emptyCells, PieceType.MOON);
      
      if (maxSuns === this.size / 2 - this.validator.countPiecesInCol(board, col).suns) {
        for (const cell of emptyCells) {
          if (cell.validPieces.includes(PieceType.SUN)) {
            moves.push({
              row: cell.row,
              col,
              piece: PieceType.SUN,
              reason: 'Column constraint: all possible SUN cells must be SUNs'
            });
          }
        }
      }
      
      if (maxMoons === this.size / 2 - this.validator.countPiecesInCol(board, col).moons) {
        for (const cell of emptyCells) {
          if (cell.validPieces.includes(PieceType.MOON)) {
            moves.push({
              row: cell.row,
              col,
              piece: PieceType.MOON,
              reason: 'Column constraint: all possible MOON cells must be MOONs'
            });
          }
        }
      }
    }
    
    return moves;
  }

  /**
   * Counts how many cells in a row can accept a specific piece
   */
  private countValidPiecesInRow(
    emptyCells: Array<{col: number, validPieces: PieceType[]}>,
    piece: PieceType
  ): number {
    return emptyCells.filter(cell => cell.validPieces.includes(piece)).length;
  }

  /**
   * Counts how many cells in a column can accept a specific piece
   */
  private countValidPiecesInColumn(
    emptyCells: Array<{row: number, validPieces: PieceType[]}>,
    piece: PieceType
  ): number {
    return emptyCells.filter(cell => cell.validPieces.includes(piece)).length;
  }

  /**
   * Finds moves based on advanced pattern recognition
   * This includes patterns that require looking at multiple constraints together
   */
  private findAdvancedPatternMoves(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): LogicalMove[] {
    const moves: LogicalMove[] = [];
    
    // Find naked single pattern
    moves.push(...this.findNakedSinglePatterns(board, hConstraints, vConstraints));

    // Find double constraint patterns
    moves.push(...this.findDoubleConstraintPatterns(board, hConstraints, vConstraints));
    
    return moves;
  }

  /*
  * Finds moves based on analyzing naked single patterns
  * Specifically looks for pattern A A B _ _ _ and _ _ _ B A A
  * If found, it will place the missing piece resulting in
  * A A B _ _ B or B _ _ B A A
  */
  private findNakedSinglePatterns(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): LogicalMove[] {
    const moves: LogicalMove[] = [];

    // Check each row for naked single patterns
    for (let row = 0; row < this.size; row++) {
      const rowValues = board[row];

      // Look for pattern A A B _ _ _
      for (let col = 0; col < this.size - 5; col++) {
        // Check for A A B _ _ _
        if (col >= 2 && 
            rowValues[col - 2] !== PieceType.EMPTY && 
            rowValues[col - 2] === rowValues[col - 1] && 
            rowValues[col] !== PieceType.EMPTY && 
            rowValues[col] !== rowValues[col - 1] &&
            rowValues[col + 1] === PieceType.EMPTY && 
            rowValues[col + 2] === PieceType.EMPTY) {
          // The missing piece at col+3 must be the same as at col
          moves.push({
            row,
            col: col + 3,
            piece: rowValues[col],
            reason: 'Advanced pattern: Naked Single (A A B _ _ _)'
          });
        }

        // Check for _ _ _ B A A
        if (col + 5 < this.size && 
            rowValues[col] === PieceType.EMPTY && 
            rowValues[col + 1] === PieceType.EMPTY && 
            rowValues[col + 2] !== PieceType.EMPTY && 
            rowValues[col + 3] !== PieceType.EMPTY && 
            rowValues[col + 3] === rowValues[col + 4] && 
            rowValues[col + 2] !== rowValues[col + 3]) {
          // The missing piece at col must be the same as at col+2
          moves.push({
            row,
            col,
            piece: rowValues[col + 2],
            reason: 'Advanced pattern: Naked Single (_ _ _ B A A)'
          });
        }
      }
    }

    // now vertically
    for (let col = 0; col < this.size; col++) {
      const colValues = board.map(row => row[col]);

      // Look for patterns in columns
      for (let row = 0; row < this.size - 5; row++) {
        // Check for A A B _ _ _ (vertical)
        if (row >= 2 && 
            colValues[row - 2] !== PieceType.EMPTY && 
            colValues[row - 2] === colValues[row - 1] && 
            colValues[row] !== PieceType.EMPTY && 
            colValues[row] !== colValues[row - 1] &&
            colValues[row + 1] === PieceType.EMPTY && 
            colValues[row + 2] === PieceType.EMPTY) {
          // The missing piece at row+3 must be the same as at row
          moves.push({
            row: row + 3,
            col,
            piece: colValues[row],
            reason: 'Advanced pattern: Naked Single (A A B _ _ _ vertical)'
          });
        }

        // Check for _ _ _ B A A (vertical)
        if (row + 5 < this.size && 
            colValues[row] === PieceType.EMPTY && 
            colValues[row + 1] === PieceType.EMPTY && 
            colValues[row + 2] !== PieceType.EMPTY && 
            colValues[row + 3] !== PieceType.EMPTY && 
            colValues[row + 3] === colValues[row + 4] && 
            colValues[row + 2] !== colValues[row + 3]) {
          // The missing piece at row must be the same as at row+2
          moves.push({
            row,
            col,
            piece: colValues[row + 2],
            reason: 'Advanced pattern: Naked Single (_ _ _ B A A vertical)'
          });
        }
      }
    }

    return moves;
  }

  /**
   * Finds moves based on analyzing double constraint patterns
   * Each row or column should have:
   * 1. Exactly 1 filled piece
   * 2. Exactly 2 constraints (affecting 4 cells)
   * 3. The filled piece must not be in one of the constrained cells
   */
  private findDoubleConstraintPatterns(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): LogicalMove[] {
    const moves: LogicalMove[] = [];
    
    // Check each row for the pattern
    for (let row = 0; row < this.size; row++) {
      const rowValues = board[row];
      const constraintValues = hConstraints[row];
      
      // Get filled pieces and constraints
      const filledTiles = this.getFilledPositions(rowValues);
      const filledConstraints = this.getFilledConstraints(constraintValues);
      
      // Check if the row has exactly 1 filled piece and exactly 2 constraints
      if (filledTiles.length === 1 && filledConstraints.length === 2) {
        // Get the constrained cells (4 cells affected by the 2 constraints)
        const constrainedCells = this.getConstrainedCellsHorizontal(filledConstraints);
        
        // Check if the filled piece is outside the constrained cells
        const filledPosition = filledTiles[0];
        if (!constrainedCells.has(filledPosition)) {
          // The pattern is found, determine moves for empty cells
          this.determineMovesForHorizontalPattern(
            board, row, filledPosition, constrainedCells, filledConstraints, moves
          );
        }
      }
    }
    
    // Check each column for the pattern
    for (let col = 0; col < this.size; col++) {
      const colValues = board.map(row => row[col]);
      const constraintValues = vConstraints.map(row => row[col]);
      
      // Get filled pieces and constraints
      const filledTiles = this.getFilledPositions(colValues);
      const filledConstraints = this.getFilledConstraints(constraintValues);
      
      // Check if the column has exactly 1 filled piece and exactly 2 constraints
      if (filledTiles.length === 1 && filledConstraints.length === 2) {
        // Get the constrained cells (4 cells affected by the 2 constraints)
        const constrainedCells = this.getConstrainedCellsVertical(filledConstraints);
        
        // Check if the filled piece is outside the constrained cells
        const filledPosition = filledTiles[0];
        if (!constrainedCells.has(filledPosition)) {
          // The pattern is found, determine moves for empty cells
          this.determineMovesForVerticalPattern(
            board, col, filledPosition, constrainedCells, filledConstraints, moves
          );
        }
      }
    }
    
    return moves;
  }
  
  /**
   * Gets the positions of filled (non-empty) cells in a row or column
   */
  private getFilledPositions(values: PieceType[]): number[] {
    return values
      .map((value, index) => value !== PieceType.EMPTY ? index : -1)
      .filter(index => index !== -1);
  }
  
  /**
   * Gets the positions of non-NONE constraints in a row or column
   */
  private getFilledConstraints(constraints: ConstraintType[]): number[] {
    return constraints
      .map((value, index) => value !== ConstraintType.NONE ? index : -1)
      .filter(index => index !== -1);
  }
  
  /**
   * Gets the set of cells affected by constraints in a row
   */
  private getConstrainedCellsHorizontal(constraintPositions: number[]): Set<number> {
    const cells = new Set<number>();
    constraintPositions.forEach(pos => {
      cells.add(pos);     // The column at the constraint
      cells.add(pos + 1); // The column to the right of the constraint
    });
    return cells;
  }
  
  /**
   * Gets the set of cells affected by constraints in a column
   */
  private getConstrainedCellsVertical(constraintPositions: number[]): Set<number> {
    const cells = new Set<number>();
    constraintPositions.forEach(pos => {
      cells.add(pos);     // The row at the constraint
      cells.add(pos + 1); // The row below the constraint
    });
    return cells;
  }
  
  /**
   * Determines what pieces to place in empty cells for a horizontal pattern
   */
  private determineMovesForHorizontalPattern(
    board: PieceType[][],
    row: number,
    filledPosition: number,
    constrainedCells: Set<number>,
    constraintPositions: number[],
    moves: LogicalMove[]
  ): void {
    const filledPiece = board[row][filledPosition];
    const oppositePiece = filledPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Get the types of the two constraints
    const constraint1 = board[row][constraintPositions[0]];
    const constraint2 = board[row][constraintPositions[1]];
    
    // Get cells that are constrained but empty
    const emptyConstrainedCells = Array.from(constrainedCells)
      .filter(col => board[row][col] === PieceType.EMPTY);
    
    // The constraint types determine which piece to place
    for (const col of emptyConstrainedCells) {
      // In the special pattern we're looking for, we always place the opposite piece
      // in the constrained cells if they're empty
      moves.push({
        row,
        col,
        piece: oppositePiece,
        reason: 'Advanced pattern: double constraint horizontal'
      });
    }
  }
  
  /**
   * Determines what pieces to place in empty cells for a vertical pattern
   */
  private determineMovesForVerticalPattern(
    board: PieceType[][],
    col: number,
    filledPosition: number,
    constrainedCells: Set<number>,
    constraintPositions: number[],
    moves: LogicalMove[]
  ): void {
    const filledPiece = board[filledPosition][col];
    const oppositePiece = filledPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Get the types of the two constraints
    const constraint1 = board[constraintPositions[0]][col];
    const constraint2 = board[constraintPositions[1]][col];
    
    // Get cells that are constrained but empty
    const emptyConstrainedCells = Array.from(constrainedCells)
      .filter(row => board[row][col] === PieceType.EMPTY);
    
    // The constraint types determine which piece to place
    for (const row of emptyConstrainedCells) {
      // In the special pattern we're looking for, we always place the opposite piece
      // in the constrained cells if they're empty
      moves.push({
        row,
        col,
        piece: oppositePiece,
        reason: 'Advanced pattern: double constraint vertical'
      });
    }
  }

  /**
   * Determines a safe piece to place that won't create three in a row
   */
  private determineSafePiece(
    board: PieceType[][],
    row: number,
    col: number,
    direction: 'horizontal' | 'vertical'
  ): PieceType | null {
    // Try sun first
    if (!this.wouldCreateThreeInARow(board, row, col, PieceType.SUN)) {
      return PieceType.SUN;
    }
    
    // Try moon if sun would create three in a row
    if (!this.wouldCreateThreeInARow(board, row, col, PieceType.MOON)) {
      return PieceType.MOON;
    }
    
    // If both would create three in a row, return null
    return null;
  }

  /**
   * Checks if a piece would create three in a row
   * This is a utility method used by various pattern finding algorithms
   */
  
  /**
   * Checks if placing a piece would create three in a row
   */
  private wouldCreateThreeInARow(
    board: PieceType[][],
    row: number,
    col: number,
    piece: PieceType
  ): boolean {
    // Temporarily place the piece
    const original = board[row][col];
    board[row][col] = piece;
    
    // Check if this creates three in a row
    const hasViolation = !this.validator.checkConsecutiveAt(board, row, col, 'horizontal') || 
                         !this.validator.checkConsecutiveAt(board, row, col, 'vertical');
    
    // Restore original value
    board[row][col] = original;
    
    return hasViolation;
  }
}