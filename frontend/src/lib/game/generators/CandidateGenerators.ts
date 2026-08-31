import {
  BOARD_SIZE,
  ConstraintType,
  PieceType,
  createEmptyBoard,
  createEmptyHConstraints,
  createEmptyLockedTiles,
  createEmptyVConstraints,
  type GeneratedPuzzle
} from '../types';
import { LogicalSolver } from '../solvers/LogicalSolver';
import { ConstraintManager } from '../utils/ConstraintManager';
import { BoardGenerator, PuzzleGenerator } from './PuzzleGenerator';

export interface CandidateGenerationProfile {
  startingPiecesMin: number;
  startingPiecesMax: number;
  constraintProbability: number;
  maxAttempts: number;
}

export const defaultCandidateGenerationProfile: CandidateGenerationProfile = {
  startingPiecesMin: 4,
  startingPiecesMax: 8,
  constraintProbability: 0.35,
  maxAttempts: 10
};

export interface PuzzleCandidateGenerator {
  readonly name: string;
  generate(config: CandidateGenerationProfile): GeneratedPuzzle;
}

export class RandomDigCandidateGenerator implements PuzzleCandidateGenerator {
  readonly name = 'random-dig';

  generate(config: CandidateGenerationProfile): GeneratedPuzzle {
    return new PuzzleGenerator().generatePuzzle(config);
  }
}

export class ConstraintFirstCandidateGenerator implements PuzzleCandidateGenerator {
  readonly name = 'constraint-first';
  private readonly boardGenerator = new BoardGenerator(BOARD_SIZE);
  private readonly logicalSolver = new LogicalSolver(BOARD_SIZE);
  private readonly constraintManager = new ConstraintManager(BOARD_SIZE);

  generate(config: CandidateGenerationProfile): GeneratedPuzzle {
    const solution = this.boardGenerator.generateRandomBoard();
    const board = solution.map((row) => [...row]);
    const hConstraints = createEmptyHConstraints();
    const vConstraints = createEmptyVConstraints();
    const lockedTiles = createEmptyLockedTiles();
    this.constraintManager.addStrategicConstraints(solution, hConstraints, vConstraints, config.constraintProbability);

    const targetGivens = randomInteger(config.startingPiecesMin, config.startingPiecesMax);
    for (const [row, col] of shuffle(allPositions())) {
      if (countGivens(board) <= targetGivens) break;
      const piece = board[row][col];
      board[row][col] = PieceType.EMPTY;
      if (!this.logicalSolver.canSolveLogically(board, hConstraints, vConstraints, solution)) {
        board[row][col] = piece;
      }
    }

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        lockedTiles[row][col] = board[row][col] !== PieceType.EMPTY;
      }
    }
    return { board, hConstraints, vConstraints, lockedTiles };
  }
}

export const candidateGenerators: PuzzleCandidateGenerator[] = [
  new RandomDigCandidateGenerator(),
  new ConstraintFirstCandidateGenerator()
];

function allPositions(): [number, number][] {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => [
    Math.floor(index / BOARD_SIZE),
    index % BOARD_SIZE
  ]);
}

function countGivens(board: PieceType[][]): number {
  return board.flat().filter((piece) => piece !== PieceType.EMPTY).length;
}

function randomInteger(minimum: number, maximum: number): number {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}