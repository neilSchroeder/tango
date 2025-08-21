import { PieceType, ConstraintType } from '../types';
const MAX_PIECES_PER_ROW_COL = 3;

export interface PatternMove {
  row: number;
  col: number;
  piece: PieceType;
  reasoning: string;
  confidence: number;
  moveType: string;
}

export class PatternID {
  private size: number;
  private hConstraints: ConstraintType[][];
  private vConstraints: ConstraintType[][];

  constructor(size: number, hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]) {
    this.size = size;
    this.hConstraints = hConstraints;
    this.vConstraints = vConstraints;
  }

  /**
   * Check for advanced constraint pattern moves (for hints)
   */
  checkConstraintPatternMove(board: PieceType[][], row: number, col: number): PatternMove | null {
    
    // Check for equal constraint patterns: X _ = _ Y
    const equalPatternMove = this.checkEqualConstraintPattern(board, row, col);
    if (equalPatternMove) return equalPatternMove;
    
    // Check for two X constraint patterns: A _x_ _x_ _
    const twoXPatternMove = this.checkTwoXConstraintPattern(board, row, col);
    if (twoXPatternMove) return twoXPatternMove;
    
    // Check for Double equals patterns: A _=_ _=_ _
    const DoubleEqualsMove = this.checkDoubleEqualsPattern(board, row, col);
    if (DoubleEqualsMove) return DoubleEqualsMove;
    
    return null;
  }

  /**
   * Check for equal constraint patterns: X _ = _ Y
   */
  private checkEqualConstraintPattern(board: PieceType[][], row: number, col: number): PatternMove | null {
    
    // Check horizontal pattern: X _ = _ Y
    if (row >= 0 && row < this.size && col >= 1 && col <= this.size - 3) {
      // Check if this position is the first empty in the pattern
      if (board[row][col] === PieceType.EMPTY &&
          board[row][col + 1] === PieceType.EMPTY &&
          this.hConstraints[row][col] === ConstraintType.SAME) {
        
        const leftPiece = board[row][col - 1];
        const rightPiece = board[row][col + 2];
        
        if (leftPiece !== PieceType.EMPTY && rightPiece !== PieceType.EMPTY && leftPiece === rightPiece) {
          // Both empty positions must be opposite to avoid 3 consecutive
          const required = leftPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          if (this.canPlacePiece(board, row, col, required)) {
            return {
              row, col,
              piece: required,
              reasoning: `Equal constraint pattern detected: ${leftPiece} _ = _ ${rightPiece}. Both empty positions must be ${required} to satisfy the '=' constraint and avoid three consecutive ${leftPiece}s.`,
              confidence: 95,
              moveType: 'pattern'
            };
          }
        }
      }
    }
    
    // Check vertical pattern: X _ = _ Y
    if (row >= 1 && row <= this.size - 3 && col >= 0 && col < this.size) {
      if (board[row][col] === PieceType.EMPTY &&
          board[row + 1][col] === PieceType.EMPTY &&
          this.vConstraints[row][col] === ConstraintType.SAME) {
        
        const topPiece = board[row - 1][col];
        const bottomPiece = board[row + 2][col];
        
        if (topPiece !== PieceType.EMPTY && bottomPiece !== PieceType.EMPTY && topPiece === bottomPiece) {
          const required = topPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          if (this.canPlacePiece(board, row, col, required)) {
            return {
              row, col,
              piece: required,
              reasoning: `Vertical equal constraint pattern: ${topPiece} _ = _ ${bottomPiece}. Both empty positions must be ${required} to satisfy the '=' constraint and avoid three consecutive ${topPiece}s.`,
              confidence: 95,
              moveType: 'pattern'
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Check for two X constraint patterns: If a row/column has exactly two 'x' constraints 
   * between pairs of empty tiles, then there's an implicit constraint on remaining tiles
   */
  private checkTwoXConstraintPattern(board: PieceType[][], row: number, col: number): PatternMove | null {
    
    // Check horizontal pattern
    if (board[row][col] === PieceType.EMPTY) {
      const horizontalMove = this.checkHorizontalTwoXPattern(board, row, col);
      if (horizontalMove) return horizontalMove;
    }
    
    // Check vertical pattern
    if (board[row][col] === PieceType.EMPTY) {
      const verticalMove = this.checkVerticalTwoXPattern(board, row, col);
      if (verticalMove) return verticalMove;
    }
    
    return null;
  }

  /**
   * Check horizontal two X constraint pattern
   */
  private checkHorizontalTwoXPattern(board: PieceType[][], row: number, col: number): PatternMove | null {
    // Count X constraints in this row and find their positions
    const xConstraints: number[] = [];
    for (let c = 0; c < this.size - 1; c++) {
      if (this.hConstraints[row][c] === ConstraintType.DIFFERENT) {
        xConstraints.push(c);
      }
    }
    
    // Must have exactly 2 X constraints
    if (xConstraints.length !== 2) return null;
    
    // Find all empty positions
    const emptyPositions: number[] = [];
    const filledPositions: { col: number; piece: PieceType }[] = [];
    
    for (let c = 0; c < this.size; c++) {
      if (board[row][c] === PieceType.EMPTY) {
        emptyPositions.push(c);
      } else {
        filledPositions.push({ col: c, piece: board[row][c] });
      }
    }
    
    // Must have exactly 2 empty positions (the current one and one other)
    if (emptyPositions.length !== 2) return null;
    
    // Find the other empty position
    const otherEmptyCol = emptyPositions.find(c => c !== col);
    if (otherEmptyCol === undefined) return null;
    
    // Check if the X constraints are between pairs of empty tiles
    // This means each X constraint should be adjacent to at least one empty position
    let validPattern = true;
    for (const xPos of xConstraints) {
      const leftEmpty = board[row][xPos] === PieceType.EMPTY;
      const rightEmpty = board[row][xPos + 1] === PieceType.EMPTY;
      if (!leftEmpty && !rightEmpty) {
        validPattern = false;
        break;
      }
    }
    
    if (!validPattern) return null;
    
    // If there's exactly one filled position, we can determine the required piece
    if (filledPositions.length === 1) {
      const filledPiece = filledPositions[0].piece;
      const required = filledPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      
      if (this.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Two X-constraint pattern: Row has exactly 2 'x' constraints between empty tiles. The remaining empty position must be ${required} to balance the ${filledPiece}.`,
          confidence: 90,
          moveType: 'pattern'
        };
      }
    }
    
    return null;
  }

  /**
   * Check vertical two X constraint pattern
   */
  private checkVerticalTwoXPattern(board: PieceType[][], row: number, col: number): PatternMove | null {
    // Count X constraints in this column and find their positions
    const xConstraints: number[] = [];
    for (let r = 0; r < this.size - 1; r++) {
      if (this.vConstraints[r][col] === ConstraintType.DIFFERENT) {
        xConstraints.push(r);
      }
    }
    
    // Must have exactly 2 X constraints
    if (xConstraints.length !== 2) return null;
    
    // Find all empty positions
    const emptyPositions: number[] = [];
    const filledPositions: { row: number; piece: PieceType }[] = [];
    
    for (let r = 0; r < this.size; r++) {
      if (board[r][col] === PieceType.EMPTY) {
        emptyPositions.push(r);
      } else {
        filledPositions.push({ row: r, piece: board[r][col] });
      }
    }
    
    // Must have exactly 2 empty positions (the current one and one other)
    if (emptyPositions.length !== 2) return null;
    
    // Find the other empty position
    const otherEmptyRow = emptyPositions.find(r => r !== row);
    if (otherEmptyRow === undefined) return null;
    
    // Check if the X constraints are between pairs of empty tiles
    let validPattern = true;
    for (const xPos of xConstraints) {
      const topEmpty = board[xPos][col] === PieceType.EMPTY;
      const bottomEmpty = board[xPos + 1][col] === PieceType.EMPTY;
      if (!topEmpty && !bottomEmpty) {
        validPattern = false;
        break;
      }
    }
    
    if (!validPattern) return null;
    
    // If there's exactly one filled position, we can determine the required piece
    if (filledPositions.length === 1) {
      const filledPiece = filledPositions[0].piece;
      const required = filledPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
      
      if (this.canPlacePiece(board, row, col, required)) {
        return {
          row, col,
          piece: required,
          reasoning: `Vertical two X-constraint pattern: Column has exactly 2 'x' constraints between empty tiles. The remaining empty position must be ${required} to balance the ${filledPiece}.`,
          confidence: 90,
          moveType: 'pattern'
        };
      }
    }
    
    return null;
  }

  /**
   * Check for Double equals patterns: If a row/column has exactly two '=' constraints
   * between pairs of tiles, then there's a specific solution pattern
   */
  private checkDoubleEqualsPattern(board: PieceType[][], row: number, col: number): PatternMove | null {
    
    // Check horizontal pattern
    if (board[row][col] === PieceType.EMPTY) {
      const horizontalMove = this.checkHorizontalDoubleEqualsPattern(board, row, col);
      if (horizontalMove) return horizontalMove;
    }
    
    // Check vertical pattern
    if (board[row][col] === PieceType.EMPTY) {
      const verticalMove = this.checkVerticalDoubleEqualsPattern(board, row, col);
      if (verticalMove) return verticalMove;
    }
    
    return null;
  }

  /**
   * Check horizontal Double equals constraint pattern
   */
  private checkHorizontalDoubleEqualsPattern(board: PieceType[][], row: number, col: number): PatternMove | null {
    // Count = constraints in this row and find their positions
    const equalsConstraints: number[] = [];
    for (let c = 0; c < this.size - 1; c++) {
      if (this.hConstraints[row][c] === ConstraintType.SAME) {
        equalsConstraints.push(c);
      }
    }
    
    // Must have exactly 2 = constraints
    if (equalsConstraints.length !== 2) return null;
    
    // Find all empty positions and filled positions
    const emptyPositions: number[] = [];
    const filledPositions: { col: number; piece: PieceType }[] = [];
    
    for (let c = 0; c < this.size; c++) {
      if (board[row][c] === PieceType.EMPTY) {
        emptyPositions.push(c);
      } else {
        filledPositions.push({ col: c, piece: board[row][c] });
      }
    }
    
    // Must have exactly 1 filled position for us to determine the pattern
    if (filledPositions.length !== 1) return null;
    
    // Check if the = constraints are between pairs of tiles (at least one side should have content)
    let validPattern = true;
    for (const eqPos of equalsConstraints) {
      const leftHasContent = board[row][eqPos] !== PieceType.EMPTY;
      const rightHasContent = board[row][eqPos + 1] !== PieceType.EMPTY;
      if (!leftHasContent && !rightHasContent) {
        validPattern = false;
        break;
      }
    }
    
    if (!validPattern) return null;
    
    // The pattern with two = constraints always resolves to: A B B A A B
    // Determine what piece should go at the current position based on the known piece
    const knownPiece = filledPositions[0].piece;
    const knownPosition = filledPositions[0].col;
    const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Pattern positions: 0=A, 1=B, 2=B, 3=A, 4=A, 5=B
    const getRequiredPiece = (position: number): PieceType => {
      const patternForA = [true, false, false, true, true, false]; // true = A, false = B
      return patternForA[position] ? knownPiece : opposite;
    };
    
    // Find what the current position should be
    const required = getRequiredPiece(col);
    
    if (this.canPlacePiece(board, row, col, required)) {
      return {
        row, col,
        piece: required,
        reasoning: `Double equals pattern: Row has exactly 2 '=' constraints. The pattern resolves to A B B A A B where A=${knownPiece}. This position must be ${required}.`,
        confidence: 88,
        moveType: 'pattern'
      };
    }
    
    return null;
  }

  /**
   * Check vertical Double equals constraint pattern
   */
  private checkVerticalDoubleEqualsPattern(board: PieceType[][], row: number, col: number): PatternMove | null {
    // Count = constraints in this column and find their positions
    const equalsConstraints: number[] = [];
    for (let r = 0; r < this.size - 1; r++) {
      if (this.vConstraints[r][col] === ConstraintType.SAME) {
        equalsConstraints.push(r);
      }
    }
    
    // Must have exactly 2 = constraints
    if (equalsConstraints.length !== 2) return null;
    
    // Find all empty positions and filled positions
    const emptyPositions: number[] = [];
    const filledPositions: { row: number; piece: PieceType }[] = [];
    
    for (let r = 0; r < this.size; r++) {
      if (board[r][col] === PieceType.EMPTY) {
        emptyPositions.push(r);
      } else {
        filledPositions.push({ row: r, piece: board[r][col] });
      }
    }
    
    // Must have exactly 1 filled position for us to determine the pattern
    if (filledPositions.length !== 1) return null;
    
    // Check if the = constraints are between pairs of tiles
    let validPattern = true;
    for (const eqPos of equalsConstraints) {
      const topHasContent = board[eqPos][col] !== PieceType.EMPTY;
      const bottomHasContent = board[eqPos + 1][col] !== PieceType.EMPTY;
      if (!topHasContent && !bottomHasContent) {
        validPattern = false;
        break;
      }
    }
    
    if (!validPattern) return null;
    
    // The pattern with two = constraints always resolves to: A B B A A B
    const knownPiece = filledPositions[0].piece;
    const knownPosition = filledPositions[0].row;
    const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
    
    // Pattern positions: 0=A, 1=B, 2=B, 3=A, 4=A, 5=B
    const getRequiredPiece = (position: number): PieceType => {
      const patternForA = [true, false, false, true, true, false]; // true = A, false = B
      return patternForA[position] ? knownPiece : opposite;
    };
    
    // Find what the current position should be
    const required = getRequiredPiece(row);
    
    if (this.canPlacePiece(board, row, col, required)) {
      return {
        row, col,
        piece: required,
        reasoning: `Vertical Double equals pattern: Column has exactly 2 '=' constraints. The pattern resolves to A B B A A B where A=${knownPiece}. This position must be ${required}.`,
        confidence: 88,
        moveType: 'pattern'
      };
    }
    
    return null;
  }

  /**
   * Apply advanced constraint patterns for puzzle validation/generation
   */
  applyConstraintPatterns(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Pattern 1: Equal sign between two blank pieces with filled pieces on either end
    madeChanges = this.applyEqualConstraintPatterns(board) || madeChanges;
    
    // Pattern 2: Two X constraint patterns
    madeChanges = this.applyTwoXConstraintPatterns(board) || madeChanges;

    // Pattern 3: Double equals constraint patterns
    madeChanges = this.applyDoubleEqualsPatterns(board) || madeChanges;

    // Pattern 4: General pattern deduction
    madeChanges = this.applyGeneralPatternDeduction(board) || madeChanges;

    return madeChanges;
  }

  /**
   * Apply equal constraint patterns to the board
   */
  private applyEqualConstraintPatterns(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check horizontal equal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 3; col++) {
        if (col >= 1 && this.hConstraints[row][col] === ConstraintType.SAME) {
          const leftPiece = board[row][col - 1];
          const left = board[row][col];
          const right = board[row][col + 1];
          const rightPiece = board[row][col + 2];

          if (leftPiece !== PieceType.EMPTY && left === PieceType.EMPTY && 
              right === PieceType.EMPTY && rightPiece !== PieceType.EMPTY && 
              leftPiece === rightPiece) {
            
            const oppositePiece = leftPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            
            if (this.canPlacePiece(board, row, col, oppositePiece) && 
                this.canPlacePiece(board, row, col + 1, oppositePiece)) {
              board[row][col] = oppositePiece;
              board[row][col + 1] = oppositePiece;
              madeChanges = true;
            }
          }
        }
      }
    }

    // Check vertical equal constraints
    for (let row = 0; row < this.size - 3; row++) {
      for (let col = 0; col < this.size; col++) {
        if (row >= 1 && this.vConstraints[row][col] === ConstraintType.SAME) {
          const topPiece = board[row - 1][col];
          const top = board[row][col];
          const bottom = board[row + 1][col];
          const bottomPiece = board[row + 2][col];

          if (topPiece !== PieceType.EMPTY && top === PieceType.EMPTY && 
              bottom === PieceType.EMPTY && bottomPiece !== PieceType.EMPTY &&
              topPiece === bottomPiece) {
            
            const oppositePiece = topPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
            
            if (this.canPlacePiece(board, row, col, oppositePiece) && 
                this.canPlacePiece(board, row + 1, col, oppositePiece)) {
              board[row][col] = oppositePiece;
              board[row + 1][col] = oppositePiece;
              madeChanges = true;
            }
          }
        }
      }
    }

    return madeChanges;
  }

  /**
   * Apply two X constraint patterns to the board
   */
  private applyTwoXConstraintPatterns(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check all rows
    for (let row = 0; row < this.size; row++) {
      // Count X constraints in this row
      const xConstraints: number[] = [];
      for (let col = 0; col < this.size - 1; col++) {
        if (this.hConstraints[row][col] === ConstraintType.DIFFERENT) {
          xConstraints.push(col);
        }
      }
      
      // Must have exactly 2 X constraints
      if (xConstraints.length !== 2) continue;
      
      // Find empty and filled positions
      const emptyPositions: number[] = [];
      const filledPositions: { col: number; piece: PieceType }[] = [];
      
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          emptyPositions.push(col);
        } else {
          filledPositions.push({ col, piece: board[row][col] });
        }
      }
      
      // Must have exactly 2 empty positions and 1 filled position
      if (emptyPositions.length === 2 && filledPositions.length === 1) {
        // Check if X constraints are between pairs of empty tiles
        let validPattern = true;
        for (const xPos of xConstraints) {
          const leftEmpty = board[row][xPos] === PieceType.EMPTY;
          const rightEmpty = board[row][xPos + 1] === PieceType.EMPTY;
          if (!leftEmpty && !rightEmpty) {
            validPattern = false;
            break;
          }
        }
        
        if (validPattern) {
          const filledPiece = filledPositions[0].piece;
          const required = filledPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          // Apply to both empty positions
          for (const emptyCol of emptyPositions) {
            if (this.canPlacePiece(board, row, emptyCol, required)) {
              board[row][emptyCol] = required;
              madeChanges = true;
            }
          }
        }
      }
    }

    // Check all columns
    for (let col = 0; col < this.size; col++) {
      // Count X constraints in this column
      const xConstraints: number[] = [];
      for (let row = 0; row < this.size - 1; row++) {
        if (this.vConstraints[row][col] === ConstraintType.DIFFERENT) {
          xConstraints.push(row);
        }
      }
      
      // Must have exactly 2 X constraints
      if (xConstraints.length !== 2) continue;
      
      // Find empty and filled positions
      const emptyPositions: number[] = [];
      const filledPositions: { row: number; piece: PieceType }[] = [];
      
      for (let row = 0; row < this.size; row++) {
        if (board[row][col] === PieceType.EMPTY) {
          emptyPositions.push(row);
        } else {
          filledPositions.push({ row, piece: board[row][col] });
        }
      }
      
      // Must have exactly 2 empty positions and 1 filled position
      if (emptyPositions.length === 2 && filledPositions.length === 1) {
        // Check if X constraints are between pairs of empty tiles
        let validPattern = true;
        for (const xPos of xConstraints) {
          const topEmpty = board[xPos][col] === PieceType.EMPTY;
          const bottomEmpty = board[xPos + 1][col] === PieceType.EMPTY;
          if (!topEmpty && !bottomEmpty) {
            validPattern = false;
            break;
          }
        }
        
        if (validPattern) {
          const filledPiece = filledPositions[0].piece;
          const required = filledPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          // Apply to both empty positions
          for (const emptyRow of emptyPositions) {
            if (this.canPlacePiece(board, emptyRow, col, required)) {
              board[emptyRow][col] = required;
              madeChanges = true;
            }
          }
        }
      }
    }

    return madeChanges;
  }

  /**
   * Apply Double equals patterns to the board
   */
  private applyDoubleEqualsPatterns(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Check all rows
    for (let row = 0; row < this.size; row++) {
      // Count = constraints in this row
      const equalsConstraints: number[] = [];
      for (let col = 0; col < this.size - 1; col++) {
        if (this.hConstraints[row][col] === ConstraintType.SAME) {
          equalsConstraints.push(col);
        }
      }
      
      // Must have exactly 2 = constraints
      if (equalsConstraints.length !== 2) continue;
      
      // Find empty and filled positions
      const emptyPositions: number[] = [];
      const filledPositions: { col: number; piece: PieceType }[] = [];
      
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] === PieceType.EMPTY) {
          emptyPositions.push(col);
        } else {
          filledPositions.push({ col, piece: board[row][col] });
        }
      }
      
      // Must have exactly 1 filled position
      if (filledPositions.length === 1) {
        // Check if = constraints are between pairs of tiles
        let validPattern = true;
        for (const eqPos of equalsConstraints) {
          const leftHasContent = board[row][eqPos] !== PieceType.EMPTY;
          const rightHasContent = board[row][eqPos + 1] !== PieceType.EMPTY;
          if (!leftHasContent && !rightHasContent) {
            validPattern = false;
            break;
          }
        }
        
        if (validPattern) {
          const knownPiece = filledPositions[0].piece;
          const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          // Pattern positions: 0=A, 1=B, 2=B, 3=A, 4=A, 5=B
          const patternForA = [true, false, false, true, true, false]; // true = A, false = B
          
          // Apply to all empty positions
          for (const emptyCol of emptyPositions) {
            const required = patternForA[emptyCol] ? knownPiece : opposite;
            if (this.canPlacePiece(board, row, emptyCol, required)) {
              board[row][emptyCol] = required;
              madeChanges = true;
            }
          }
        }
      }
    }

    // Check all columns
    for (let col = 0; col < this.size; col++) {
      // Count = constraints in this column
      const equalsConstraints: number[] = [];
      for (let row = 0; row < this.size - 1; row++) {
        if (this.vConstraints[row][col] === ConstraintType.SAME) {
          equalsConstraints.push(row);
        }
      }
      
      // Must have exactly 2 = constraints
      if (equalsConstraints.length !== 2) continue;
      
      // Find empty and filled positions
      const emptyPositions: number[] = [];
      const filledPositions: { row: number; piece: PieceType }[] = [];
      
      for (let row = 0; row < this.size; row++) {
        if (board[row][col] === PieceType.EMPTY) {
          emptyPositions.push(row);
        } else {
          filledPositions.push({ row, piece: board[row][col] });
        }
      }
      
      // Must have exactly 1 filled position
      if (filledPositions.length === 1) {
        // Check if = constraints are between pairs of tiles
        let validPattern = true;
        for (const eqPos of equalsConstraints) {
          const topHasContent = board[eqPos][col] !== PieceType.EMPTY;
          const bottomHasContent = board[eqPos + 1][col] !== PieceType.EMPTY;
          if (!topHasContent && !bottomHasContent) {
            validPattern = false;
            break;
          }
        }
        
        if (validPattern) {
          const knownPiece = filledPositions[0].piece;
          const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
          // Pattern positions: 0=A, 1=B, 2=B, 3=A, 4=A, 5=B
          const patternForA = [true, false, false, true, true, false]; // true = A, false = B
          
          // Apply to all empty positions
          for (const emptyRow of emptyPositions) {
            const required = patternForA[emptyRow] ? knownPiece : opposite;
            if (this.canPlacePiece(board, emptyRow, col, required)) {
              board[emptyRow][col] = required;
              madeChanges = true;
            }
          }
        }
      }
    }

    return madeChanges;
  }

  /**
   * Apply general pattern deduction
   */
  private applyGeneralPatternDeduction(board: PieceType[][]): boolean {
    let madeChanges = false;

    // Look for patterns like: _ _ X where filling creates forced sequence
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 2; col++) {
        // Pattern: _ _ X
        if (board[row][col] === PieceType.EMPTY && 
            board[row][col + 1] === PieceType.EMPTY && 
            board[row][col + 2] !== PieceType.EMPTY) {
          
          const knownPiece = board[row][col + 2];
          const opposite = knownPiece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
          
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
   * Check if a piece can be validly placed at a position
   */
  canPlacePiece(board: PieceType[][], row: number, col: number, piece: PieceType): boolean {
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
  isPlacementValid(board: PieceType[][], row: number, col: number): boolean {
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
    return this.checkConstraintsAt(board, row, col);
  }

  checkConsecutiveHorizontal(board: PieceType[][], row: number, col: number): boolean {
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

  checkConsecutiveVertical(board: PieceType[][], row: number, col: number): boolean {
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

  checkConstraintsAt(board: PieceType[][], row: number, col: number): boolean {
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

  countPiecesInRow(board: PieceType[][], row: number): { suns: number; moons: number; empty: number } {
    let suns = 0;
    let moons = 0;
    let empty = 0;
    for (let col = 0; col < this.size; col++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
      else empty++;
    }
    return { suns, moons, empty };
  }

  countPiecesInColumn(board: PieceType[][], col: number): { suns: number; moons: number; empty: number } {
    let suns = 0;
    let moons = 0;
    let empty = 0;
    for (let row = 0; row < this.size; row++) {
      if (board[row][col] === PieceType.SUN) suns++;
      else if (board[row][col] === PieceType.MOON) moons++;
      else empty++;
    }
    return { suns, moons, empty };
  }
}
