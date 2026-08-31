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

interface Contradiction {
  reason: string;
  forcedMoves: LogicalMove[];
  direction?: Direction;
  index?: number;
  line?: PieceType[];
}

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
        moves.push({
          ...this.move(row, col, patterns[0][offset], this.lineEnumerationReason(direction, index, patterns.length, row, col, patterns[0][offset])),
          tier: LogicalTier.LINE_ENUMERATION
        });
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
      const sunContradiction = this.assumptionContradiction(board, hConstraints, vConstraints, row, col, PieceType.SUN);
      const moonContradiction = this.assumptionContradiction(board, hConstraints, vConstraints, row, col, PieceType.MOON);
      if (Boolean(sunContradiction) !== Boolean(moonContradiction)) {
        const rejectedPiece = sunContradiction ? PieceType.SUN : PieceType.MOON;
        const contradiction = sunContradiction ?? moonContradiction!;
        moves.push({
          ...this.move(row, col, this.oppositePiece(rejectedPiece), this.contradictionReason(row, col, rejectedPiece, contradiction)),
          tier: LogicalTier.CONTRADICTION
        });
      }
    }
    return moves;
  }

  private assumptionContradiction(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][], row: number, col: number, piece: PieceType): Contradiction | null {
    const assumed = this.copyBoard(board);
    const forcedMoves: LogicalMove[] = [];
    assumed[row][col] = piece;
    while (!this.validator.isBoardComplete(assumed)) {
      const contradiction = this.findContradiction(assumed, hConstraints, vConstraints);
      if (contradiction) return { ...contradiction, forcedMoves };
      const moves = this.nextMoves(assumed, hConstraints, vConstraints, LogicalTier.CROSS_LINE_PROPAGATION);
      if (moves.length === 0) return null;
      const move = moves[0];
      forcedMoves.push(move);
      assumed[move.row][move.col] = move.piece;
    }
    return this.validator.isValidCompleteBoard(assumed) ? null : { reason: 'the completed board violates a Tango rule', forcedMoves };
  }

  private hasContradiction(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): boolean {
    return this.findContradiction(board, hConstraints, vConstraints) !== null;
  }

  private findContradiction(board: PieceType[][], hConstraints: ConstraintType[][], vConstraints: ConstraintType[][]): Omit<Contradiction, 'forcedMoves'> | null {
    for (let index = 0; index < this.size; index++) {
      if (this.validLinePatterns(board, hConstraints, vConstraints, 'row', index).length === 0) {
        return { reason: `row ${index + 1} has no valid completion`, direction: 'row', index, line: [...board[index]] };
      }
      if (this.validLinePatterns(board, hConstraints, vConstraints, 'column', index).length === 0) {
        return { reason: `column ${index + 1} has no valid completion`, direction: 'column', index, line: board.map((row) => row[index]) };
      }
    }
    return null;
  }

  private contradictionReason(row: number, col: number, rejectedPiece: PieceType, contradiction: Contradiction): string {
    const forcedMoves = contradiction.forcedMoves.map((move) =>
      `${this.pieceName(move.piece)} at (${move.row + 1}, ${move.col + 1})`
    );
    const forcedClause = forcedMoves.length > 0
      ? ` would force ${forcedMoves.join(', ')}`
      : '';
    const failedLine = contradiction.line
      ? ` After those moves, ${contradiction.reason}. Its state would be [${contradiction.line.map((piece) => piece === PieceType.EMPTY ? '_' : this.pieceName(piece)).join(', ')}], which has no pattern satisfying Tango's rules and its constraint markers.`
      : ` This ${contradiction.reason}.`;
    return `Depth-one contradiction: placing a ${this.pieceName(rejectedPiece)} at (${row + 1}, ${col + 1})${forcedClause}.${failedLine}`;
  }

  private pieceName(piece: PieceType): string {
    return piece === PieceType.SUN ? 'sun' : 'moon';
  }

  private lineEnumerationReason(direction: Direction, index: number, completionCount: number, row: number, col: number, piece: PieceType): string {
    const lineName = `${direction} ${index + 1}`;
    const completionLabel = completionCount === 1 ? 'completion' : 'completions';
    return `Line enumeration: ${lineName} has ${completionCount} valid ${completionLabel} after its filled cells and constraint markers are applied; every completion places a ${this.pieceName(piece)} at (${row + 1}, ${col + 1}).`;
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
