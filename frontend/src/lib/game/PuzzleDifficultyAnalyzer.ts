import { TangoBoardSolver } from './TangoBoardSolver';
import { PieceType, ConstraintType, BOARD_SIZE } from './types';
import type { GeneratedPuzzle } from './PuzzleGenerator';

/**
 * Enhanced Difficulty Analysis System
 * 
 * Provides objective puzzle quality measurement and difficulty classification
 */

export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium', 
  HARD = 'hard'
}

export enum SolvingTechnique {
  NAKED_SINGLE = 'naked_single',
  CONSTRAINT_PROPAGATION = 'constraint_propagation',
  LOGICAL_DEDUCTION = 'logical_deduction',
  PATTERN_RECOGNITION = 'pattern_recognition',
  ADVANCED_CONSTRAINT = 'advanced_constraint',
  BACKTRACKING = 'backtracking'
}

export interface PuzzleQuality {
  difficultyRating: DifficultyLevel;
  solvingComplexity: number;
  uniquenessStrength: number;
  constraintDensity: number;
  branchingFactor: number;
  givenClues: number;
  requiredTechniques: SolvingTechnique[];
  qualityScore: number;
}

export interface DifficultyProfile {
  targetComplexity: [number, number];
  requiredTechniques: SolvingTechnique[];
  qualityThresholds: {
    minUniqueness: number;
    maxBranching: number;
    minConstraints: number;
  };
}

export interface SolverAnalysis {
  solutionCount: number;
  solvingSteps: number;
  branchingPoints: number;
  constraintApplications: number;
  techniquesUsed: SolvingTechnique[];
  solvingTime: number;
}

/**
 * Instrumented solver that tracks solving process for analysis
 */
export class InstrumentedSolver extends TangoBoardSolver {
  private analysisData: SolverAnalysis;
  private puzzle: {
    board: PieceType[][];
    hConstraints: ConstraintType[][];
    vConstraints: ConstraintType[][];
    lockedTiles: boolean[][];
  };

  constructor(
    board: PieceType[][],
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][],
    lockedTiles: boolean[][]
  ) {
    super(board, hConstraints, vConstraints, lockedTiles);
    
    // Store puzzle data for analysis
    this.puzzle = {
      board: board.map(row => [...row]),
      hConstraints: hConstraints.map(row => [...row]),
      vConstraints: vConstraints.map(row => [...row]),
      lockedTiles: lockedTiles.map(row => [...row])
    };
    
    this.analysisData = {
      solutionCount: 0,
      solvingSteps: 0,
      branchingPoints: 0,
      constraintApplications: 0,
      techniquesUsed: [],
      solvingTime: 0
    };
  }

  public getAnalysis(): SolverAnalysis {
    return { ...this.analysisData };
  }

  /**
   * Analyze puzzle difficulty by solving with instrumentation
   */
  public analyzePuzzle(): PuzzleQuality {
    const startTime = performance.now();
    
    // Configure for optimal analysis
    this.setUseDomainBasedSolving(true);
    this.setUseCDCL(true);
    this.setUseVSIDS(true);
    
    // Find solutions and track process
    const solutions = this.findAllSolutions(3);
    this.analysisData.solutionCount = solutions.length;
    this.analysisData.solvingTime = performance.now() - startTime;
    
    // Calculate metrics
    const complexity = this.calculateComplexity();
    const uniqueness = solutions.length === 1 ? 1.0 : 1.0 / solutions.length;
    const constraintDensity = this.calculateConstraintDensity();
    const branchingFactor = this.analysisData.branchingPoints;
    const givenClues = this.countGivenClues();
    
    // Determine difficulty level
    const difficultyRating = this.classifyDifficulty(complexity, uniqueness, constraintDensity);
    
    // Identify techniques used
    const requiredTechniques = this.identifyRequiredTechniques(complexity);
    
    const qualityScore = this.calculateQualityScore(
      uniqueness, complexity, constraintDensity, branchingFactor, givenClues
    );

    return {
      difficultyRating,
      solvingComplexity: complexity,
      uniquenessStrength: uniqueness,
      constraintDensity,
      branchingFactor,
      givenClues,
      requiredTechniques,
      qualityScore
    };
  }

  private calculateComplexity(): number {
    // Base complexity on solving time and steps
    return Math.min(1000, this.analysisData.solvingTime + this.analysisData.solvingSteps * 2);
  }

  private calculateConstraintDensity(): number {
    // Count non-empty constraints
    let constraintCount = 0;
    let totalPossible = 0;
    
    // Horizontal constraints
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        totalPossible++;
        if (this.puzzle.hConstraints[r][c] !== ConstraintType.NONE) {
          constraintCount++;
        }
      }
    }
    
    // Vertical constraints
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        totalPossible++;
        if (this.puzzle.vConstraints[r][c] !== ConstraintType.NONE) {
          constraintCount++;
        }
      }
    }
    
    return constraintCount / totalPossible;
  }

  private countGivenClues(): number {
    let count = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.puzzle.lockedTiles[r][c]) {
          count++;
        }
      }
    }
    return count;
  }

  private classifyDifficulty(complexity: number, uniqueness: number, constraintDensity: number): DifficultyLevel {
    const score = complexity * 0.4 + (1 - uniqueness) * 300 + (1 - constraintDensity) * 200;
    
    if (score < 100) {
      return DifficultyLevel.EASY;
    } else if (score < 250) {
      return DifficultyLevel.MEDIUM;
    } else {
      return DifficultyLevel.HARD;
    }
  }

  private identifyRequiredTechniques(complexity: number): SolvingTechnique[] {
    const techniques: SolvingTechnique[] = [SolvingTechnique.NAKED_SINGLE];
    
    if (complexity > 20) {
      techniques.push(SolvingTechnique.CONSTRAINT_PROPAGATION);
    }
    if (complexity > 50) {
      techniques.push(SolvingTechnique.LOGICAL_DEDUCTION);
    }
    if (complexity > 100) {
      techniques.push(SolvingTechnique.PATTERN_RECOGNITION);
    }
    if (complexity > 200) {
      techniques.push(SolvingTechnique.ADVANCED_CONSTRAINT);
    }
    if (complexity > 400) {
      techniques.push(SolvingTechnique.BACKTRACKING);
    }
    
    return techniques;
  }

  private calculateQualityScore(
    uniqueness: number,
    complexity: number,
    constraintDensity: number,
    branchingFactor: number,
    givenClues: number
  ): number {
    const weights = {
      uniqueness: 0.3,
      complexity: 0.25,
      density: 0.2,
      branching: 0.15,
      clues: 0.1
    };
    
    const uniquenessScore = uniqueness;
    const complexityScore = Math.min(1, complexity / 500);
    const densityScore = Math.min(1, constraintDensity / 0.5);
    const branchingScore = Math.max(0, 1 - branchingFactor / 50);
    const clueScore = Math.max(0, 1 - givenClues / (BOARD_SIZE * BOARD_SIZE * 0.5));
    
    return (
      weights.uniqueness * uniquenessScore +
      weights.complexity * complexityScore +
      weights.density * densityScore +
      weights.branching * branchingScore +
      weights.clues * clueScore
    );
  }
}

/**
 * Main difficulty analyzer class
 */
export class PuzzleDifficultyAnalyzer {
  
  /**
   * Analyze puzzle difficulty and quality
   */
  public analyzeDifficulty(puzzle: GeneratedPuzzle): PuzzleQuality {
    const solver = new InstrumentedSolver(
      puzzle.board,
      puzzle.hConstraints,
      puzzle.vConstraints,
      puzzle.lockedTiles
    );
    
    return solver.analyzePuzzle();
  }

  /**
   * Get difficulty profile for a target difficulty level
   */
  public getDifficultyProfile(difficulty: DifficultyLevel): DifficultyProfile {
    switch (difficulty) {
      case DifficultyLevel.EASY:
        return {
          targetComplexity: [10, 50],
          requiredTechniques: [
            SolvingTechnique.NAKED_SINGLE,
            SolvingTechnique.CONSTRAINT_PROPAGATION
          ],
          qualityThresholds: {
            minUniqueness: 0.95,
            maxBranching: 5,
            minConstraints: 0.2
          }
        };
      
      case DifficultyLevel.MEDIUM:
        return {
          targetComplexity: [50, 150],
          requiredTechniques: [
            SolvingTechnique.NAKED_SINGLE,
            SolvingTechnique.CONSTRAINT_PROPAGATION,
            SolvingTechnique.LOGICAL_DEDUCTION,
            SolvingTechnique.PATTERN_RECOGNITION
          ],
          qualityThresholds: {
            minUniqueness: 0.9,
            maxBranching: 15,
            minConstraints: 0.15
          }
        };
      
      case DifficultyLevel.HARD:
        return {
          targetComplexity: [150, 400],
          requiredTechniques: [
            SolvingTechnique.NAKED_SINGLE,
            SolvingTechnique.CONSTRAINT_PROPAGATION,
            SolvingTechnique.LOGICAL_DEDUCTION,
            SolvingTechnique.PATTERN_RECOGNITION,
            SolvingTechnique.ADVANCED_CONSTRAINT,
            SolvingTechnique.BACKTRACKING
          ],
          qualityThresholds: {
            minUniqueness: 0.8,
            maxBranching: 30,
            minConstraints: 0.1
          }
        };
    }
  }

  /**
   * Check if puzzle meets quality standards for target difficulty
   */
  public meetsQualityStandards(quality: PuzzleQuality, targetDifficulty: DifficultyLevel): boolean {
    const profile = this.getDifficultyProfile(targetDifficulty);
    
    return (
      quality.difficultyRating === targetDifficulty &&
      quality.uniquenessStrength >= profile.qualityThresholds.minUniqueness &&
      quality.branchingFactor <= profile.qualityThresholds.maxBranching &&
      quality.constraintDensity >= profile.qualityThresholds.minConstraints &&
      quality.solvingComplexity >= profile.targetComplexity[0] &&
      quality.solvingComplexity <= profile.targetComplexity[1]
    );
  }
}
