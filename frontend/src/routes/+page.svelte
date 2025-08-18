<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import GameBoard from '$lib/components/GameBoard.svelte';
  import GameControls from '$lib/components/GameControls.svelte';
  import Leaderboard from '$lib/components/Leaderboard.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import ConfettiAnimation from '$lib/components/ConfettiAnimation.svelte';
  import WinCelebration from '$lib/components/WinCelebration.svelte';
  import { gameStore } from '$lib/stores/gameStore.svelte';

  // Access state reactively using Svelte 5 runes
  const state = $derived(gameStore.state);

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

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 p-2 sm:p-4 transition-colors duration-300">
  <div class="container mx-auto max-w-7xl">
    <!-- Header -->
    <header class="text-center mb-4 sm:mb-6 relative">
      <!-- Theme toggle in top right -->
      <div class="absolute top-0 right-0">
        <ThemeToggle />
      </div>
      
      <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-2 transition-colors duration-300">
        🌞 Tango Puzzle 🌙
      </h1>
      <p class="text-gray-600 dark:text-gray-400 text-sm sm:text-base md:text-lg transition-colors duration-300">
        Place suns and moons following the rules to complete the puzzle
      </p>
    </header>

    <!-- Main game layout -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 items-start">
      <!-- Game controls (left sidebar on large screens, top on mobile) -->
      <div class="lg:order-1 order-2 lg:col-span-1">
        <GameControls />
      </div>

      <!-- Game board (center) -->
      <div class="lg:order-2 order-1 lg:col-span-3">
        <GameBoard />
      </div>

      <!-- Leaderboard (right sidebar) -->
      <div class="lg:order-3 order-3 lg:col-span-1">
        <Leaderboard />
      </div>
    </div>

    <!-- Footer -->
    <footer class="text-center mt-6 sm:mt-8 text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
      <p>
        Built with SvelteKit and FastAPI | 
        <a 
          href="https://github.com" 
          class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors duration-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Source
        </a>
      </p>
    </footer>
  </div>
  
  <!-- Win celebration components -->
  {#if state.showWinCelebration}
    <ConfettiAnimation />
  {/if}
  
  {#if state.currentGame && state.showWinCelebration}
    <WinCelebration 
      game={state.currentGame}
      difficulty={state.difficulty}
      completionTime={state.completionTime}
      leaderboardPosition={state.leaderboardPosition}
      isVisible={state.showWinCelebration}
      onclose={handleCloseCelebration}
      onnewgame={handleNewGameFromCelebration}
    />
  {/if}
</main>
