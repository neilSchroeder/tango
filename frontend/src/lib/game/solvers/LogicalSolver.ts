import { BOARD_SIZE, ConstraintType, PieceType } from '../types';
import { BoardValidator } from '../validators/BoardValidator';

export enum LogicalTier {
  DIRECT = 1,
  LINE_ENUMERATION = 2,
  CROSS_LINE_PROPAGATION = 3,
  CONTRADICTION = 4
}

export interface LogicalMove {
  row: number;
  col: number;
  piece: PieceType;
  reason: string;
  tier: LogicalTier;
}

export interface SolveStep extends LogicalMove {
  availableMoves: number;
  otherDeducibleCells: number;
}

export interface SolveTrace {
  steps: SolveStep[];
  solved: boolean;
  contradiction: boolean;
  highestTier: LogicalTier | null;
}

type Direction = 'row' | 'column';

export class LogicalSolver {
  private readonly validator: BoardValidator;
  private readonly linePatterns: PieceType[][];

  constructor(private readonly size: number = BOARD_SIZE) {
    this.validator = new BoardValidator(size);
    this.linePatterns = this.createLinePatterns();
  }

  findAllLogicalMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): LogicalMove[] {
    return this.getTieredMoves(board, hConstraints, vConstraints).flat();
  }

  solveWithTrace(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    maximumTier: LogicalTier = LogicalTier.CONTRADICTION
  ): SolveTrace {
    const workingBoard = this.copyBoard(board);
    const steps: SolveStep[] = [];

    while (!this.validator.isBoardComplete(workingBoard)) {
      if (this.hasContradiction(workingBoard, hConstraints, vConstraints)) {
        return this.createTrace(steps, false, true);
      }
      const moves = this.nextMoves(workingBoard, hConstraints, vConstraints, maximumTier);
      if (moves.length === 0) {
        return this.createTrace(steps, false, false);
      }
      const move = moves[0];
      workingBoard[move.row][move.col] = move.piece;
      steps.push({ ...move, availableMoves: moves.length, otherDeducibleCells: moves.length - 1 });
    }

    const solved = this.validator.isValidCompleteBoard(workingBoard);
    return this.createTrace(steps, solved, !solved);
  }

  solveWithBasicTechniques(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): boolean {
    return this.solveWithTrace(board, hConstraints, vConstraints, LogicalTier.DIRECT).solved;
  }

  canSolveLogically(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    expectedSolution: PieceType[][]
  ): boolean {
    const trace = this.solveWithTrace(board, hConstraints, vConstraints);
    if (!trace.solved) return false;
    const solvedBoard = this.copyBoard(board);
    for (const step of trace.steps) solvedBoard[step.row][step.col] = step.piece;
    return this.validator.boardsMatch(solvedBoard, expectedSolution);
  }

  private createTrace(steps: SolveStep[], solved: boolean, contradiction: boolean): SolveTrace {
    return {
      steps,
      solved,
      contradiction,
      highestTier: steps.reduce<LogicalTier | null>((highest, step) =>
        highest === null || step.tier > highest ? step.tier : highest, null)
    };
  }

  private nextMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][], maximumTier: LogicalTier): LogicalMove[] {
    const directMoves = this.uniqueMoves(this.directMoves(board, hConstraints, vConstraints));
    if (directMoves.length > 0 || maximumTier === LogicalTier.DIRECT) return directMoves;

    const lineMoves = this.uniqueMoves(this.lineEnumerationMoves(board, hConstraints, vConstraints));
    if (lineMoves.length > 0 || maximumTier === LogicalTier.LINE_ENUMERATION) return lineMoves;

    const crossLineMoves = this.uniqueMoves(this.crossLineMoves(board, hConstraints, vConstraints));
    if (crossLineMoves.length > 0 || maximumTier === LogicalTier.CROSS_LINE_PROPAGATION) return crossLineMoves;

    return this.uniqueMoves(this.contradictionMoves(board, hConstraints, vConstraints));
  }

  private getTieredMoves(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    maximumTier: LogicalTier = LogicalTier.CONTRADICTION
  ): LogicalMove[][] {
    const tiers = [this.directMoves(board, hConstraints, vConstraints)];
    if (maximumTier >= LogicalTier.LINE_ENUMERATION) {
      tiers.push(this.lineEnumerationMoves(board, hConstraints, vConstraints));
    }
    if (maximumTier >= LogicalTier.CROSS_LINE_PROPAGATION) {
      tiers.push(this.crossLineMoves(board, hConstraints, vConstraints));
    }
    if (maximumTier >= LogicalTier.CONTRADICTION) {
      tiers.push(this.contradictionMoves(board, hConstraints, vConstraints));
    }
    return tiers.map((moves) => this.uniqueMoves(moves));
  }

  private directMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    const maxPerSymbol = this.size / 2;
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] !== PieceType.EMPTY) continue;
        const consecutive = this.consecutivePiece(board, row, col);
        if (consecutive) moves.push(this.move(row, col, consecutive, 'Prevent three consecutive symbols'));
        const rowCounts = this.validator.countPiecesInRow(board, row);
        const colCounts = this.validator.countPiecesInCol(board, col);
        if (rowCounts.suns === maxPerSymbol || colCounts.suns === maxPerSymbol) moves.push(this.move(row, col, PieceType.MOON, 'Balance rule: maximum suns reached'));
        if (rowCounts.moons === maxPerSymbol || colCounts.moons === maxPerSymbol) moves.push(this.move(row, col, PieceType.SUN, 'Balance rule: maximum moons reached'));
      }
    }
    return [...moves, ...this.constraintMoves(board, hConstraints, vConstraints)];
  }

  private constraintMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    for (let row = 0; row < this.size; row++) for (let col = 0; col < this.size - 1; col++) {
      moves.push(...this.constraintMove(board, row, col, row, col + 1, hConstraints[row][col]));
    }
    for (let row = 0; row < this.size - 1; row++) for (let col = 0; col < this.size; col++) {
      moves.push(...this.constraintMove(board, row, col, row + 1, col, vConstraints[row][col]));
    }
    return moves;
  }

  private constraintMove(board: PieceType[][], firstRow: number, firstCol: number, secondRow: number, secondCol: number, constraint: ConstraintType): LogicalMove[] {
    if (constraint === ConstraintType.NONE) return [];
    const first = board[firstRow][firstCol];
    const second = board[secondRow][secondCol];
    if (first !== PieceType.EMPTY && second === PieceType.EMPTY) return [this.move(secondRow, secondCol, this.relatedPiece(first, constraint), 'Constraint marker with filled neighbor')];
    if (first === PieceType.EMPTY && second !== PieceType.EMPTY) return [this.move(firstRow, firstCol, this.relatedPiece(second, constraint), 'Constraint marker with filled neighbor')];
    return [];
  }

  private lineEnumerationMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    for (let index = 0; index < this.size; index++) {
      moves.push(...this.forcedLineMoves(board, hConstraints, vConstraints, 'row', index));
      moves.push(...this.forcedLineMoves(board, hConstraints, vConstraints, 'column', index));
    }
    return moves;
  }

  private forcedLineMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][], direction: Direction, index: number): LogicalMove[] {
    const patterns = this.validLinePatterns(board, hConstraints, vConstraints, direction, index);
    if (patterns.length === 0) return [];
    const moves: LogicalMove[] = [];
    for (let offset = 0; offset < this.size; offset++) {
      const [row, col] = direction === 'row' ? [index, offset] : [offset, index];
      if (board[row][col] === PieceType.EMPTY && patterns.every((pattern) => pattern[offset] === patterns[0][offset])) {
        moves.push({ ...this.move(row, col, patterns[0][offset], `Line enumeration: ${direction} has one possible symbol`), tier: LogicalTier.LINE_ENUMERATION });
      }
    }
    return moves;
  }

  private crossLineMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    for (let row = 0; row < this.size; row++) {
      const rowPatterns = this.validLinePatterns(board, hConstraints, vConstraints, 'row', row);
      for (let col = 0; col < this.size; col++) {
        if (board[row][col] !== PieceType.EMPTY) continue;
        const columnPatterns = this.validLinePatterns(board, hConstraints, vConstraints, 'column', col);
        const values = new Set<PieceType>();
        for (const rowPattern of rowPatterns) for (const columnPattern of columnPatterns) {
          if (rowPattern[col] === columnPattern[row]) values.add(rowPattern[col]);
        }
        if (values.size === 1) moves.push({ ...this.move(row, col, [...values][0], 'Cross-line candidate propagation'), tier: LogicalTier.CROSS_LINE_PROPAGATION });
      }
    }
    return moves;
  }

  private contradictionMoves(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): LogicalMove[] {
    const moves: LogicalMove[] = [];
    for (let row = 0; row < this.size; row++) for (let col = 0; col < this.size; col++) {
      if (board[row][col] !== PieceType.EMPTY) continue;
      const sunContradicts = this.assumptionContradicts(board, hConstraints, vConstraints, row, col, PieceType.SUN);
      const moonContradicts = this.assumptionContradicts(board, hConstraints, vConstraints, row, col, PieceType.MOON);
      if (sunContradicts !== moonContradicts) moves.push({ ...this.move(row, col, sunContradicts ? PieceType.MOON : PieceType.SUN, 'Depth-one contradiction'), tier: LogicalTier.CONTRADICTION });
    }
    return moves;
  }

  private assumptionContradicts(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][], row: number, col: number, piece: PieceType): boolean {
    const assumed = this.copyBoard(board);
    assumed[row][col] = piece;
    while (!this.validator.isBoardComplete(assumed)) {
      if (this.hasContradiction(assumed, hConstraints, vConstraints)) return true;
      const moves = this.nextMoves(assumed, hConstraints, vConstraints, LogicalTier.CROSS_LINE_PROPAGATION);
      if (moves.length === 0) return false;
      assumed[moves[0].row][moves[0].col] = moves[0].piece;
    }
    return !this.validator.isValidCompleteBoard(assumed);
  }

  private hasContradiction(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): boolean {
    for (let index = 0; index < this.size; index++) {
      if (this.validLinePatterns(board, hConstraints, vConstraints, 'row', index).length === 0 || this.validLinePatterns(board, hConstraints, vConstraints, 'column', index).length === 0) return true;
    }
    return false;
  }

  private validLinePatterns(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][], direction: Direction, index: number): PieceType[][] {
    const cells = Array.from({ length: this.size }, (_, offset) => direction === 'row' ? board[index][offset] : board[offset][index]);
    const constraints = Array.from({ length: this.size - 1 }, (_, offset) => direction === 'row' ? hConstraints[index][offset] : vConstraints[offset][index]);
    return this.linePatterns.filter((pattern) => pattern.every((piece, offset) => {
      if (cells[offset] !== PieceType.EMPTY && cells[offset] !== piece) return false;
      if (offset === 0 || constraints[offset - 1] === ConstraintType.NONE) return true;
      return constraints[offset - 1] === ConstraintType.SAME ? pattern[offset - 1] === piece : pattern[offset - 1] !== piece;
    }));
  }

  private consecutivePiece(board: PieceType[][], row: number, col: number): PieceType | null {
    const patterns = [[[0, -1], [0, -2]], [[0, 1], [0, 2]], [[0, -1], [0, 1]], [[-1, 0], [-2, 0]], [[1, 0], [2, 0]], [[-1, 0], [1, 0]]];
    for (const [[firstRowOffset, firstColOffset], [secondRowOffset, secondColOffset]] of patterns) {
      const firstRow = row + firstRowOffset;
      const firstCol = col + firstColOffset;
      const secondRow = row + secondRowOffset;
      const secondCol = col + secondColOffset;
      if (this.validator.isValidPosition(firstRow, firstCol) && this.validator.isValidPosition(secondRow, secondCol) && board[firstRow][firstCol] !== PieceType.EMPTY && board[firstRow][firstCol] === board[secondRow][secondCol]) return this.oppositePiece(board[firstRow][firstCol]);
    }
    return null;
  }

  private createLinePatterns(): PieceType[][] {
    const patterns: PieceType[][] = [];
    const build = (pattern: PieceType[]): void => {
      if (pattern.length === this.size) {
        if (pattern.filter((piece) => piece === PieceType.SUN).length === this.size / 2) patterns.push(pattern);
        return;
      }
      for (const piece of [PieceType.SUN, PieceType.MOON]) {
        if (pattern.length >= 2 && pattern.at(-1) === piece && pattern.at(-2) === piece) continue;
        build([...pattern, piece]);
      }
    };
    build([]);
    return patterns;
  }

  private uniqueMoves(moves: LogicalMove[]): LogicalMove[] {
    const movesByCell = new Map<string, LogicalMove>();
    for (const move of moves) {
      const key = `${move.row},${move.col}`;
      const existing = movesByCell.get(key);
      if (!existing || existing.piece === move.piece) movesByCell.set(key, move);
    }
    return [...movesByCell.values()].sort((first, second) => first.row - second.row || first.col - second.col);
  }

  private move(row: number, col: number, piece: PieceType, reason: string): LogicalMove {
    return { row, col, piece, reason, tier: LogicalTier.DIRECT };
  }

  private relatedPiece(piece: PieceType, constraint: ConstraintType): PieceType {
    return constraint === ConstraintType.SAME ? piece : this.oppositePiece(piece);
  }

  private oppositePiece(piece: PieceType): PieceType {
    return piece === PieceType.SUN ? PieceType.MOON : PieceType.SUN;
  }

  private copyBoard(board: PieceType[][]): PieceType[][] {
    return board.map((row) => [...row]);
  }
}
