/**
 * CDCL (Conflict-Driven Clause Learning) Implementation
 * Handles conflict analysis, clause learning, and backtracking
 */

import type { 
  DomainState, 
  ConflictAnalysis, 
  ConflictClause, 
  Assignment, 
  Literal 
} from './types';
import { PieceType } from '../types';

export class CDCLManager {
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Analyze a conflict and learn a new clause
   */
  analyzeConflict(domainState: DomainState, conflictingVars: string[]): ConflictAnalysis {
    if (!this.enabled) {
      // Fallback to simple chronological backtracking
      return {
        conflictClause: {
          literals: [],
          learnedAt: domainState.decisionLevel,
          activity: 0
        },
        backtrackLevel: Math.max(0, domainState.decisionLevel - 1)
      };
    }

    // Create conflict clause from conflicting variables
    const literals: Literal[] = [];
    let backtrackLevel = 0;

    for (const variable of conflictingVars) {
      const assignment = this.findAssignment(domainState, variable);
      if (assignment) {
        literals.push({
          variable,
          value: assignment.value,
          negated: true // We want the negation of what caused the conflict
        });
        
        if (assignment.decisionLevel > 0) {
          backtrackLevel = Math.max(backtrackLevel, assignment.decisionLevel - 1);
        }
      }
    }

    const conflictClause: ConflictClause = {
      literals,
      learnedAt: domainState.decisionLevel,
      activity: 1.0 // Initialize with base activity
    };

    return {
      conflictClause,
      backtrackLevel
    };
  }

  /**
   * Learn a new clause and add it to the constraint network
   */
  learnClause(domainState: DomainState, clause: ConflictClause): void {
    if (!this.enabled) return;

    // Add clause to learned clauses
    domainState.constraints.learnedClauses.push(clause);

    // Limit the number of learned clauses to prevent memory explosion
    const maxLearnedClauses = 10000;
    if (domainState.constraints.learnedClauses.length > maxLearnedClauses) {
      // Remove oldest/least active clauses
      domainState.constraints.learnedClauses.sort((a, b) => b.activity - a.activity);
      domainState.constraints.learnedClauses = 
        domainState.constraints.learnedClauses.slice(0, maxLearnedClauses * 0.8);
    }
  }

  /**
   * Check learned clauses for unit propagation opportunities
   */
  checkLearnedClauses(domainState: DomainState): string[] {
    if (!this.enabled) return [];

    const unitPropagations: string[] = [];

    for (const clause of domainState.constraints.learnedClauses) {
      const result = this.evaluateClause(domainState, clause);
      
      if (result.isUnit && result.unitVariable) {
        unitPropagations.push(result.unitVariable);
      } else if (result.isConflict) {
        // Clause is unsatisfied - this is a conflict
        return []; // Stop and handle conflict
      }
    }

    return unitPropagations;
  }

  /**
   * Backtrack to a specific decision level
   */
  backtrack(domainState: DomainState, targetLevel: number): void {
    // Remove assignments made after target level
    const assignmentsToRemove: Assignment[] = [];
    
    for (let i = domainState.assignments.length - 1; i >= 0; i--) {
      const assignment = domainState.assignments[i];
      if (assignment.decisionLevel > targetLevel) {
        assignmentsToRemove.push(assignment);
        domainState.assignments.splice(i, 1);
      } else {
        break; // Assignments are in order, so we can stop here
      }
    }

    // Restore domains for removed assignments
    for (const assignment of assignmentsToRemove) {
      const domain = domainState.domains.get(assignment.variable);
      if (domain && !domain.isLocked) {
        // Add back all possible values
        domain.possibleValues.add(PieceType.SUN);
        domain.possibleValues.add(PieceType.MOON);
        domain.decisionLevel = undefined;
        domain.reason = undefined;
      }
    }

    // Update current decision level
    domainState.decisionLevel = targetLevel;
  }

  /**
   * Make a decision assignment
   */
  makeDecision(domainState: DomainState, variable: string, value: PieceType): void {
    // Increment decision level for new decision
    domainState.decisionLevel++;
    
    this.makeAssignment(domainState, variable, value, undefined, true);
  }

  /**
   * Make an assignment (either decision or propagated)
   */
  makeAssignment(
    domainState: DomainState, 
    variable: string, 
    value: PieceType, 
    reason?: ConflictClause,
    isDecision: boolean = false
  ): void {
    const domain = domainState.domains.get(variable);
    if (!domain) return;

    // Clear all other possible values
    domain.possibleValues.clear();
    domain.possibleValues.add(value);
    
    // Set CDCL metadata
    domain.decisionLevel = domainState.decisionLevel;
    domain.reason = reason;

    // Record assignment in trail
    const assignment: Assignment = {
      variable,
      value,
      decisionLevel: domainState.decisionLevel,
      isDecision,
      reason
    };
    
    domainState.assignments.push(assignment);
  }

  /**
   * Detect conflicting variables in current state
   */
  detectConflictVariables(domainState: DomainState): string[] {
    const conflictingVars: string[] = [];

    for (const [variable, domain] of domainState.domains) {
      if (domain.possibleValues.size === 0 && !domain.isLocked) {
        conflictingVars.push(variable);
      }
    }

    return conflictingVars;
  }

  /**
   * Find assignment for a specific variable
   */
  private findAssignment(domainState: DomainState, variable: string): Assignment | null {
    // Search from the end since most recent assignments are at the end
    for (let i = domainState.assignments.length - 1; i >= 0; i--) {
      if (domainState.assignments[i].variable === variable) {
        return domainState.assignments[i];
      }
    }
    return null;
  }

  /**
   * Evaluate a learned clause in the current state
   */
  private evaluateClause(domainState: DomainState, clause: ConflictClause): {
    isUnit: boolean;
    isConflict: boolean;
    isSatisfied: boolean;
    unitVariable?: string;
  } {
    let satisfiedLiterals = 0;
    let unassignedLiterals = 0;
    let unitVariable: string | undefined;

    for (const literal of clause.literals) {
      const domain = domainState.domains.get(literal.variable);
      if (!domain) continue;

      if (domain.possibleValues.size === 1) {
        // Variable is assigned
        const assignedValue = domain.possibleValues.values().next().value;
        const literalSatisfied = literal.negated ? 
          assignedValue !== literal.value : 
          assignedValue === literal.value;
          
        if (literalSatisfied) {
          satisfiedLiterals++;
        }
      } else if (domain.possibleValues.size > 1) {
        // Variable is unassigned
        unassignedLiterals++;
        unitVariable = literal.variable;
      }
    }

    return {
      isUnit: unassignedLiterals === 1 && satisfiedLiterals === 0,
      isConflict: unassignedLiterals === 0 && satisfiedLiterals === 0,
      isSatisfied: satisfiedLiterals > 0,
      unitVariable
    };
  }

  /**
   * Enable or disable CDCL
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if CDCL is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get statistics about learned clauses
   */
  getStatistics(domainState: DomainState): {
    learnedClauses: number;
    totalLiterals: number;
    averageClauseLength: number;
  } {
    const clauses = domainState.constraints.learnedClauses;
    const totalLiterals = clauses.reduce((sum, clause) => sum + clause.literals.length, 0);
    
    return {
      learnedClauses: clauses.length,
      totalLiterals,
      averageClauseLength: clauses.length > 0 ? totalLiterals / clauses.length : 0
    };
  }
}
