/**
 * Constraint Propagator
 * Orchestrates all constraint propagation techniques
 */

import type { DomainState } from './types';
import { ConstraintNetworkManager } from './ConstraintNetworkManager';
import { CDCLManager } from './CDCLManager';

export class ConstraintPropagator {
  private constraintManager: ConstraintNetworkManager;
  private cdclManager: CDCLManager;

  constructor(cdclManager: CDCLManager) {
    this.constraintManager = new ConstraintNetworkManager();
    this.cdclManager = cdclManager;
  }

  /**
   * Apply all constraint propagation techniques
   */
  propagateAllConstraints(domainState: DomainState): boolean {
    let madeProgress = true;
    let totalProgress = false;
    let iterations = 0;
    const maxIterations = 50; // Prevent infinite loops

    while (madeProgress && iterations < maxIterations) {
      madeProgress = false;
      iterations++;

      // Apply different constraint propagation techniques
      if (this.constraintManager.propagateDirectConstraints(domainState)) {
        madeProgress = true;
        totalProgress = true;
      }

      if (this.constraintManager.propagateBalanceConstraints(domainState)) {
        madeProgress = true;
        totalProgress = true;
      }

      if (this.constraintManager.propagateConsecutiveConstraints(domainState)) {
        madeProgress = true;
        totalProgress = true;
      }

      // Check learned clauses for additional propagation
      if (this.cdclManager.isEnabled()) {
        const unitPropagations = this.cdclManager.checkLearnedClauses(domainState);
        if (unitPropagations.length > 0) {
          madeProgress = true;
          totalProgress = true;
        }
      }

      // Check for conflicts and stop if found
      if (this.hasConflicts(domainState)) {
        break;
      }
    }

    if (iterations >= maxIterations) {
      console.warn(`Constraint propagation reached maximum iterations (${maxIterations})`);
    }

    return totalProgress;
  }

  /**
   * Apply only direct SAME/DIFFERENT constraints
   */
  propagateDirectConstraints(domainState: DomainState): boolean {
    return this.constraintManager.propagateDirectConstraints(domainState);
  }

  /**
   * Apply only balance constraints (3 SUN, 3 MOON per row/column)
   */
  propagateBalanceConstraints(domainState: DomainState): boolean {
    return this.constraintManager.propagateBalanceConstraints(domainState);
  }

  /**
   * Apply only consecutive constraints (no more than 2 identical adjacent)
   */
  propagateConsecutiveConstraints(domainState: DomainState): boolean {
    return this.constraintManager.propagateConsecutiveConstraints(domainState);
  }

  /**
   * Check if the domain state has any conflicts
   */
  private hasConflicts(domainState: DomainState): boolean {
    for (const [, domain] of domainState.domains) {
      if (domain.possibleValues.size === 0 && !domain.isLocked) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get detailed information about constraint propagation results
   */
  getPropagationStatistics(): {
    iterations: number;
    technique: string;
    progress: boolean;
  } {
    // This would be enhanced to track statistics in a real implementation
    return {
      iterations: 0,
      technique: 'combined',
      progress: false
    };
  }
}
