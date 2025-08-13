/**
 * Game utility functions to reduce code complexity
 */

import type { PieceType, ConstraintType } from '../api/types';

export function getPieceSymbol(piece: PieceType): string {
  switch (piece) {
    case 'sun': return '●';
    case 'moon': return '◐';
    default: return '';
  }
}

export function getConstraintSymbol(constraint: ConstraintType): string {
  switch (constraint) {
    case 'same': return '=';
    case 'different': return '×';
    default: return '';
  }
}

export function getNextPiece(currentPiece: PieceType): PieceType {
  switch (currentPiece) {
    case 'empty': return 'sun';
    case 'sun': return 'moon';
    case 'moon': return 'empty';
    default: return 'empty';
  }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function createTileId(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseTileId(tileId: string): { row: number; col: number } {
  const [row, col] = tileId.split(',').map(Number);
  return { row, col };
}
