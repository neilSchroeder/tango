<script lang="ts">
  import { themeStore } from '$lib/stores/themeStore.svelte';
</script>

<button 
  onclick={() => themeStore.toggleTheme()}
  class="
    relative inline-flex h-8 w-16 items-center justify-center
    rounded-full border-2 border-gray-200 dark:border-gray-600
    bg-gray-100 dark:bg-gray-800
    transition-all duration-300 ease-in-out
    hover:scale-105 hover:shadow-lg
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
    group
  "
  aria-label={themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  title={themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
  <!-- Background track -->
  <div class="
    absolute inset-1 rounded-full 
    bg-gradient-to-r from-yellow-400 to-orange-400 dark:from-indigo-500 dark:to-purple-600
    transition-all duration-300
  "></div>
  
  <!-- Toggle circle -->
  <div class="
    relative z-10 flex h-6 w-6 items-center justify-center
    rounded-full bg-white dark:bg-gray-900
    shadow-lg transform transition-all duration-300
    {themeStore.isDark ? 'translate-x-4' : '-translate-x-4'}
    group-hover:scale-110
  ">
    <!-- Sun icon (light mode) -->
    <svg 
      class="
        h-4 w-4 text-yellow-500 transition-all duration-300
        {themeStore.isDark ? 'opacity-0 scale-0 rotate-180' : 'opacity-100 scale-100 rotate-0'}
      "
      fill="currentColor" 
      viewBox="0 0 20 20"
    >
      <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
    </svg>
    
    <!-- Moon icon (dark mode) -->
    <svg 
      class="
        absolute h-4 w-4 text-purple-400 transition-all duration-300
        {themeStore.isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-0 -rotate-180'}
      "
      fill="currentColor" 
      viewBox="0 0 20 20"
    >
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  </div>
</button>
