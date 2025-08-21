/**
 * Core interfaces and types for the Tango board solver components
 */

import { PieceType, ConstraintType } from '../types';

/**
 * Domain-based constraint system with CDCL (Conflict-Driven Clause Learning)
 */
export interface VariableDomain {
  position: [number, number];
  possibleValues: Set<PieceType>;
  isLocked: boolean;
  decisionLevel?: number; // For CDCL: track when this assignment was made
  reason?: ConflictClause; // For CDCL: why this value was assigned
}

export interface DomainState {
  domains: Map<string, VariableDomain>;
  constraints: ConstraintNetwork;
  decisionLevel: number; // Current decision level for CDCL
  assignments: Assignment[]; // Assignment trail for CDCL
}

export interface ConstraintNetwork {
  directConstraints: Array<{
    pos1: [number, number];
    pos2: [number, number];
    type: ConstraintType;
  }>;
  balanceConstraints: Array<{
    type: 'row' | 'column';
    index: number;
  }>;
  consecutiveConstraints: Array<{
    positions: Array<[number, number]>;
    direction: 'horizontal' | 'vertical';
  }>;
  learnedClauses: ConflictClause[]; // CDCL: Learned conflict clauses
}

/**
 * CDCL (Conflict-Driven Clause Learning) Components
 */
export interface Assignment {
  variable: string; // Position key
  value: PieceType;
  decisionLevel: number;
  isDecision: boolean; // true if decision, false if propagated
  reason?: ConflictClause; // Why this assignment was made (for propagated assignments)
}

export interface ConflictClause {
  literals: Literal[]; // Variables that must not all be true simultaneously
  learnedAt: number; // Decision level when this clause was learned
  activity: number; // For clause deletion heuristics
}

export interface Literal {
  variable: string; // Position key
  value: PieceType;
  negated: boolean; // true = "variable must NOT be value", false = "variable must be value"
}

export interface ConflictAnalysis {
  conflictClause: ConflictClause;
  backtrackLevel: number; // Level to backtrack to (non-chronological)
}

/**
 * VSIDS (Variable State Independent Decaying Sum) Components
 */
export interface VSIDSState {
  variableActivities: Map<string, number>; // Activity scores for each variable
  activityIncrement: number; // Current increment for activity bumps
  decayFactor: number; // Factor by which activities decay (0.95 typical)
  maxActivity: number; // Threshold for rescaling activities
  conflictCount: number; // Number of conflicts encountered
  lastRescale: number; // Last conflict count when activities were rescaled
}

export interface VSIDSConfig {
  enabled: boolean;
  initialIncrement: number; // Starting activity increment (1.0 typical)
  decayFactor: number; // Activity decay factor (0.95 typical)
  rescaleThreshold: number; // Rescale when max activity exceeds this (1e20 typical)
  rescaleFrequency: number; // Rescale every N conflicts if needed (1000 typical)
}

/**
 * Solver configuration options
 */
export interface SolverConfig {
  useDomainBasedSolving: boolean;
  useCDCL: boolean;
  useVSIDS: boolean;
  maxIterations: number;
  maxSolutions: number;
}

/**
 * Solving results and diagnostics
 */
export interface SolverResult {
  solutions: PieceType[][][];
  method: string;
  iterations: number;
  conflicts: number;
  timeMs: number;
}

/**
 * Position utilities
 */
export function positionToKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function keyToPosition(key: string): [number, number] {
  const [row, col] = key.split(',').map(Number);
  return [row, col];
}

export function positionsEqual(pos1: [number, number], pos2: [number, number]): boolean {
  return pos1[0] === pos2[0] && pos1[1] === pos2[1];
}
