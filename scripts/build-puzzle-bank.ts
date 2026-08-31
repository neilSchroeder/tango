import { mkdirSync, writeFileSync } from 'node:fs';
import { analyzePuzzle, minimizePuzzle } from '../frontend/src/lib/game/analysis/PuzzleMetrics';
import { candidateGenerators, defaultCandidateGenerationProfile } from '../frontend/src/lib/game/generators/CandidateGenerators';
import { TangoBoardSolver } from '../frontend/src/lib/game/solvers/TangoBoardSolver';
import { ConstraintType, PieceType, type GeneratedPuzzle } from '../frontend/src/lib/game/types';

interface BankEntry {
  id: string;
  source: string;
  board: string;
  horizontalConstraints: string;
  verticalConstraints: string;
  metrics: [number, number, number, number, number];
}

const entryCount = argumentValue('--count', 10_000);
const randomSeed = argumentValue('--seed', 0x5eedc0de);
const originalRandom = Math.random;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
let randomState = randomSeed;
Math.random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x1_0000_0000;
};
console.log = () => undefined;
console.warn = () => undefined;
console.error = () => undefined;

const entries: BankEntry[] = [];
const puzzleIds = new Set<string>();
const solutionIds = new Set<string>();
let attempts = 0;
const maximumAttempts = entryCount * 100;

while (entries.length < entryCount && attempts < maximumAttempts) {
  const generator = candidateGenerators[attempts % candidateGenerators.length];
  attempts++;
  const puzzle = minimizePuzzle(generator.generate(defaultCandidateGenerationProfile));
  const metrics = analyzePuzzle(puzzle);
  if (!metrics.unique || !metrics.minimal || !metrics.trace.solved || metrics.trace.highestTier === null || metrics.trace.highestTier > 4) continue;

  const entry = encodeEntry(puzzle, metrics, generator.name);
  if (puzzleIds.has(entry.id)) continue;
  const solutionId = encodeSolution(puzzle);
  if (solutionIds.has(solutionId) && attempts < entryCount * 20) continue;
  puzzleIds.add(entry.id);
  solutionIds.add(solutionId);
  entries.push(entry);
}

Math.random = originalRandom;
console.log = originalConsoleLog;
console.warn = originalConsoleWarn;
console.error = originalConsoleError;

if (entries.length !== entryCount) {
  throw new Error(`Built ${entries.length}/${entryCount} entries after ${attempts} attempts`);
}

mkdirSync('frontend/static/puzzles', { recursive: true });
writeFileSync('frontend/static/puzzles/bank.json', `${JSON.stringify({ version: 1, randomSeed, entries })}\n`);
console.log(`Built ${entries.length} minimal puzzle instances in ${attempts} attempts.`);

function encodeEntry(puzzle: GeneratedPuzzle, metrics: ReturnType<typeof analyzePuzzle>, source: string): BankEntry {
  const board = encodePieces(puzzle.board.flat());
  const horizontalConstraints = encodeConstraints(puzzle.hConstraints.flat());
  const verticalConstraints = encodeConstraints(puzzle.vConstraints.flat());
  return {
    id: `${board}${horizontalConstraints}${verticalConstraints}`,
    source,
    board,
    horizontalConstraints,
    verticalConstraints,
    metrics: [metrics.givenCount, metrics.constraintCount, metrics.trace.highestTier ?? 0, Math.round(metrics.narrowness * 1000), metrics.bottleneckCount]
  };
}

function encodeSolution(puzzle: GeneratedPuzzle): string {
  const solution = new TangoBoardSolver(puzzle.board, puzzle.hConstraints, puzzle.vConstraints, puzzle.lockedTiles).findAllSolutions(1)[0];
  return encodePieces(solution.flat());
}

function encodePieces(pieces: PieceType[]): string {
  return pieces.map((piece) => piece === PieceType.EMPTY ? '0' : piece === PieceType.SUN ? '1' : '2').join('');
}

function encodeConstraints(constraints: ConstraintType[]): string {
  return constraints.map((constraint) => constraint === ConstraintType.NONE ? '0' : constraint === ConstraintType.SAME ? '1' : '2').join('');
}

function argumentValue(name: string, fallback: number): number {
  const argument = process.argv.find((value) => value.startsWith(`${name}=`));
  return argument ? Number(argument.slice(name.length + 1)) : fallback;
}