import { ConstraintType, PieceType, type GeneratedPuzzle } from '../types';
import { LogicalSolver, type SolveTrace } from '../solvers/LogicalSolver';
import { TangoBoardSolver } from '../solvers/TangoBoardSolver';

export interface PuzzleMetrics {
  givenCount: number;
  constraintCount: number;
  trace: SolveTrace;
  narrowness: number;
  bottleneckCount: number;
  unique: boolean;
  minimal: boolean;
}

export function analyzePuzzle(puzzle: GeneratedPuzzle): PuzzleMetrics {
  const solver = new LogicalSolver();
  const trace = solver.solveWithTrace(puzzle.board, puzzle.hConstraints, puzzle.vConstraints);
  const stepsWithOneMove = trace.steps.filter((step) => step.availableMoves === 1).length;

  return {
    givenCount: puzzle.board.flat().filter((piece) => piece !== PieceType.EMPTY).length,
    constraintCount: countConstraints(puzzle.hConstraints) + countConstraints(puzzle.vConstraints),
    trace,
    narrowness: trace.steps.length === 0 ? 0 : stepsWithOneMove / trace.steps.length,
    bottleneckCount: trace.steps.filter((step, index, steps) =>
      index > 0 && index < steps.length - 1 &&
      step.tier > steps[index - 1].tier && step.tier > steps[index + 1].tier
    ).length,
    unique: hasUniqueSolution(puzzle),
    minimal: isMinimal(puzzle, solver)
  };
}

export function minimizePuzzle(puzzle: GeneratedPuzzle): GeneratedPuzzle {
  const minimized = copyPuzzle(puzzle);
  const solver = new LogicalSolver();
  const removableItems = [
    ...minimized.board.flatMap((row, rowIndex) => row.map((piece, colIndex) => ({ kind: 'given' as const, row: rowIndex, col: colIndex, present: piece !== PieceType.EMPTY }))),
    ...minimized.hConstraints.flatMap((row, rowIndex) => row.map((constraint, colIndex) => ({ kind: 'horizontal' as const, row: rowIndex, col: colIndex, present: constraint !== ConstraintType.NONE }))),
    ...minimized.vConstraints.flatMap((row, rowIndex) => row.map((constraint, colIndex) => ({ kind: 'vertical' as const, row: rowIndex, col: colIndex, present: constraint !== ConstraintType.NONE })))
  ];

  for (const item of removableItems) {
    if (!item.present) continue;
    const original = item.kind === 'given'
      ? minimized.board[item.row][item.col]
      : item.kind === 'horizontal'
        ? minimized.hConstraints[item.row][item.col]
        : minimized.vConstraints[item.row][item.col];
    if (item.kind === 'given') minimized.board[item.row][item.col] = PieceType.EMPTY;
    else if (item.kind === 'horizontal') minimized.hConstraints[item.row][item.col] = ConstraintType.NONE;
    else minimized.vConstraints[item.row][item.col] = ConstraintType.NONE;

    if (!hasUniqueSolution(minimized) || !solver.solveWithTrace(minimized.board, minimized.hConstraints, minimized.vConstraints).solved) {
      if (item.kind === 'given') minimized.board[item.row][item.col] = original as PieceType;
      else if (item.kind === 'horizontal') minimized.hConstraints[item.row][item.col] = original as ConstraintType;
      else minimized.vConstraints[item.row][item.col] = original as ConstraintType;
    }
  }

  for (let row = 0; row < minimized.board.length; row++) {
    for (let col = 0; col < minimized.board[row].length; col++) {
      minimized.lockedTiles[row][col] = minimized.board[row][col] !== PieceType.EMPTY;
    }
  }
  return minimized;
}

export function isMinimal(puzzle: GeneratedPuzzle, solver = new LogicalSolver()): boolean {
  for (let row = 0; row < puzzle.board.length; row++) {
    for (let col = 0; col < puzzle.board[row].length; col++) {
      if (puzzle.board[row][col] !== PieceType.EMPTY) {
        const candidate = copyPuzzle(puzzle);
        candidate.board[row][col] = PieceType.EMPTY;
        if (hasUniqueSolution(candidate) && solver.solveWithTrace(candidate.board, candidate.hConstraints, candidate.vConstraints).solved) return false;
      }
    }
  }

  for (let row = 0; row < puzzle.hConstraints.length; row++) {
    for (let col = 0; col < puzzle.hConstraints[row].length; col++) {
      if (puzzle.hConstraints[row][col] !== ConstraintType.NONE) {
        const candidate = copyPuzzle(puzzle);
        candidate.hConstraints[row][col] = ConstraintType.NONE;
        if (hasUniqueSolution(candidate) && solver.solveWithTrace(candidate.board, candidate.hConstraints, candidate.vConstraints).solved) return false;
      }
    }
  }

  for (let row = 0; row < puzzle.vConstraints.length; row++) {
    for (let col = 0; col < puzzle.vConstraints[row].length; col++) {
      if (puzzle.vConstraints[row][col] !== ConstraintType.NONE) {
        const candidate = copyPuzzle(puzzle);
        candidate.vConstraints[row][col] = ConstraintType.NONE;
        if (hasUniqueSolution(candidate) && solver.solveWithTrace(candidate.board, candidate.hConstraints, candidate.vConstraints).solved) return false;
      }
    }
  }

  return true;
}

export function hasUniqueSolution(puzzle: GeneratedPuzzle): boolean {
  return new TangoBoardSolver(puzzle.board, puzzle.hConstraints, puzzle.vConstraints, puzzle.lockedTiles)
    .findAllSolutions(2).length === 1;
}

function countConstraints(constraints: ConstraintType[][]): number {
  return constraints.flat().filter((constraint) => constraint !== ConstraintType.NONE).length;
}

function copyPuzzle(puzzle: GeneratedPuzzle): GeneratedPuzzle {
  return {
    board: puzzle.board.map((row) => [...row]),
    hConstraints: puzzle.hConstraints.map((row) => [...row]),
    vConstraints: puzzle.vConstraints.map((row) => [...row]),
    lockedTiles: puzzle.lockedTiles.map((row) => [...row])
  };
}