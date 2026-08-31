<script lang="ts">
  import { gameStore } from '../stores/gameStore.svelte';

  interface Props {
    onstats: () => void;
  }

  let { onstats }: Props = $props();
  const state = $derived(gameStore.state);

  const difficultyOptions = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ];

  function setDifficulty(event: Event): void {
    gameStore.setDifficulty((event.target as HTMLSelectElement).value);
  }
</script>

<nav class="game-dock" aria-label="Game controls">
  <label class="difficulty-picker">
    <span>Level</span>
    <select value={state.difficulty} onchange={setDifficulty} disabled={state.isCreatingGame || state.isMakingMove}>
      {#each difficultyOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </label>

  <div class="dock-actions">
    <button class="dock-button dock-button--primary" onclick={() => gameStore.createGame()} disabled={state.isCreatingGame || state.isMakingMove} aria-label="New puzzle" title="New puzzle">
      <span aria-hidden="true">+</span>
    </button>
    <button class="dock-button" onclick={() => gameStore.resetGame()} disabled={!state.currentGame || state.isCreatingGame || state.isMakingMove} aria-label="Reset puzzle" title="Reset puzzle">
      <span aria-hidden="true">↻</span>
    </button>
    <button class="dock-button" onclick={() => gameStore.undoMove()} disabled={!state.currentGame || state.isMakingMove || state.moveHistory.length === 0} aria-label="Undo move" title="Undo move">
      <span aria-hidden="true">↶</span>
    </button>
    <button class="dock-button" onclick={() => gameStore.getHint()} disabled={!state.currentGame || state.isLoadingHint || state.isMakingMove} aria-label="Show hint" title="Show hint">
      <span aria-hidden="true">?</span>
    </button>
    <button class="dock-button" onclick={onstats} aria-label="Open statistics" title="Statistics">
      <span aria-hidden="true">⋮</span>
    </button>
  </div>
</nav>

{#if state.error}
  <div class="game-error" role="alert">
    <span>{state.error}</span>
    <button onclick={() => gameStore.clearError()} aria-label="Dismiss error">×</button>
  </div>
{/if}

<style>
  .game-dock { position: fixed; z-index: 20; right: 0.75rem; bottom: max(0.75rem, env(safe-area-inset-bottom)); left: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-primary); border-radius: 0.9rem; background: color-mix(in srgb, var(--surface-raised) 92%, transparent); box-shadow: 0 12px 30px var(--shadow-color); backdrop-filter: blur(14px); }
  .difficulty-picker { display: grid; gap: 0.08rem; padding: 0 0.35rem; color: var(--text-secondary); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .difficulty-picker select { min-width: 4.7rem; border: 0; background: transparent; color: var(--text-primary); font: 600 0.9rem Georgia, serif; letter-spacing: 0; text-transform: none; }
  .dock-actions { display: flex; align-items: center; gap: 0.3rem; }
  .dock-button { display: grid; width: 2.55rem; height: 2.55rem; place-items: center; border: 1px solid var(--border-primary); border-radius: 0.65rem; background: transparent; color: var(--text-primary); font: 1.35rem Georgia, serif; }
  .dock-button--primary { border-color: var(--sun-color); background: var(--sun-color); color: #172033; font: 1.7rem Georgia, serif; }
  .dock-button:hover:not(:disabled) { border-color: var(--moon-color); background: var(--surface-hover); }
  .dock-button--primary:hover:not(:disabled) { background: #ffc04a; border-color: #ffc04a; }
  .dock-button:disabled { opacity: 0.35; }
  .game-error { position: fixed; z-index: 30; right: 1rem; bottom: 5rem; left: 1rem; display: flex; justify-content: space-between; gap: 1rem; padding: 0.8rem 1rem; border: 1px solid #e85b65; border-radius: 0.65rem; background: #54252e; color: #ffe7e9; font-size: 0.85rem; }
  .game-error button { border: 0; background: transparent; color: inherit; font-size: 1.2rem; }
  @media (min-width: 760px) { .game-dock { position: static; width: min(100%, 34rem); margin: 1.25rem auto 0; } }
</style>
