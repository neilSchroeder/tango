/**
 * Game store using Svelte 5 runes for state management
 */

import { GameService } from '../game/GameService';
import { PieceType as LocalPieceType, ConstraintType as LocalConstraintType } from '../game/types';
import { errorStore } from './errorStore.svelte';
import type { 
  GameState, 
  MoveRequest, 
  MoveResponse,
  PieceType,
  ConstraintType, 
  LeaderboardEntry,
  HintResponse
} from '../api/types';

// Local game service instance
const gameService = new GameService();

// Type conversion utilities
function convertPieceTypeToLocal(piece: PieceType): LocalPieceType {
  switch (piece) {
    case 'empty': return LocalPieceType.EMPTY;
    case 'sun': return LocalPieceType.SUN;
    case 'moon': return LocalPieceType.MOON;
    default: return LocalPieceType.EMPTY;
  }
}

function convertPieceTypeFromLocal(piece: LocalPieceType): PieceType {
  switch (piece) {
    case LocalPieceType.EMPTY: return 'empty';
    case LocalPieceType.SUN: return 'sun';
    case LocalPieceType.MOON: return 'moon';
    default: return 'empty';
  }
}

function convertConstraintTypeToLocal(constraint: ConstraintType): LocalConstraintType {
  switch (constraint) {
    case 'none': return LocalConstraintType.NONE;
    case 'same': return LocalConstraintType.SAME;
    case 'different': return LocalConstraintType.DIFFERENT;
    default: return LocalConstraintType.NONE;
  }
}

function convertConstraintTypeFromLocal(constraint: LocalConstraintType): ConstraintType {
  switch (constraint) {
    case LocalConstraintType.NONE: return 'none';
    case LocalConstraintType.SAME: return 'same';
    case LocalConstraintType.DIFFERENT: return 'different';
    default: return 'none';
  }
}

interface GameStore {
  // Current game state
  currentGame: GameState | null;
  
  // Loading states
  isLoading: boolean;
  isCreatingGame: boolean;
  isMakingMove: boolean;
  isLoadingLeaderboard: boolean;
  isLoadingHint: boolean;
  
  // Error states
  error: string | null;
  validationErrors: string[];
  delayedValidationErrors: string[];
  
  // Hint system
  currentHint: HintResponse | null;
  hintHighlight: { row: number; col: number } | null;
  
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  
  // Game timer
  elapsedTime: number;
  
  // Move history for undo functionality
  moveHistory: GameState[];
  initialGameState: GameState | null;
  
  // Game difficulty
  difficulty: string;
  
  // Win celebration
  showWinCelebration: boolean;
  completionTime: string;
  leaderboardPosition: number | null;
}

function createGameStore() {
  // Initialize state using runes
  let state = $state<GameStore>({
    currentGame: null,
    isLoading: false,
    isCreatingGame: false,
    isMakingMove: false,
    isLoadingLeaderboard: false,
    isLoadingHint: false,
    error: null,
    validationErrors: [],
    delayedValidationErrors: [],
    currentHint: null,
    hintHighlight: null,
    leaderboard: [],
    elapsedTime: 0,
    moveHistory: [],
    initialGameState: null,
    difficulty: 'medium',
    showWinCelebration: false,
    completionTime: '',
    leaderboardPosition: null
  });

  // Timer interval reference
  let timerInterval: number | null = null;

  // Error delay timeout reference
  let errorDelayTimeout: number | null = null;

  // Computed values
  const isGameActive = $derived(state.currentGame && !state.currentGame.is_complete);
  const formattedTime = $derived.by(() => {
    const minutes = Math.floor(state.elapsedTime / 60);
    const seconds = state.elapsedTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  // Private helper functions
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
      if (state.currentGame && !state.currentGame.is_complete) {
        const startTime = new Date(state.currentGame.start_time);
        const now = new Date();
        state.elapsedTime = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function clearError() {
    state.error = null;
    state.validationErrors = [];
    state.delayedValidationErrors = [];
    
    // Clear any pending error delay timeout
    if (errorDelayTimeout) {
      clearTimeout(errorDelayTimeout);
      errorDelayTimeout = null;
    }
  }

  // Public API
  async function createGame(difficulty?: string): Promise<void> {
    try {
      clearError();
      state.isCreatingGame = true;
      
      // Update difficulty if provided
      if (difficulty) {
        state.difficulty = difficulty;
      }
      
      // Use local game service with selected difficulty
      const localGameState = gameService.newGame(state.difficulty);
      
      // Convert local game state to API format
      state.currentGame = {
        game_id: crypto.randomUUID(),
        board: localGameState.board.map(row => row.map(convertPieceTypeFromLocal)),
        h_constraints: localGameState.hConstraints.map(row => row.map(convertConstraintTypeFromLocal)),
        v_constraints: localGameState.vConstraints.map(row => row.map(convertConstraintTypeFromLocal)),
        locked_tiles: localGameState.lockedTiles,
        is_complete: localGameState.isComplete,
        start_time: localGameState.startTime.toISOString(),
        completion_time: localGameState.completionTime?.toISOString(),
        moves_count: localGameState.moveCount,
        constraintViolations: new Set(),
        invalidStateTiles: new Set()
      };
      
      // Store initial state for reset functionality
      state.initialGameState = JSON.parse(JSON.stringify(state.currentGame));
      state.moveHistory = [];
      
      state.elapsedTime = 0;
      startTimer();
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'An unexpected error occurred while creating the game';
    } finally {
      state.isCreatingGame = false;
    }
  }

  async function makeMove(row: number, col: number, pieceType: PieceType): Promise<boolean> {
    if (!state.currentGame) {
      state.error = 'No active game';
      return false;
    }

    try {
      clearError();
      clearHint(); // Clear any active hint when making a move
      state.isMakingMove = true;
      
      console.log(`🎮 Making move at (${row}, ${col}) with piece: ${pieceType}`);
      
      // Store current state in move history before making the move
      if (state.currentGame) {
        state.moveHistory.push(JSON.parse(JSON.stringify(state.currentGame)));
      }
      
      // Convert API format back to local format
      const localGameState = {
        gameId: state.currentGame.game_id,
        board: state.currentGame.board.map(row => row.map(convertPieceTypeToLocal)),
        hConstraints: state.currentGame.h_constraints.map(row => row.map(convertConstraintTypeToLocal)),
        vConstraints: state.currentGame.v_constraints.map(row => row.map(convertConstraintTypeToLocal)),
        lockedTiles: state.currentGame.locked_tiles,
        isComplete: state.currentGame.is_complete,
        isValid: true,
        difficulty: 'standard',
        startTime: new Date(state.currentGame.start_time),
        completionTime: state.currentGame.completion_time ? new Date(state.currentGame.completion_time) : undefined,
        moveCount: state.currentGame.moves_count
      };

      // Make the move using local service
      const newLocalGameState = gameService.makeMove(localGameState, row, col, convertPieceTypeToLocal(pieceType));
      
      // Set validation errors for highlighting - with safety check
      state.validationErrors = Array.isArray(newLocalGameState.validationErrors) ? newLocalGameState.validationErrors : [];
      state.delayedValidationErrors = state.validationErrors;
      
      // Convert back to API format
      state.currentGame = {
        game_id: state.currentGame.game_id,
        board: newLocalGameState.board.map(row => row.map(convertPieceTypeFromLocal)),
        h_constraints: newLocalGameState.hConstraints.map(row => row.map(convertConstraintTypeFromLocal)),
        v_constraints: newLocalGameState.vConstraints.map(row => row.map(convertConstraintTypeFromLocal)),
        locked_tiles: newLocalGameState.lockedTiles,
        is_complete: newLocalGameState.isComplete,
        start_time: newLocalGameState.startTime.toISOString(),
        completion_time: newLocalGameState.completionTime?.toISOString(),
        moves_count: newLocalGameState.moveCount,
        constraintViolations: newLocalGameState.constraintViolations || new Set(),
        invalidStateTiles: newLocalGameState.invalidStateTiles || new Set()
      };

      // If game is complete, stop timer and save to leaderboard
      if (newLocalGameState.isComplete) {
        stopTimer();
        
        // Clear validation errors when game is complete
        state.validationErrors = [];
        state.delayedValidationErrors = [];
        
        // Save to local leaderboard
        const entry: LeaderboardEntry = {
          time: state.elapsedTime,
          date: new Date().toISOString(),
          formatted_time: formattedTime
        };
        
        const existingLeaderboard = JSON.parse(localStorage.getItem('tango-leaderboard') || '[]');
        existingLeaderboard.push(entry);
        existingLeaderboard.sort((a: LeaderboardEntry, b: LeaderboardEntry) => a.time - b.time);
        const updatedLeaderboard = existingLeaderboard.slice(0, 10);
        localStorage.setItem('tango-leaderboard', JSON.stringify(updatedLeaderboard));
        
        // Reload leaderboard
        await loadLeaderboard();
        
        // Set up win celebration
        state.completionTime = state.elapsedTime.toString();
        state.leaderboardPosition = updatedLeaderboard.findIndex((lb: LeaderboardEntry) => lb.time === entry.time && lb.date === entry.date) + 1;
        state.showWinCelebration = true;
      }

      console.log(`✅ Move completed successfully. Game state:`, {
        isValid: newLocalGameState.isValid,
        isComplete: newLocalGameState.isComplete,
        errorCount: state.validationErrors.length
      });

      return true;
    } catch (error) {
      console.error('❌ Error in makeMove:', error);
      state.error = error instanceof Error ? error.message : 'Move failed';
      return false;
    } finally {
      state.isMakingMove = false;
    }
  }

  async function loadGame(gameId: string): Promise<void> {
    try {
      clearError();
      state.isLoading = true;
      
      // In static mode, we can't load external games
      // This function is kept for compatibility but doesn't do anything
      state.error = 'Loading saved games is not available in the static version';
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Failed to load game';
    } finally {
      state.isLoading = false;
    }
  }

  async function loadLeaderboard(): Promise<void> {
    try {
      state.isLoadingLeaderboard = true;
      
      // Load leaderboard from localStorage
      const savedLeaderboard = localStorage.getItem('tango-leaderboard');
      state.leaderboard = savedLeaderboard ? JSON.parse(savedLeaderboard) : [];
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Failed to load leaderboard';
    } finally {
      state.isLoadingLeaderboard = false;
    }
  }

  async function getHint(): Promise<void> {
    if (!state.currentGame) {
      state.error = 'No active game to get hint for';
      return;
    }

    try {
      state.isLoadingHint = true;
      clearError();
      
      // Convert API format back to local format
      const localGameState = {
        gameId: state.currentGame.game_id,
        board: state.currentGame.board.map(row => row.map(convertPieceTypeToLocal)),
        hConstraints: state.currentGame.h_constraints.map(row => row.map(convertConstraintTypeToLocal)),
        vConstraints: state.currentGame.v_constraints.map(row => row.map(convertConstraintTypeToLocal)),
        lockedTiles: state.currentGame.locked_tiles,
        isComplete: state.currentGame.is_complete,
        isValid: true,
        difficulty: 'standard',
        startTime: new Date(state.currentGame.start_time),
        completionTime: state.currentGame.completion_time ? new Date(state.currentGame.completion_time) : undefined,
        moveCount: state.currentGame.moves_count
      };
      
      // Get hint from local game service
      const localHint = gameService.getHint(localGameState);
      
      // Convert to API format
      const hintResponse: HintResponse = {
        found: localHint.position !== undefined,
        row: localHint.position?.row,
        col: localHint.position?.col,
        piece_type: localHint.suggestedPiece ? convertPieceTypeFromLocal(localHint.suggestedPiece) : undefined,
        reasoning: localHint.reasoning || localHint.message
      };
      
      state.currentHint = hintResponse;
      
      if (hintResponse.found && hintResponse.row !== undefined && hintResponse.col !== undefined) {
        state.hintHighlight = { row: hintResponse.row, col: hintResponse.col };
        
        // Clear highlight after 5 seconds
        setTimeout(() => {
          state.hintHighlight = null;
        }, 5000);
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Failed to get hint';
    } finally {
      state.isLoadingHint = false;
    }
  }

  function clearHint(): void {
    state.currentHint = null;
    state.hintHighlight = null;
  }

  function resetGame(): void {
    if (!state.initialGameState) {
      state.error = 'No game to reset';
      return;
    }
    
    // Restore to initial state
    state.currentGame = JSON.parse(JSON.stringify(state.initialGameState));
    state.moveHistory = [];
    state.elapsedTime = 0;
    state.validationErrors = [];
    state.delayedValidationErrors = [];
    clearError();
    clearHint();
    
    // Re-validate the reset state and update error highlighting
    if (state.currentGame) {
      const localGameState = {
        gameId: state.currentGame.game_id,
        board: state.currentGame.board.map(row => row.map(convertPieceTypeToLocal)),
        hConstraints: state.currentGame.h_constraints.map(row => row.map(convertConstraintTypeToLocal)),
        vConstraints: state.currentGame.v_constraints.map(row => row.map(convertConstraintTypeToLocal)),
        lockedTiles: state.currentGame.locked_tiles,
        isComplete: state.currentGame.is_complete,
        isValid: true,
        difficulty: 'standard',
        startTime: new Date(state.currentGame.start_time),
        completionTime: state.currentGame.completion_time ? new Date(state.currentGame.completion_time) : undefined,
        moveCount: state.currentGame.moves_count
      };
      
      // Get the current violations for the reset state
      const highlighting = gameService.getHighlightingInfo(localGameState);
      const validation = gameService.validateGameWithErrors(localGameState);
      
      // Update the current game state with fresh violation data
      state.currentGame.constraintViolations = highlighting.constraintViolations || new Set();
      state.currentGame.invalidStateTiles = highlighting.invalidStateTiles || new Set();
      state.validationErrors = validation.errors;
      state.delayedValidationErrors = validation.errors;
      
      // Update error store with fresh data
      errorStore.updateErrors(state.currentGame, validation.errors);
    }
    
    // Restart the timer
    startTimer();
  }

  function undoMove(): void {
    if (state.moveHistory.length === 0) {
      state.error = 'No moves to undo';
      return;
    }
    
    if (!state.currentGame) {
      state.error = 'No active game';
      return;
    }
    
    // Restore the previous state
    const previousState = state.moveHistory.pop();
    if (previousState) {
      state.currentGame = JSON.parse(JSON.stringify(previousState));
      clearError();
      clearHint();
      
      // Re-validate the restored state to get proper error highlighting
      if (state.currentGame) {
        const localGameState = {
          gameId: state.currentGame.game_id,
          board: state.currentGame.board.map(row => row.map(convertPieceTypeToLocal)),
          hConstraints: state.currentGame.h_constraints.map(row => row.map(convertConstraintTypeToLocal)),
          vConstraints: state.currentGame.v_constraints.map(row => row.map(convertConstraintTypeToLocal)),
          lockedTiles: state.currentGame.locked_tiles,
          isComplete: state.currentGame.is_complete,
          isValid: true,
          difficulty: 'standard',
          startTime: new Date(state.currentGame.start_time),
          completionTime: state.currentGame.completion_time ? new Date(state.currentGame.completion_time) : undefined,
          moveCount: state.currentGame.moves_count
        };
        
        // Get the current violations for the restored state
        const highlighting = gameService.getHighlightingInfo(localGameState);
        const validation = gameService.validateGameWithErrors(localGameState);
        
        // Update the current game state with fresh violation data
        state.currentGame.constraintViolations = highlighting.constraintViolations || new Set();
        state.currentGame.invalidStateTiles = highlighting.invalidStateTiles || new Set();
        state.validationErrors = validation.errors;
        state.delayedValidationErrors = validation.errors;
        
        // Update error store with fresh data
        errorStore.updateErrors(state.currentGame, validation.errors);
      }
    }
  }

  // Cleanup function
  function destroy(): void {
    stopTimer();
  }
  
  // Set difficulty
  function setDifficulty(newDifficulty: string): void {
    state.difficulty = newDifficulty;
  }
  
  // Win celebration controls
  function closeWinCelebration(): void {
    state.showWinCelebration = false;
  }
  
  function startNewGameFromCelebration(): void {
    state.showWinCelebration = false;
    createGame();
  }

  return {
    // Reactive state
    get state() { return state; },
    
    // Computed values
    get isGameActive() { return isGameActive; },
    get formattedTime() { return formattedTime; },
    
    // Actions
    createGame,
    makeMove,
    loadGame,
    loadLeaderboard,
    getHint,
    clearHint,
    resetGame,
    undoMove,
    clearError,
    setDifficulty,
    closeWinCelebration,
    startNewGameFromCelebration,
    destroy
  };
}

// Create and export the store instance
export const gameStore = createGameStore();
