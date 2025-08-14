<script lang="ts">
  import type { PieceType, ConstraintType } from '../api/types';
  import { gameStore } from '../stores/gameStore.svelte';
  import { getPieceSymbol, getConstraintSymbol, getNextPiece } from '../utils/gameUtils';

  interface Props {
    row: number;
    col: number;
    piece: PieceType;
    isLocked: boolean;
    horizontalConstraint?: ConstraintType;
    verticalConstraint?: ConstraintType;
    hasError?: boolean;
    hasConstraintViolation?: boolean;
    isHinted?: boolean;
  }
  
  let { 
    row, 
    col, 
    piece, 
    isLocked, 
    horizontalConstraint = 'none', 
    verticalConstraint = 'none',
    hasError = false,
    hasConstraintViolation = false,
    isHinted = false
  }: Props = $props();

  // Add debouncing to prevent rapid clicks
  let isProcessingClick = false;

  async function handleClick() {
    if (isLocked || gameStore.state.isMakingMove || isProcessingClick) return;
    
    try {
      isProcessingClick = true;
      const nextPiece = getNextPiece(piece);
      console.log(`🎯 Making move at (${row}, ${col}) with piece: ${nextPiece}`);
      await gameStore.makeMove(row, col, nextPiece);
    } catch (error) {
      console.error('❌ Error in handleClick:', error);
      // Prevent infinite loops by not re-throwing
    } finally {
      // Reset the processing flag after a small delay
      setTimeout(() => {
        isProcessingClick = false;
      }, 100);
    }
  }

  // Compute CSS classes
  const tileClasses = $derived(() => {
    let classes = ['game-tile'];
    
    if (piece === 'sun') classes.push('game-tile--sun');
    if (piece === 'moon') classes.push('game-tile--moon');
    if (hasConstraintViolation) classes.push('game-tile--constraint-violation');
    else if (hasError) classes.push('game-tile--error');
    if (isHinted) classes.push('game-tile--hinted');
    
    return classes.join(' ');
  });
</script>

<div class="relative">
  <button
    class={tileClasses()}
    onclick={handleClick}
    disabled={isLocked || gameStore.state.isMakingMove}
    aria-label="Game tile at row {row + 1}, column {col + 1}: {piece}"
  >
    <span class="game-piece">
      {getPieceSymbol(piece)}
    </span>
  </button>

  {#if horizontalConstraint !== 'none'}
    <div class="constraint constraint--horizontal">
      {getConstraintSymbol(horizontalConstraint)}
    </div>
  {/if}

  {#if verticalConstraint !== 'none'}
    <div class="constraint constraint--vertical">
      {getConstraintSymbol(verticalConstraint)}
    </div>
  {/if}
</div>
