/**
 * Constraint Network Builder and Manager
 * Builds and manages the constraint network for domain-based solving
 */

import type { ConstraintNetwork, DomainState } from './types';
import { PieceType, ConstraintType, BOARD_SIZE } from '../types';

export class ConstraintNetworkManager {
  private size: number = BOARD_SIZE;

  /**
   * Build constraint network from board constraints
   */
  buildConstraintNetwork(
    hConstraints: ConstraintType[][],
    vConstraints: ConstraintType[][]
  ): ConstraintNetwork {
    const directConstraints: Array<{
      pos1: [number, number];
      pos2: [number, number];
      type: ConstraintType;
    }> = [];

    // Build horizontal constraints
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size - 1; col++) {
        if (hConstraints[row][col] !== ConstraintType.NONE) {
          directConstraints.push({
            pos1: [row, col],
            pos2: [row, col + 1],
            type: hConstraints[row][col]
          });
        }
      }
    }

    // Build vertical constraints
    for (let row = 0; row < this.size - 1; row++) {
      for (let col = 0; col < this.size; col++) {
        if (vConstraints[row][col] !== ConstraintType.NONE) {
          directConstraints.push({
            pos1: [row, col],
            pos2: [row + 1, col],
            type: vConstraints[row][col]
          });
        }
      }
    }

    // Build balance constraints
    const balanceConstraints: Array<{
      type: 'row' | 'column';
      index: number;
    }> = [];

    for (let i = 0; i < this.size; i++) {
      balanceConstraints.push({ type: 'row', index: i });
      balanceConstraints.push({ type: 'column', index: i });
    }

    // Build consecutive constraints
    const consecutiveConstraints: Array<{
      positions: Array<[number, number]>;
      direction: 'horizontal' | 'vertical';
    }> = [];

    // Horizontal consecutive constraints (every group of 3 consecutive positions)
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col <= this.size - 3; col++) {
        consecutiveConstraints.push({
          positions: [
            [row, col],
            [row, col + 1],
            [row, col + 2]
          ],
          direction: 'horizontal'
        });
      }
    }

    // Vertical consecutive constraints
    for (let row = 0; row <= this.size - 3; row++) {
      for (let col = 0; col < this.size; col++) {
        consecutiveConstraints.push({
          positions: [
            [row, col],
            [row + 1, col],
            [row + 2, col]
          ],
          direction: 'vertical'
        });
      }
    }

    return {
      directConstraints,
      balanceConstraints,
      consecutiveConstraints,
      learnedClauses: []
    };
  }

  /**
   * Propagate direct SAME/DIFFERENT constraints
   */
  propagateDirectConstraints(domainState: DomainState): boolean {
    let madeProgress = false;

    for (const constraint of domainState.constraints.directConstraints) {
      const domain1 = domainState.domains.get(`${constraint.pos1[0]},${constraint.pos1[1]}`);
      const domain2 = domainState.domains.get(`${constraint.pos2[0]},${constraint.pos2[1]}`);

      if (!domain1 || !domain2) continue;

      if (constraint.type === ConstraintType.SAME) {
        if (this.propagateSameConstraint(domain1, domain2)) {
          madeProgress = true;
        }
      } else if (constraint.type === ConstraintType.DIFFERENT) {
        if (this.propagateDifferentConstraint(domain1, domain2)) {
          madeProgress = true;
        }
      }
    }

    return madeProgress;
  }

  /**
   * Propagate balance constraints (3 SUN, 3 MOON per row/column)
   */
  propagateBalanceConstraints(domainState: DomainState): boolean {
    let madeProgress = false;

    for (const constraint of domainState.constraints.balanceConstraints) {
      if (constraint.type === 'row') {
        if (this.propagateRowBalance(domainState, constraint.index)) {
          madeProgress = true;
        }
      } else {
        if (this.propagateColumnBalance(domainState, constraint.index)) {
          madeProgress = true;
        }
      }
    }

    return madeProgress;
  }

  /**
   * Propagate consecutive constraints (no more than 2 identical adjacent)
   */
  propagateConsecutiveConstraints(domainState: DomainState): boolean {
    let madeProgress = false;

    for (const constraint of domainState.constraints.consecutiveConstraints) {
      if (this.propagateConsecutiveSequence(domainState, constraint.positions)) {
        madeProgress = true;
      }
    }

    return madeProgress;
  }

  /**
   * Propagate SAME constraint between two domains
   */
  private propagateSameConstraint(domain1: any, domain2: any): boolean {
    let madeProgress = false;

    // If one domain is assigned, restrict the other to the same value
    if (domain1.possibleValues.size === 1 && domain2.possibleValues.size > 1) {
      const value = Array.from(domain1.possibleValues)[0];
      if (domain2.possibleValues.has(value)) {
        domain2.possibleValues.clear();
        domain2.possibleValues.add(value);
        madeProgress = true;
      } else {
        // Conflict: domain2 cannot have the required value
        domain2.possibleValues.clear();
        madeProgress = true;
      }
    } else if (domain2.possibleValues.size === 1 && domain1.possibleValues.size > 1) {
      const value = Array.from(domain2.possibleValues)[0];
      if (domain1.possibleValues.has(value)) {
        domain1.possibleValues.clear();
        domain1.possibleValues.add(value);
        madeProgress = true;
      } else {
        // Conflict: domain1 cannot have the required value
        domain1.possibleValues.clear();
        madeProgress = true;
      }
    }

    // Intersection of possible values
    const intersection = new Set<PieceType>();
    for (const value of domain1.possibleValues) {
      if (domain2.possibleValues.has(value)) {
        intersection.add(value);
      }
    }

    if (intersection.size < domain1.possibleValues.size) {
      domain1.possibleValues = intersection;
      madeProgress = true;
    }
    if (intersection.size < domain2.possibleValues.size) {
      domain2.possibleValues = new Set(intersection);
      madeProgress = true;
    }

    return madeProgress;
  }

  /**
   * Propagate DIFFERENT constraint between two domains
   */
  private propagateDifferentConstraint(domain1: any, domain2: any): boolean {
    let madeProgress = false;

    // If one domain is assigned, remove that value from the other
    if (domain1.possibleValues.size === 1 && domain2.possibleValues.size > 1) {
      const value = Array.from(domain1.possibleValues)[0];
      if (domain2.possibleValues.has(value)) {
        domain2.possibleValues.delete(value);
        madeProgress = true;
      }
    } else if (domain2.possibleValues.size === 1 && domain1.possibleValues.size > 1) {
      const value = Array.from(domain2.possibleValues)[0];
      if (domain1.possibleValues.has(value)) {
        domain1.possibleValues.delete(value);
        madeProgress = true;
      }
    }

    return madeProgress;
  }

  /**
   * Propagate balance constraints for a specific row
   */
  private propagateRowBalance(domainState: DomainState, row: number): boolean {
    let madeProgress = false;
    let sunCount = 0;
    let moonCount = 0;
    let unassigned = 0;
    const unassignedPositions: string[] = [];

    // Count current assignments
    for (let col = 0; col < this.size; col++) {
      const domainKey = `${row},${col}`;
      const domain = domainState.domains.get(domainKey);
      
      if (domain?.possibleValues.size === 1) {
        const value = Array.from(domain.possibleValues)[0];
        if (value === PieceType.SUN) sunCount++;
        else if (value === PieceType.MOON) moonCount++;
      } else if (domain && domain.possibleValues.size > 1) {
        unassigned++;
        unassignedPositions.push(domainKey);
      }
    }

    const targetCount = this.size / 2; // Should be 3 for 6x6

    // If we have enough of one type, force remaining unassigned to be the other type
    if (sunCount === targetCount) {
      // Force all unassigned to be MOON
      for (const pos of unassignedPositions) {
        const domain = domainState.domains.get(pos);
        if (domain && domain.possibleValues.has(PieceType.SUN)) {
          domain.possibleValues.delete(PieceType.SUN);
          madeProgress = true;
        }
      }
    } else if (moonCount === targetCount) {
      // Force all unassigned to be SUN
      for (const pos of unassignedPositions) {
        const domain = domainState.domains.get(pos);
        if (domain && domain.possibleValues.has(PieceType.MOON)) {
          domain.possibleValues.delete(PieceType.MOON);
          madeProgress = true;
        }
      }
    }

    return madeProgress;
  }

  /**
   * Propagate balance constraints for a specific column
   */
  private propagateColumnBalance(domainState: DomainState, col: number): boolean {
    let madeProgress = false;
    let sunCount = 0;
    let moonCount = 0;
    let unassigned = 0;
    const unassignedPositions: string[] = [];

    // Count current assignments
    for (let row = 0; row < this.size; row++) {
      const domainKey = `${row},${col}`;
      const domain = domainState.domains.get(domainKey);
      
      if (domain?.possibleValues.size === 1) {
        const value = Array.from(domain.possibleValues)[0];
        if (value === PieceType.SUN) sunCount++;
        else if (value === PieceType.MOON) moonCount++;
      } else if (domain && domain.possibleValues.size > 1) {
        unassigned++;
        unassignedPositions.push(domainKey);
      }
    }

    const targetCount = this.size / 2; // Should be 3 for 6x6

    // If we have enough of one type, force remaining unassigned to be the other type
    if (sunCount === targetCount) {
      // Force all unassigned to be MOON
      for (const pos of unassignedPositions) {
        const domain = domainState.domains.get(pos);
        if (domain && domain.possibleValues.has(PieceType.SUN)) {
          domain.possibleValues.delete(PieceType.SUN);
          madeProgress = true;
        }
      }
    } else if (moonCount === targetCount) {
      // Force all unassigned to be SUN
      for (const pos of unassignedPositions) {
        const domain = domainState.domains.get(pos);
        if (domain && domain.possibleValues.has(PieceType.MOON)) {
          domain.possibleValues.delete(PieceType.MOON);
          madeProgress = true;
        }
      }
    }

    return madeProgress;
  }

  /**
   * Propagate consecutive constraints for a sequence of positions
   */
  private propagateConsecutiveSequence(domainState: DomainState, positions: Array<[number, number]>): boolean {
    let madeProgress = false;

    const domains = positions.map(pos => domainState.domains.get(`${pos[0]},${pos[1]}`));
    
    // Check for patterns like XX_ or _XX that would create XXX
    for (let i = 0; i < positions.length - 2; i++) {
      const domain1 = domains[i];
      const domain2 = domains[i + 1];
      const domain3 = domains[i + 2];

      if (!domain1 || !domain2 || !domain3) continue;

      // Pattern: XX_ (first two assigned and same, third must be different)
      if (domain1.possibleValues.size === 1 && domain2.possibleValues.size === 1 && domain3.possibleValues.size > 1) {
        const value1 = Array.from(domain1.possibleValues)[0];
        const value2 = Array.from(domain2.possibleValues)[0];
        
        if (value1 === value2 && domain3.possibleValues.has(value1)) {
          domain3.possibleValues.delete(value1);
          madeProgress = true;
        }
      }

      // Pattern: _XX (last two assigned and same, first must be different)
      if (domain1.possibleValues.size > 1 && domain2.possibleValues.size === 1 && domain3.possibleValues.size === 1) {
        const value2 = Array.from(domain2.possibleValues)[0];
        const value3 = Array.from(domain3.possibleValues)[0];
        
        if (value2 === value3 && domain1.possibleValues.has(value2)) {
          domain1.possibleValues.delete(value2);
          madeProgress = true;
        }
      }

      // Pattern: X_X (first and third assigned and same, middle must be different)
      if (domain1.possibleValues.size === 1 && domain2.possibleValues.size > 1 && domain3.possibleValues.size === 1) {
        const value1 = Array.from(domain1.possibleValues)[0];
        const value3 = Array.from(domain3.possibleValues)[0];
        
        if (value1 === value3 && domain2.possibleValues.has(value1)) {
          domain2.possibleValues.delete(value1);
          madeProgress = true;
        }
      }
    }

    return madeProgress;
  }
}
