
import { 
  PieceType, 
  ConstraintType, 
  BOARD_SIZE, 
  MAX_PIECES_PER_ROW_COL,
  type HintResult 
} from '../types';

import { 
  BaseSolver, 
  type VariableDomain,
  type ConstraintNetwork,
  type Assignment,
  type ConflictClause,
  type Literal,
  type DomainState
} from './BaseSolver';

interface ConflictAnalysis {
  conflictClause: ConflictClause;
  backtrackLevel: number; // Level to backtrack to (non-chronological)
}

export class CDCLSolver extends BaseSolver {

  /**
   * Make a decision assignment at the current decision level
   */
  private makeDecision(domainState: DomainState, variable: string, value: PieceType): void {
    domainState.decisionLevel++;
    const domain = domainState.domains.get(variable);
    if (domain) {
      domain.possibleValues = new Set([value]);
      domain.decisionLevel = domainState.decisionLevel;
      domain.reason = undefined;
    }

    const assignment: Assignment = {
      variable,
      value,
      decisionLevel: domainState.decisionLevel,
      isDecision: true,
      reason: undefined
    };
    domainState.assignments.push(assignment);
  }

  /**
   * Backtrack to a specific decision level
   */
  private backtrack(domainState: DomainState, targetLevel: number): void {
    // Remove assignments beyond the target level
    const newAssignments: Assignment[] = [];
    for (const assignment of domainState.assignments) {
      if (assignment.decisionLevel <= targetLevel) {
        newAssignments.push(assignment);
      } else {
        // Restore domain for this variable
        const domain = domainState.domains.get(assignment.variable);
        if (domain) {
          // Reset to initial possible values (simplified)
          const initialDomain = this.initialDomains.get(assignment.variable);
          if (initialDomain) {
            domain.possibleValues = new Set(initialDomain.possibleValues);
            domain.decisionLevel = 0;
            domain.reason = undefined;
          }
        }
      }
    }

    domainState.assignments = newAssignments;
    domainState.decisionLevel = targetLevel;
  }


    private findSolutionsWithCDCL(
        domainState: DomainState, 
        maxSolutions: number, 
        startTime: number = Date.now(),
        timeout: number = 2000
      ): PieceType[][][] {
        const solutions: PieceType[][][] = [];
        let iterationCount = 0;
        const maxIterations = 10000; // Prevent infinite loops
    
        // Pre-compute variable ordering for better performance
        let variableOrder = this.computeVariableOrder(domainState);
        let nextVarIndex = 0;
    
        // CDCL-based search with optimizations
        while (solutions.length < maxSolutions && iterationCount < maxIterations) {
          iterationCount++;
          
          // Check for timeout every 100 iterations instead of every iteration
          if (iterationCount % 100 === 0 && Date.now() - startTime > timeout) {
            console.warn('Timeout during CDCL solution finding');
            return solutions;
          }
          
          // Check if we have a complete solution
          if (this.isBoardCompleteFromDomain(domainState)) {
            const board = this.domainStateToBoard(domainState);
            solutions.push(board);
            
            // Backtrack to find more solutions
            if (!this.backtrackForNextSolution(domainState)) {
              break; // No more solutions
            }
            
            // Recompute variable order after backtracking
            variableOrder = this.computeVariableOrder(domainState);
            nextVarIndex = 0;
            continue;
          }
    
          // Use pre-computed variable order instead of heuristic selection each time
          const nextVar = this.getNextVariableFromOrder(domainState, variableOrder, nextVarIndex);
          if (!nextVar) {
            // No more variables to assign, backtrack
            if (!this.backtrackForNextSolution(domainState)) {
              break;
            }
            variableOrder = this.computeVariableOrder(domainState);
            nextVarIndex = 0;
            continue;
          }
          nextVarIndex++;
    
          // Try to make a decision
          const domain = domainState.domains.get(nextVar);
          if (!domain || domain.possibleValues.size === 0) {
            // No possible values - conflict
            const conflictResolved = this.handleConflictOptimized(domainState, [nextVar]);
            if (!conflictResolved) {
              break; // Cannot resolve conflict
            }
            
            // Reset variable order after conflict resolution
            variableOrder = this.computeVariableOrder(domainState);
            nextVarIndex = 0;
            continue;
          }
    
          // Use value ordering heuristic (least constraining value first)
          const bestValue = this.selectBestValue(domainState, nextVar);
          this.makeDecision(domainState, nextVar, bestValue);
    
          // Optimized constraint propagation with early termination
          const propagationResult = this.propagateConstraintsOptimized(domainState, nextVar);
          if (!propagationResult.success) {
            // Conflict detected during propagation
            const conflictResolved = this.handleConflictOptimized(domainState, propagationResult.conflictVars);
            if (!conflictResolved) {
              break; // Cannot resolve conflict
            }
            
            // Reset variable order after conflict resolution
            variableOrder = this.computeVariableOrder(domainState);
            nextVarIndex = 0;
          }
        }
    
        if (iterationCount >= maxIterations) {
          console.warn('CDCL reached maximum iterations limit');
        }
    
        return solutions;
      }
    
      /**
       * Pre-compute variable ordering for better performance
       */
      private computeVariableOrder(domainState: DomainState): string[] {
        const unassignedVars: Array<{key: string, domainSize: number, constraintCount: number}> = [];
        
        for (const [key, domain] of domainState.domains) {
          if (!domain.isLocked && domain.possibleValues.size > 1) {
            const constraintCount = this.countConstraintsForVariable(key);
            unassignedVars.push({
              key, 
              domainSize: domain.possibleValues.size,
              constraintCount
            });
          }
        }
        
        // Sort by smallest domain first (MRV), then by most constraints (degree heuristic)
        unassignedVars.sort((a, b) => {
          if (a.domainSize !== b.domainSize) {
            return a.domainSize - b.domainSize; // Minimum Remaining Values
          }
          return b.constraintCount - a.constraintCount; // Maximum Degree
        });
        
        return unassignedVars.map(v => v.key);
      }
    
      /**
       * Get next variable from pre-computed order
       */
      private getNextVariableFromOrder(domainState: DomainState, order: string[], startIndex: number): string | null {
        for (let i = startIndex; i < order.length; i++) {
          const varKey = order[i];
          const domain = domainState.domains.get(varKey);
          if (domain && !domain.isLocked && domain.possibleValues.size > 1) {
            return varKey;
          }
        }
        return null;
      }
    
      /**
       * Count constraints involving a variable (for degree heuristic)
       */
      private countConstraintsForVariable(varKey: string): number {
        const [row, col] = varKey.split(',').map(Number);
        let count = 0;
        
        // Count direct constraints
        for (const constraint of this.constraintNetwork.directConstraints) {
          if ((constraint.pos1[0] === row && constraint.pos1[1] === col) ||
              (constraint.pos2[0] === row && constraint.pos2[1] === col)) {
            count++;
          }
        }
        
        // Add balance and consecutive constraints (simplified count)
        count += 2; // Row and column balance constraints
        count += this.getConsecutiveConstraintCount(row, col);
        
        return count;
      }
    
      private getConsecutiveConstraintCount(row: number, col: number): number {
        let count = 0;
        // Horizontal consecutive constraints involving this position
        for (let startCol = Math.max(0, col - 2); startCol <= Math.min(this.size - 3, col); startCol++) {
          if (startCol <= col && col <= startCol + 2) count++;
        }
        // Vertical consecutive constraints involving this position
        for (let startRow = Math.max(0, row - 2); startRow <= Math.min(this.size - 3, row); startRow++) {
          if (startRow <= row && row <= startRow + 2) count++;
        }
        return count;
      }
    
      /**
       * Select best value using least constraining value heuristic
       */
      private selectBestValue(domainState: DomainState, varKey: string): PieceType {
        const domain = domainState.domains.get(varKey);
        if (!domain || domain.possibleValues.size === 0) {
          throw new Error('No values available');
        }
        
        if (domain.possibleValues.size === 1) {
          return Array.from(domain.possibleValues)[0];
        }
        
        // Use least constraining value heuristic
        const values = Array.from(domain.possibleValues);
        let bestValue = values[0];
        let leastConstraining = Infinity;
        
        for (const value of values) {
          const constrainingScore = this.calculateConstrainingScore(domainState, varKey, value);
          if (constrainingScore < leastConstraining) {
            leastConstraining = constrainingScore;
            bestValue = value;
          }
        }
        
        return bestValue;
      }
    
      /**
       * Calculate how constraining a value assignment would be
       */
      private calculateConstrainingScore(domainState: DomainState, varKey: string, value: PieceType): number {
        let score = 0;
        const [row, col] = varKey.split(',').map(Number);
        
        // Check impact on neighboring variables
        const neighbors = [
          [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
        ];
        
        for (const [r, c] of neighbors) {
          if (r >= 0 && r < this.size && c >= 0 && c < this.size) {
            const neighborKey = `${r},${c}`;
            const neighborDomain = domainState.domains.get(neighborKey);
            if (neighborDomain && !neighborDomain.isLocked && neighborDomain.possibleValues.size > 1) {
              // Estimate how many values this assignment would eliminate from neighbor
              score += this.estimateValueReduction(domainState, neighborKey, varKey, value);
            }
          }
        }
        
        return score;
      }
    
      private estimateValueReduction(domainState: DomainState, neighborKey: string, assignedKey: string, value: PieceType): number {
        // Simple heuristic: if there's a constraint between them, it may reduce options
        const [r1, c1] = assignedKey.split(',').map(Number);
        const [r2, c2] = neighborKey.split(',').map(Number);
        
        // Check if there's a direct constraint
        for (const constraint of this.constraintNetwork.directConstraints) {
          if ((constraint.pos1[0] === r1 && constraint.pos1[1] === c1 && constraint.pos2[0] === r2 && constraint.pos2[1] === c2) ||
              (constraint.pos1[0] === r2 && constraint.pos1[1] === c2 && constraint.pos2[0] === r1 && constraint.pos2[1] === c1)) {
            return constraint.type === ConstraintType.SAME ? 1 : 1; // Either way reduces by ~1 value
          }
        }
        
        return 0;
      }
    
      /**
       * Optimized constraint propagation with incremental updates
       */
      private propagateConstraintsOptimized(domainState: DomainState, changedVar?: string): {
        success: boolean;
        conflictVars: string[];
      } {
        const changedVars = new Set<string>();
        if (changedVar) {
          changedVars.add(changedVar);
        }
        
        let iterations = 0;
        const maxIterations = 20; // Reduced from 50
        
        while (changedVars.size > 0 && iterations < maxIterations) {
          iterations++;
          const currentVar = Array.from(changedVars)[0];
          changedVars.delete(currentVar);
          
          // Only propagate constraints involving the changed variable
          const newChanges = this.propagateForVariable(domainState, currentVar);
          if (newChanges.conflicts.length > 0) {
            return { success: false, conflictVars: newChanges.conflicts };
          }
          
          // Add newly changed variables to the queue
          for (const newVar of newChanges.changed) {
            changedVars.add(newVar);
          }
        }
        
        return { success: true, conflictVars: [] };
      }
    
      /**
       * Propagate constraints for a specific variable
       */
      private propagateForVariable(domainState: DomainState, varKey: string): {
        changed: string[];
        conflicts: string[];
      } {
        const changed: string[] = [];
        const conflicts: string[] = [];
        const [row, col] = varKey.split(',').map(Number);
        
        // Get affected variables (neighbors and constraint-connected variables)
        const affectedVars = this.getAffectedVariables(domainState, row, col);
        
        for (const affectedVar of affectedVars) {
          const domain = domainState.domains.get(affectedVar);
          if (!domain || domain.isLocked) continue;
          
          const oldSize = domain.possibleValues.size;
          
          // Apply constraints specific to this variable pair
          this.applyConstraintsBetween(domainState, varKey, affectedVar);
          
          if (domain.possibleValues.size === 0) {
            conflicts.push(affectedVar);
          } else if (domain.possibleValues.size !== oldSize) {
            changed.push(affectedVar);
          }
        }
        
        return { changed, conflicts };
      }
    
      private getAffectedVariables(domainState: DomainState, row: number, col: number): string[] {
        const affected = new Set<string>();
        
        // Add same row and column variables
        for (let c = 0; c < this.size; c++) {
          if (c !== col) affected.add(`${row},${c}`);
        }
        for (let r = 0; r < this.size; r++) {
          if (r !== row) affected.add(`${r},${col}`);
        }
        
        // Add variables connected by direct constraints
        const varKey = `${row},${col}`;
        for (const constraint of this.constraintNetwork.directConstraints) {
          if (constraint.pos1[0] === row && constraint.pos1[1] === col) {
            affected.add(`${constraint.pos2[0]},${constraint.pos2[1]}`);
          } else if (constraint.pos2[0] === row && constraint.pos2[1] === col) {
            affected.add(`${constraint.pos1[0]},${constraint.pos1[1]}`);
          }
        }
        
        return Array.from(affected);
      }
    
      private applyConstraintsBetween(domainState: DomainState, var1Key: string, var2Key: string): void {
        const domain1 = domainState.domains.get(var1Key);
        const domain2 = domainState.domains.get(var2Key);
        
        if (!domain1 || !domain2 || domain1.isLocked || domain2.isLocked) return;
        
        // Apply direct constraints, balance constraints, and consecutive constraints
        // This is a simplified version - the full implementation would check each constraint type
        
        // If one domain has a single value, apply constraints to the other
        if (domain1.possibleValues.size === 1 && domain2.possibleValues.size > 1) {
          const value1 = Array.from(domain1.possibleValues)[0];
          // Apply constraint logic (this would need the full constraint checking logic)
          // For now, just ensure they don't violate basic rules
        }
      }
    
      /**
       * Optimized conflict handling with better learning
       */
      private handleConflictOptimized(domainState: DomainState, conflictVars: string[]): boolean {
        if (conflictVars.length === 0) {
          return false;
        }
    
        // Simple conflict resolution: just backtrack without complex clause learning
        // This is much faster than full CDCL analysis
        const lastAssignment = this.findLastDecision(domainState);
        if (!lastAssignment) {
          return false; // No decisions to backtrack
        }
    
        // Backtrack one level
        this.backtrack(domainState, lastAssignment.decisionLevel - 1);
        
        // Try to eliminate the value that caused the conflict
        const domain = domainState.domains.get(lastAssignment.variable);
        if (domain && domain.possibleValues.has(lastAssignment.value)) {
          domain.possibleValues.delete(lastAssignment.value);
        }
        
        return true;
      }
    
      private findLastDecision(domainState: DomainState): Assignment | null {
        for (let i = domainState.assignments.length - 1; i >= 0; i--) {
          if (domainState.assignments[i].isDecision) {
            return domainState.assignments[i];
          }
        }
        return null;
      }

      /**
         * Backtrack to find the next solution
         */
        private backtrackForNextSolution(domainState: DomainState): boolean {
          // Find the most recent decision
          let lastDecisionIndex = -1;
          for (let i = domainState.assignments.length - 1; i >= 0; i--) {
            if (domainState.assignments[i].isDecision) {
              lastDecisionIndex = i;
              break;
            }
          }
      
          if (lastDecisionIndex === -1) {
            return false; // No decisions to backtrack
          }
      
          const lastDecision = domainState.assignments[lastDecisionIndex];
          const domain = domainState.domains.get(lastDecision.variable);
          
          if (!domain) {
            return false;
          }
      
          // Backtrack to before this decision
          this.backtrack(domainState, lastDecision.decisionLevel - 1);
          
          // Try next value for this variable
          const remainingValues = Array.from(domain.possibleValues).filter(v => v !== lastDecision.value);
          
          if (remainingValues.length > 0) {
            // Try next value
            this.makeDecision(domainState, lastDecision.variable, remainingValues[0]);
            return true;
          } else {
            // No more values, continue backtracking
            return this.backtrackForNextSolution(domainState);
          }
        }
      
        /**
         * Traditional backtracking-based solution finding (fallback when CDCL is disabled)
         */
        private findSolutionsWithBacktracking(
          domainState: DomainState, 
          maxSolutions: number,
          startTime: number = Date.now(),
          timeout: number = 2000
        ): PieceType[][][] {
          const solutions: PieceType[][][] = [];
      
          // Find unassigned variables
          const unassignedVars = this.getUnassignedVariablesDomain(domainState);
          
          // Use traditional backtracking
          const backtrack = (varIndex: number): void => {
            // Check for timeout
            if (Date.now() - startTime > timeout) {
              console.warn('Timeout during backtracking solution finding');
              return;
            }
            
            if (solutions.length >= maxSolutions) {
              return;
            }
      
            if (varIndex === unassignedVars.length) {
              // All variables assigned - check if solution is complete
              const board = this.domainStateToBoard(domainState);
              if (this.isBoardCompleteFromDomain(domainState)) {
                solutions.push(board);
              }
              return;
            }
      
            const varKey = unassignedVars[varIndex];
            const domain = domainState.domains.get(varKey);
            
            if (!domain || domain.isLocked) {
              backtrack(varIndex + 1);
              return;
            }
      
            // Try each possible value in domain
            const possibleValues = Array.from(domain.possibleValues);
            
            for (const value of possibleValues) {
              // Create backup of domain state
              const domainBackup = this.backupDomainState(domainState);
              
              // Assign value
              domain.possibleValues = new Set([value]);
              
              // Propagate constraints
              if (this.propagateConstraintsDomain(domainState)) {
                backtrack(varIndex + 1);
              }
              
              // Restore domain state
              this.restoreDomainState(domainState, domainBackup);
            }
          };
      
          backtrack(0);
          return solutions;
        }

      /**
       * Get unassigned variables from domain state
       */
      private getUnassignedVariablesDomain(domainState: DomainState): string[] {
        const unassigned: string[] = [];
        
        for (const [key, domain] of domainState.domains) {
          if (!domain.isLocked && domain.possibleValues.size > 1) {
            unassigned.push(key);
          }
        }
        
        // Sort by domain size (smallest first) for better performance
        unassigned.sort((a, b) => {
          const domainA = domainState.domains.get(a);
          const domainB = domainState.domains.get(b);
          
          if (!domainA || !domainB) return 0;
          return domainA.possibleValues.size - domainB.possibleValues.size;
        });
        
        return unassigned;
      }
    
      /**
       * Check if board is complete from domain state
       */
      private isBoardCompleteFromDomain(domainState: DomainState): boolean {
        for (const [key, domain] of domainState.domains) {
          if (!domain.isLocked && domain.possibleValues.size !== 1) {
            return false;
          }
        }
        return true;
      }
    
      /**
       * Create backup of domain state for backtracking
       */
      private backupDomainState(domainState: DomainState): Map<string, Set<PieceType>> {
        const backup = new Map<string, Set<PieceType>>();
        
        for (const [key, domain] of domainState.domains) {
          backup.set(key, new Set(domain.possibleValues));
        }
        
        return backup;
      }
    
      /**
       * Restore domain state from backup
       */
      private restoreDomainState(domainState: DomainState, backup: Map<string, Set<PieceType>>): void {
        for (const [key, possibleValues] of backup) {
          const domain = domainState.domains.get(key);
          if (domain) {
            domain.possibleValues = new Set(possibleValues);
          }
        }
      }

      /**
       * Find all valid solutions using CDCL-based solving
       */
      findAllSolutions(maxSolutions: number = 10): PieceType[][][] {
        const startTime = Date.now();
        const timeout = 2000; // 2 seconds timeout

        const domainState = this.createDomainState();

        // Apply initial constraint propagation
        if (!this.propagateConstraintsDomain(domainState)) {
          return []; // No solutions possible
        }

        // Check for timeout
        if (Date.now() - startTime > timeout) {
          console.warn('Timeout during initial constraint propagation');
          return [];
        }

        // Use CDCL-based search
        return this.findSolutionsWithCDCL(domainState, maxSolutions, startTime, timeout);
      }

      /**
       * Get a hint for the next logical move
       */
      getHint(): HintResult {
        const domainState = this.createDomainState();

        // Apply constraint propagation to find forced moves
        this.propagateConstraintsDomain(domainState);

        // Find the first position that has only one possible value
        for (const [key, domain] of domainState.domains) {
          if (!domain.isLocked && domain.possibleValues.size === 1) {
            const [row, col] = domain.position;
            const piece = Array.from(domain.possibleValues)[0];
            
            return {
              found: true,
              row,
              col,
              pieceType: piece,
              reasoning: this.generateHintReasoning(domainState, key, piece),
              confidence: 0.9,
              hintType: 'logical_deduction',
              educationalValue: 'high'
            };
          }
        }

        // If no forced moves, find the position with the smallest domain
        let bestKey: string | null = null;
        let smallestDomain = Infinity;
        
        for (const [key, domain] of domainState.domains) {
          if (!domain.isLocked && domain.possibleValues.size > 1 && domain.possibleValues.size < smallestDomain) {
            smallestDomain = domain.possibleValues.size;
            bestKey = key;
          }
        }

        if (bestKey) {
          const domain = domainState.domains.get(bestKey);
          if (domain) {
            const [row, col] = domain.position;
            const piece = Array.from(domain.possibleValues)[0]; // Take first possible value
            
            return {
              found: true,
              row,
              col,
              pieceType: piece,
              reasoning: `This position has the fewest possible values (${domain.possibleValues.size} options).`,
              confidence: 0.5,
              hintType: 'strategic_guidance',
              educationalValue: 'medium'
            };
          }
        }

        return {
          found: false,
          reasoning: "No logical moves found.",
          confidence: 0,
          hintType: 'none',
          educationalValue: 'low'
        };
      }

      /**
       * Generate reasoning for a hint
       */
      protected generateHintReasoning(domainState: DomainState, varKey: string, piece: PieceType): string {
        const [row, col] = varKey.split(',').map(Number);
        
        // Check for constraint-based reasoning
        for (const constraint of domainState.constraints.directConstraints) {
          const isPos1 = constraint.pos1[0] === row && constraint.pos1[1] === col;
          const isPos2 = constraint.pos2[0] === row && constraint.pos2[1] === col;
          
          if (isPos1 || isPos2) {
            const otherPos = isPos1 ? constraint.pos2 : constraint.pos1;
            const otherKey = `${otherPos[0]},${otherPos[1]}`;
            const otherDomain = domainState.domains.get(otherKey);
            
            if (otherDomain && otherDomain.possibleValues.size === 1) {
              const otherPiece = Array.from(otherDomain.possibleValues)[0];
              const symbol = constraint.type === ConstraintType.SAME ? '=' : '×';
              
              if (constraint.type === ConstraintType.SAME) {
                return `Must be ${piece === PieceType.SUN ? 'Sun' : 'Moon'} due to '${symbol}' constraint with position (${otherPos[0] + 1}, ${otherPos[1] + 1}) which is ${otherPiece === PieceType.SUN ? 'Sun' : 'Moon'}.`;
              } else {
                return `Must be ${piece === PieceType.SUN ? 'Sun' : 'Moon'} due to '${symbol}' constraint with position (${otherPos[0] + 1}, ${otherPos[1] + 1}) which is ${otherPiece === PieceType.SUN ? 'Sun' : 'Moon'}.`;
              }
            }
          }
        }

        // Check for balance-based reasoning
        const rowCounts = this.countPiecesInRowDomain(domainState, row);
        const colCounts = this.countPiecesInColumnDomain(domainState, col);
        
        if (piece === PieceType.SUN) {
          if (rowCounts.moons >= MAX_PIECES_PER_ROW_COL) {
            return `Must be Sun because row ${row + 1} already has ${rowCounts.moons} Moons.`;
          }
          if (colCounts.moons >= MAX_PIECES_PER_ROW_COL) {
            return `Must be Sun because column ${col + 1} already has ${colCounts.moons} Moons.`;
          }
        } else if (piece === PieceType.MOON) {
          if (rowCounts.suns >= MAX_PIECES_PER_ROW_COL) {
            return `Must be Moon because row ${row + 1} already has ${rowCounts.suns} Suns.`;
          }
          if (colCounts.suns >= MAX_PIECES_PER_ROW_COL) {
            return `Must be Moon because column ${col + 1} already has ${colCounts.suns} Suns.`;
          }
        }

        return `Only possible value based on constraint propagation.`;
      }

      /**
       * Count pieces in a row from domain state
       */
      protected countPiecesInRowDomain(domainState: DomainState, row: number): { suns: number; moons: number; empty: number } {
        let suns = 0;
        let moons = 0;
        let empty = 0;

        for (let col = 0; col < this.size; col++) {
          const key = `${row},${col}`;
          const domain = domainState.domains.get(key);
          
          if (domain && domain.possibleValues.size === 1) {
            const piece = Array.from(domain.possibleValues)[0];
            if (piece === PieceType.SUN) suns++;
            else if (piece === PieceType.MOON) moons++;
          } else {
            empty++;
          }
        }

        return { suns, moons, empty };
      }

      /**
       * Count pieces in a column from domain state
       */
      protected countPiecesInColumnDomain(domainState: DomainState, col: number): { suns: number; moons: number; empty: number } {
        let suns = 0;
        let moons = 0;
        let empty = 0;

        for (let row = 0; row < this.size; row++) {
          const key = `${row},${col}`;
          const domain = domainState.domains.get(key);
          
          if (domain && domain.possibleValues.size === 1) {
            const piece = Array.from(domain.possibleValues)[0];
            if (piece === PieceType.SUN) suns++;
            else if (piece === PieceType.MOON) moons++;
          } else {
            empty++;
          }
        }

        return { suns, moons, empty };
      }
}