import { base } from '$app/paths';
import {
  ConstraintType,
  PieceType,
  type GeneratedPuzzle
} from '../types';
import { PuzzleStream } from './PuzzleStream';

interface PuzzleBankEntry {
  id: string;
  board: string;
  horizontalConstraints: string;
  verticalConstraints: string;
  metrics: [number, number, number, number, number];
}

interface PuzzleBankFile {
  version: number;
  entries: PuzzleBankEntry[];
}

export class PuzzleBank {
  private entries: PuzzleBankEntry[] = [];
  private stream: PuzzleStream | null = null;

  async load(): Promise<void> {
    if (this.entries.length > 0) return;
    const response = await fetch(`${base}/puzzles/bank.json`);
    if (!response.ok) throw new Error(`Could not load puzzle bank: ${response.status}`);
    const bank = await response.json() as PuzzleBankFile;
    if (bank.version !== 1 || bank.entries.length === 0) throw new Error('Puzzle bank is empty or unsupported');
    this.entries = bank.entries;
    this.stream = new PuzzleStream(localStorage);
    await navigator.storage?.persist?.();
  }

  next(difficulty: string): GeneratedPuzzle {
    if (this.entries.length === 0) throw new Error('Puzzle bank has not been loaded');
    const tierRange = difficulty === 'easy' ? [1, 1] : difficulty === 'medium' ? [2, 2] : [3, 4];
    const entries = this.entries.filter((entry) => entry.metrics[2] >= tierRange[0] && entry.metrics[2] <= tierRange[1]);
    if (entries.length === 0) throw new Error(`Puzzle bank has no ${difficulty} entries`);
    if (!this.stream) throw new Error('Puzzle bank stream has not been initialized');
    const entry = entries[this.stream.nextIndex(difficulty, entries.length)];
    return decodeEntry(entry);
  }
}

function decodeEntry(entry: PuzzleBankEntry): GeneratedPuzzle {
  const board = decodeGrid(entry.board, decodePiece);
  return {
    board,
    hConstraints: decodeGrid(entry.horizontalConstraints, decodeConstraint, 6, 5),
    vConstraints: decodeGrid(entry.verticalConstraints, decodeConstraint, 5, 6),
    lockedTiles: board.map((row) => row.map((piece) => piece !== PieceType.EMPTY))
  };
}

function decodeGrid<T>(encoded: string, decode: (value: string) => T, rows = 6, columns = 6): T[][] {
  if (encoded.length !== rows * columns) throw new Error('Puzzle bank entry has invalid dimensions');
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => decode(encoded[row * columns + column]))
  );
}

function decodePiece(value: string): PieceType {
  if (value === '0') return PieceType.EMPTY;
  if (value === '1') return PieceType.SUN;
  if (value === '2') return PieceType.MOON;
  throw new Error('Puzzle bank entry has an invalid piece');
}

function decodeConstraint(value: string): ConstraintType {
  if (value === '0') return ConstraintType.NONE;
  if (value === '1') return ConstraintType.SAME;
  if (value === '2') return ConstraintType.DIFFERENT;
  throw new Error('Puzzle bank entry has an invalid constraint');
}