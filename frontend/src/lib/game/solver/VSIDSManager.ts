/**
 * VSIDS (Variable State Independent Decaying Sum) Implementation
 * Manages variable ordering and activity scoring for optimal solving performance
 */

import type { VSIDSState, VSIDSConfig, DomainState } from './types';
import { keyToPosition, positionToKey } from './types';

export class VSIDSManager {
  private state: VSIDSState;
  private config: VSIDSConfig;

  constructor(config: VSIDSConfig) {
    this.config = config;
    this.state = this.initializeState();
  }

  private initializeState(): VSIDSState {
    return {
      variableActivities: new Map(),
      activityIncrement: this.config.initialIncrement,
      decayFactor: this.config.decayFactor,
      maxActivity: 0,
      conflictCount: 0,
      lastRescale: 0
    };
  }

  /**
   * Create default VSIDS configuration
   */
  static createDefaultConfig(): VSIDSConfig {
    return {
      enabled: true,
      initialIncrement: 1.0,
      decayFactor: 0.95,
      rescaleThreshold: 1e20,
      rescaleFrequency: 1000
    };
  }

  /**
   * Select the most active unassigned variable using VSIDS heuristic
   */
  selectVariable(domainState: DomainState): string | null {
    if (!this.config.enabled) {
      return this.selectVariableWithHeuristic(domainState);
    }

    let bestVariable: string | null = null;
    let bestActivity = -1;

    for (const [variableKey, domain] of domainState.domains) {
      // Skip variables with no possible values
      if (domain.possibleValues.size === 0) {
        continue;
      }

      // Skip assigned variables (locked variables)
      if (domain.isLocked) {
        continue;
      }

      const activity = this.state.variableActivities.get(variableKey) || 0;
      
      if (activity > bestActivity) {
        bestActivity = activity;
        bestVariable = variableKey;
      }
    }

    return bestVariable;
  }

  /**
   * Fallback variable selection when VSIDS is disabled
   */
  private selectVariableWithHeuristic(domainState: DomainState): string | null {
    let bestVariable: string | null = null;
    let smallestDomainSize = Infinity;

    // Use Most Constraining Variable heuristic (smallest domain first)
    for (const [variableKey, domain] of domainState.domains) {
      if (domain.possibleValues.size > 1 && domain.possibleValues.size < smallestDomainSize) {
        smallestDomainSize = domain.possibleValues.size;
        bestVariable = variableKey;
      }
    }

    return bestVariable;
  }

  /**
   * Increase activity scores for variables involved in conflicts
   */
  bumpVariableActivity(variables: string[]): void {
    if (!this.config.enabled) return;

    for (const variable of variables) {
      const currentActivity = this.state.variableActivities.get(variable) || 0;
      const newActivity = currentActivity + this.state.activityIncrement;
      
      this.state.variableActivities.set(variable, newActivity);
      this.state.maxActivity = Math.max(this.state.maxActivity, newActivity);
    }

    // Check if we need to rescale activities
    if (this.state.maxActivity > this.config.rescaleThreshold ||
        (this.state.conflictCount - this.state.lastRescale) > this.config.rescaleFrequency) {
      this.rescaleActivities();
    }
  }

  /**
   * Decay all variable activities by the decay factor
   */
  decayVariableActivities(): void {
    if (!this.config.enabled) return;

    // Increase the activity increment (making recent conflicts more important)
    this.state.activityIncrement /= this.state.decayFactor;
    this.state.conflictCount++;

    // Periodically decay all activities to prevent overflow
    if (this.state.conflictCount % 255 === 0) {
      let newMaxActivity = 0;
      for (const [variable, activity] of this.state.variableActivities) {
        const newActivity = activity * this.state.decayFactor;
        this.state.variableActivities.set(variable, newActivity);
        newMaxActivity = Math.max(newMaxActivity, newActivity);
      }
      this.state.maxActivity = newMaxActivity;
    }
  }

  /**
   * Rescale all activities when they become too large
   */
  private rescaleActivities(): void {
    const rescaleFactor = 1 / this.config.rescaleThreshold;
    let newMaxActivity = 0;

    console.log(`Rescaling VSIDS activities by factor ${rescaleFactor}`);

    for (const [variable, activity] of this.state.variableActivities) {
      const newActivity = activity * rescaleFactor;
      this.state.variableActivities.set(variable, newActivity);
      newMaxActivity = Math.max(newMaxActivity, newActivity);
    }

    this.state.maxActivity = newMaxActivity;
    this.state.activityIncrement *= rescaleFactor;
    this.state.lastRescale = this.state.conflictCount;
  }

  /**
   * Initialize activities for all variables in the domain
   */
  initializeVariableActivities(domainState: DomainState): void {
    for (const [variableKey] of domainState.domains) {
      if (!this.state.variableActivities.has(variableKey)) {
        this.state.variableActivities.set(variableKey, 0);
      }
    }
  }

  /**
   * Get current VSIDS statistics for debugging
   */
  getStatistics(): {
    conflictCount: number;
    maxActivity: number;
    activityIncrement: number;
    totalVariables: number;
  } {
    return {
      conflictCount: this.state.conflictCount,
      maxActivity: this.state.maxActivity,
      activityIncrement: this.state.activityIncrement,
      totalVariables: this.state.variableActivities.size
    };
  }

  /**
   * Reset VSIDS state (useful when starting a new solving session)
   */
  reset(): void {
    this.state = this.initializeState();
  }

  /**
   * Enable or disable VSIDS
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) {
      this.reset(); // Reset state when enabling
    }
  }

  /**
   * Check if VSIDS is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
