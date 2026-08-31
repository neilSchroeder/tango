<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import GameBoard from '$lib/components/GameBoard.svelte';
  import GameControls from '$lib/components/GameControls.svelte';
  import Leaderboard from '$lib/components/Leaderboard.svelte';
  import StatsSheet from '$lib/components/StatsSheet.svelte';
  import HintDisplay from '$lib/components/HintDisplay.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import ConfettiAnimation from '$lib/components/ConfettiAnimation.svelte';
  import WinCelebration from '$lib/components/WinCelebration.svelte';
  import { gameStore } from '$lib/stores/gameStore.svelte';

  // Access state reactively using Svelte 5 runes
  const gameState = $derived(gameStore.state);
  let statsOpen = $state(false);

  // Load leaderboard on mount
  onMount(() => {
    gameStore.loadLeaderboard();
  });

  // Cleanup on destroy
  onDestroy(() => {
    gameStore.destroy();
  });

  function handleCloseCelebration() {
    gameStore.closeWinCelebration();
  }

  function handleNewGameFromCelebration() {
    gameStore.startNewGameFromCelebration();
  }
</script>

<svelte:head>
  <title>Tango Puzzle Game</title>
  <meta name="description" content="A challenging logic puzzle game with suns and moons" />
</svelte:head>

<main class="app-shell">
  <div class="game-shell">
    <header class="app-header">
      <div class="brand-mark" aria-hidden="true"><span>●</span><i>◐</i></div>
      <div class="brand-copy">
        <p>Six by six logic</p>
        <h1>Tango</h1>
      </div>
      <div class="header-actions">
        <button class="stats-button" onclick={() => statsOpen = true} aria-label="Open statistics" title="Statistics">⋮</button>
        <ThemeToggle />
      </div>
    </header>

    <section class="game-stage">
      <GameBoard />
    </section>
    <GameControls />

    {#if gameState.currentHint}
      <HintDisplay hint={gameState.currentHint} onclose={() => gameStore.clearHint()} />
    {/if}
    <StatsSheet open={statsOpen} onclose={() => statsOpen = false} />

    <footer>
      <a href="https://github.com" target="_blank" rel="noopener noreferrer">Source</a>
      <span>•</span>
      <span>Made for small screens</span>
    </footer>
    </div>
</main>

<!-- Win celebration components - rendered outside main to avoid stacking context issues -->
{#if gameState.showWinCelebration}
  <ConfettiAnimation />
{/if}

{#if gameState.currentGame && gameState.showWinCelebration}
  <WinCelebration 
    game={gameState.currentGame}
    difficulty={gameState.difficulty}
    completionTime={gameState.completionTime}
    leaderboardPosition={gameState.leaderboardPosition}
    isVisible={gameState.showWinCelebration}
    onclose={handleCloseCelebration}
    onnewgame={handleNewGameFromCelebration}
  />
{/if}
