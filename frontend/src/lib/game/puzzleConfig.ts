/**
 * Puzzle configuration for different difficulty levels
 * Ported from backend/app/config/puzzle_config.py
 */

import type { PuzzleConfig } from './types';

const PUZZLE_CONFIGS: Record<string, PuzzleConfig> = {
  easy: {
    name: 'Easy',
    startingPiecesMin: 8,
    startingPiecesMax: 12,
    constraintProbability: 0.15,
    maxAttempts: 20,
    baseScore: 100,
    parTime: 300,
    parMoves: 30,
    timeWeight: 2,
    moveWeight: 3
  },
  medium: {
    name: 'Medium', 
    startingPiecesMin: 6,
    startingPiecesMax: 10,
    constraintProbability: 0.25,
    maxAttempts: 15,
    baseScore: 200,
    parTime: 240,
    parMoves: 25,
    timeWeight: 3,
    moveWeight: 4
  },
  hard: {
    name: 'Hard',
    startingPiecesMin: 4,
    startingPiecesMax: 8,
    constraintProbability: 0.35,
    maxAttempts: 10,
    baseScore: 300,
    parTime: 180,
    parMoves: 20,
    timeWeight: 4,
    moveWeight: 5
  }
};

export function getPuzzleConfig(difficulty?: string): PuzzleConfig {
  const diff = difficulty?.toLowerCase() || 'medium';
  return PUZZLE_CONFIGS[diff] || PUZZLE_CONFIGS.medium;
}
