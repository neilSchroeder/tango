import { PuzzleDifficultyAnalyzer, DifficultyLevel, SolvingTechnique } from './PuzzleDifficultyAnalyzer';
import type { PuzzleQuality, DifficultyProfile } from './PuzzleDifficultyAnalyzer';
import { TangoBoardSolver } from './TangoBoardSolver';
import { PieceType, ConstraintType, BOARD_SIZE } from './types';
import type { PuzzleConfig, GeneratedPuzzle } from './types';

// Re-export types for easier importing
export type { PuzzleQuality, DifficultyProfile } from './PuzzleDifficultyAnalyzer';

/**
 * Template-Based Puzzle Generation System
 * 
 * This system generates puzzles with predictable quality characteristics using:
 * 1. Template-driven generation patterns
 * 2. Difficulty-targeted puzzle creation
 * 3. Quality-controlled iterative improvement
 * 4. Pattern-based constraint placement
 */

// Enhanced interfaces for template-based generation
interface PuzzleTemplate {
  name: string;
  targetDifficulty: DifficultyLevel;
  requiredTechniques: SolvingTechnique[];
  constraintPatterns: ConstraintPattern[];
  clueDistribution: ClueDistribution;
  qualityThresholds: QualityThresholds;
  generationHints: GenerationHints;
}

interface ConstraintPattern {
  type: 'symmetric' | 'asymmetric' | 'sparse' | 'dense' | 'diagonal' | 'cross' | 'border';
  density: number;                    // 0.0 - 1.0
  placement: 'random' | 'structured' | 'logical';
  symmetryAxis?: 'horizontal' | 'vertical' | 'diagonal' | 'rotational';
}

interface ClueDistribution {
  totalClues: [number, number];       // Min/max clues
  distributionType: 'uniform' | 'clustered' | 'sparse' | 'corner-heavy';
  symmetry: boolean;                  // Should clue placement be symmetric
  avoidPatterns: string[];            // Patterns to avoid (e.g., 'cross', 'corners')
}

interface QualityThresholds {
  minUniquenessBoundary: number;      // How close to multiple solutions is acceptable
  maxSolvingComplexity: number;       // Maximum steps allowed
  minConstraintDensity: number;       // Minimum constraint coverage
  maxBranchingFactor: number;         // Maximum search complexity
  requiredTechniqueScore: number;     // How well techniques must be represented
}

interface GenerationHints {
  seedPatterns: string[];             // Known good starting patterns
  avoidanceRules: string[];           // Patterns that lead to poor puzzles
  optimizationFocus: 'speed' | 'uniqueness' | 'elegance' | 'complexity';
  maxIterations: number;              // Generation attempt limit
  qualityWeight: number;              // How much to prioritize quality vs speed
}

export interface GenerationResult {
  puzzle: GeneratedPuzzle;
  quality: PuzzleQuality;
  template: PuzzleTemplate;
  generationStats: GenerationStats;
  qualityScore: number;
}

interface GenerationStats {
  totalAttempts: number;
  successfulAttempts: number;
  averageQuality: number;
  generationTime: number;
  templateEffectiveness: number;
  convergenceRate: number;
}

/**
 * Template-based puzzle generator using difficulty analysis
 */
export class TemplatePuzzleGenerator {
  private analyzer: PuzzleDifficultyAnalyzer;
  private templates: Map<string, PuzzleTemplate> = new Map();

  constructor() {
    this.analyzer = new PuzzleDifficultyAnalyzer();
    this.initializeTemplates();
  }

  /**
   * Initialize puzzle templates for 3 difficulty levels (easy, medium, hard)
   */
  private initializeTemplates(): void {
    // Easy template - focuses on simple logical deduction
    this.templates.set('easy', {
      name: 'easy',
      targetDifficulty: DifficultyLevel.EASY,
      requiredTechniques: [SolvingTechnique.NAKED_SINGLE, SolvingTechnique.CONSTRAINT_PROPAGATION],
      constraintPatterns: [
        { type: 'symmetric', density: 0.4, placement: 'structured', symmetryAxis: 'rotational' },
        { type: 'dense', density: 0.3, placement: 'logical' }
      ],
      clueDistribution: {
        totalClues: [18, 24],
        distributionType: 'uniform',
        symmetry: true,
        avoidPatterns: ['sparse']
      },
      qualityThresholds: {
        minUniquenessBoundary: 0.95,
        maxSolvingComplexity: 50,
        minConstraintDensity: 0.3,
        maxBranchingFactor: 5,
        requiredTechniqueScore: 0.8
      },
      generationHints: {
        seedPatterns: ['center-cross', 'corner-start'],
        avoidanceRules: ['empty-regions', 'constraint-clusters'],
        optimizationFocus: 'elegance',
        maxIterations: 100,
        qualityWeight: 0.8
      }
    });

    // Medium template - balanced challenge with multiple techniques
    this.templates.set('medium', {
      name: 'medium',
      targetDifficulty: DifficultyLevel.MEDIUM,
      requiredTechniques: [
        SolvingTechnique.NAKED_SINGLE,
        SolvingTechnique.CONSTRAINT_PROPAGATION,
        SolvingTechnique.LOGICAL_DEDUCTION,
        SolvingTechnique.PATTERN_RECOGNITION
      ],
      constraintPatterns: [
        { type: 'asymmetric', density: 0.3, placement: 'logical' },
        { type: 'sparse', density: 0.2, placement: 'random' },
        { type: 'diagonal', density: 0.25, placement: 'structured' }
      ],
      clueDistribution: {
        totalClues: [15, 20],
        distributionType: 'clustered',
        symmetry: false,
        avoidPatterns: ['corner-heavy', 'center-empty']
      },
      qualityThresholds: {
        minUniquenessBoundary: 0.9,
        maxSolvingComplexity: 150,
        minConstraintDensity: 0.15,
        maxBranchingFactor: 15,
        requiredTechniqueScore: 0.7
      },
      generationHints: {
        seedPatterns: ['diagonal-bias', 'scattered-start'],
        avoidanceRules: ['symmetry-dependence', 'single-technique'],
        optimizationFocus: 'complexity',
        maxIterations: 150,
        qualityWeight: 0.7
      }
    });

    // Hard template - challenging puzzles requiring advanced techniques
    this.templates.set('hard', {
      name: 'hard',
      targetDifficulty: DifficultyLevel.HARD,
      requiredTechniques: [
        SolvingTechnique.NAKED_SINGLE,
        SolvingTechnique.CONSTRAINT_PROPAGATION,
        SolvingTechnique.LOGICAL_DEDUCTION,
        SolvingTechnique.PATTERN_RECOGNITION,
        SolvingTechnique.ADVANCED_CONSTRAINT,
        SolvingTechnique.BACKTRACKING
      ],
      constraintPatterns: [
        { type: 'sparse', density: 0.15, placement: 'logical' },
        { type: 'asymmetric', density: 0.2, placement: 'random' },
        { type: 'border', density: 0.1, placement: 'structured' }
      ],
      clueDistribution: {
        totalClues: [12, 18],
        distributionType: 'sparse',
        symmetry: false,
        avoidPatterns: ['dense-clusters', 'obvious-patterns']
      },
      qualityThresholds: {
        minUniquenessBoundary: 0.8,
        maxSolvingComplexity: 400,
        minConstraintDensity: 0.1,
        maxBranchingFactor: 30,
        requiredTechniqueScore: 0.6
      },
      generationHints: {
        seedPatterns: ['minimal-start', 'edge-focus'],
        avoidanceRules: ['easy-deductions', 'constraint-heavy'],
        optimizationFocus: 'uniqueness',
        maxIterations: 200,
        qualityWeight: 0.6
      }
    });
  }

  /**
   * Generate puzzle using specific template
   */
  public generateFromTemplate(templateName: string): GenerationResult {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found. Available: ${this.getAvailableTemplates().join(', ')}`);
    }

    const startTime = performance.now();
    let bestResult: GenerationResult | null = null;
    let totalAttempts = 0;
    let successfulAttempts = 0;
    let qualitySum = 0;

    console.log(`🎯 Generating puzzle with template: ${template.name.toUpperCase()}`);
    console.log(`Target difficulty: ${template.targetDifficulty}`);

    for (let attempt = 0; attempt < template.generationHints.maxIterations; attempt++) {
      totalAttempts++;

      try {
        // Create base configuration from template
        const config = this.templateToConfig(template);
        
        // Generate puzzle using simple generation method
        const puzzle = this.createSimplePuzzle(config);
        
        // Analyze quality
        const quality = this.analyzer.analyzeDifficulty(puzzle);
        const qualityScore = quality.qualityScore;
        qualitySum += qualityScore;

        // Check if meets template requirements
        if (this.meetsTemplateRequirements(quality, template)) {
          successfulAttempts++;
          
          const result: GenerationResult = {
            puzzle,
            quality,
            template,
            generationStats: {
              totalAttempts: attempt + 1,
              successfulAttempts,
              averageQuality: qualitySum / totalAttempts,
              generationTime: performance.now() - startTime,
              templateEffectiveness: successfulAttempts / totalAttempts,
              convergenceRate: attempt / template.generationHints.maxIterations
            },
            qualityScore
          };

          // Keep best result
          if (!bestResult || qualityScore > bestResult.qualityScore) {
            bestResult = result;
          }

          // Early success if quality is very good
          if (qualityScore > 0.8) {
            console.log(`✅ High-quality puzzle generated (score: ${qualityScore.toFixed(3)}) after ${attempt + 1} attempts`);
            break;
          }
        }

        // Show progress occasionally
        if (attempt > 0 && attempt % 25 === 0) {
          console.log(`📊 Progress: ${successfulAttempts}/${totalAttempts} successful (${(successfulAttempts/totalAttempts*100).toFixed(1)}%)`);
        }

      } catch (error) {
        console.warn(`Generation attempt ${attempt + 1} failed:`, error);
      }
    }

    if (!bestResult) {
      // Fallback: return a puzzle even if it doesn't meet all requirements
      console.warn(`⚠️ Failed to generate template-compliant puzzle, using fallback`);
      const config = this.templateToConfig(template);
      const puzzle = this.createSimplePuzzle(config);
      const quality = this.analyzer.analyzeDifficulty(puzzle);

      bestResult = {
        puzzle,
        quality,
        template,
        generationStats: {
          totalAttempts,
          successfulAttempts,
          averageQuality: qualitySum / Math.max(totalAttempts, 1),
          generationTime: performance.now() - startTime,
          templateEffectiveness: 0,
          convergenceRate: 1
        },
        qualityScore: quality.qualityScore
      };
    }

    console.log(`🎉 Template generation complete: ${bestResult.generationStats.successfulAttempts}/${bestResult.generationStats.totalAttempts} successful`);
    return bestResult;
  }

  /**
   * Convert template to PuzzleConfig for base generator
   */
  private templateToConfig(template: PuzzleTemplate): PuzzleConfig {
    const [minClues, maxClues] = template.clueDistribution.totalClues;
    
    return {
      name: template.name,
      startingPiecesMin: minClues,
      startingPiecesMax: maxClues,
      constraintProbability: template.qualityThresholds.minConstraintDensity,
      maxAttempts: 50,
      baseScore: 1000,
      parTime: template.targetDifficulty === DifficultyLevel.EASY ? 300 : 
               template.targetDifficulty === DifficultyLevel.MEDIUM ? 600 : 900,
      parMoves: 50,
      timeWeight: 0.5,
      moveWeight: 0.3
    };
  }

  /**
   * Check if quality meets template requirements
   */
  private meetsTemplateRequirements(quality: PuzzleQuality, template: PuzzleTemplate): boolean {
    return (
      quality.difficultyRating === template.targetDifficulty &&
      quality.uniquenessStrength >= template.qualityThresholds.minUniquenessBoundary &&
      quality.solvingComplexity <= template.qualityThresholds.maxSolvingComplexity &&
      quality.constraintDensity >= template.qualityThresholds.minConstraintDensity &&
      quality.branchingFactor <= template.qualityThresholds.maxBranchingFactor &&
      this.hasRequiredTechniques(quality.requiredTechniques, template.requiredTechniques)
    );
  }

  /**
   * Check if puzzle uses required solving techniques
   */
  private hasRequiredTechniques(usedTechniques: SolvingTechnique[], requiredTechniques: SolvingTechnique[]): boolean {
    // Must use at least 70% of required techniques
    const requiredCount = Math.ceil(requiredTechniques.length * 0.7);
    const matchCount = requiredTechniques.filter(req => usedTechniques.includes(req)).length;
    return matchCount >= requiredCount;
  }

  /**
   * Get available template names
   */
  public getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get template by name
   */
  public getTemplate(name: string): PuzzleTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Generate batch of puzzles from template
   */
  public generateBatch(templateName: string, count: number = 5): GenerationResult[] {
    const results: GenerationResult[] = [];
    
    console.log(`🔨 Generating batch of ${count} puzzles using ${templateName} template`);
    
    for (let i = 0; i < count; i++) {
      try {
        console.log(`\n📝 Generating puzzle ${i + 1}/${count}...`);
        const result = this.generateFromTemplate(templateName);
        results.push(result);
      } catch (error) {
        console.warn(`Batch generation ${i + 1} failed:`, error);
      }
    }
    
    if (results.length > 0) {
      const avgQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;
      const avgTime = results.reduce((sum, r) => sum + r.generationStats.generationTime, 0) / results.length;
      
      console.log(`\n📊 Batch Summary:`);
      console.log(`   Success rate: ${(results.length / count * 100).toFixed(1)}%`);
      console.log(`   Average quality: ${avgQuality.toFixed(3)}`);
      console.log(`   Average time: ${avgTime.toFixed(2)}ms`);
    }
    
    return results;
  }

  /**
   * Create a simple puzzle for template generation
   * This is a minimal implementation to avoid circular dependency with PuzzleGenerator
   */
  private createSimplePuzzle(config: PuzzleConfig): GeneratedPuzzle {
    // Create a basic puzzle structure
    // For now, this is a placeholder that creates a minimal valid puzzle
    const board: PieceType[][] = [];
    const hConstraints: ConstraintType[][] = [];
    const vConstraints: ConstraintType[][] = [];
    const lockedTiles: boolean[][] = [];
    
    // Initialize empty 6x6 board
    for (let i = 0; i < BOARD_SIZE; i++) {
      board[i] = new Array(BOARD_SIZE).fill(PieceType.EMPTY);
      lockedTiles[i] = new Array(BOARD_SIZE).fill(false);
    }
    
    // Initialize constraint arrays (5x6 for h, 6x5 for v)
    for (let i = 0; i < BOARD_SIZE; i++) {
      hConstraints[i] = new Array(BOARD_SIZE - 1).fill(ConstraintType.NONE);
    }
    for (let i = 0; i < BOARD_SIZE - 1; i++) {
      vConstraints[i] = new Array(BOARD_SIZE).fill(ConstraintType.NONE);
    }
    
    // Add some starting pieces based on config
    const targetPieces = Math.floor((config.startingPiecesMin + config.startingPiecesMax) / 2);
    let placedPieces = 0;
    
    // Simple placement strategy - place pieces in a pattern to ensure solvability
    for (let row = 0; row < BOARD_SIZE && placedPieces < targetPieces; row++) {
      for (let col = 0; col < BOARD_SIZE && placedPieces < targetPieces; col++) {
        if ((row + col) % 3 === 0) { // Simple pattern
          board[row][col] = (placedPieces % 2 === 0) ? PieceType.SUN : PieceType.MOON;
          lockedTiles[row][col] = true;
          placedPieces++;
        }
      }
    }
    
    return {
      board,
      hConstraints,
      vConstraints,
      lockedTiles
    };
  }
}
