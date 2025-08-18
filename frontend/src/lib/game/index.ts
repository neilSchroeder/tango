/**
 * Main export file for the Tango game library
 * Provides a clean interface for importing game functionality
 * DEFAULT: Rule-based solving with original puzzle generation
 */

export * from './types';
export { TangoBoardSolver } from './TangoBoardSolver';
export { PuzzleGenerator } from './PuzzleGenerator';
export { GameService } from './GameService';
export { GameLogic } from './GameLogic';

// Advanced template generation (optional)
export { TemplatePuzzleGenerator } from './TemplatePuzzleGenerator';
export { PuzzleDifficultyAnalyzer, DifficultyLevel, SolvingTechnique } from './PuzzleDifficultyAnalyzer';

// Template generation types (optional)
export type { 
  GenerationResult,
  PuzzleQuality,
  DifficultyProfile
} from './TemplatePuzzleGenerator';

// Re-export common types for convenience
export { 
  PieceType, 
  ConstraintType
} from './types';

export type { 
  GameState, 
  GameResult, 
  Hint, 
  Stats,
  PuzzleConfig 
} from './types';

// Import GameService for the instance
import { GameService } from './GameService';

// Main game service instance for easy usage
export const gameService = new GameService();
