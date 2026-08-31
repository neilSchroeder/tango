<script lang="ts">
  import { themeStore } from '$lib/stores/themeStore.svelte';
</script>

<button 
  onclick={() => themeStore.toggleTheme()}
  class="theme-toggle"
  aria-label={themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  title={themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
  <span aria-hidden="true">{themeStore.isDark ? '☀' : '◐'}</span>
</button>

<style>
  .theme-toggle { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border: 1px solid var(--border-primary); border-radius: 50%; background: var(--surface-raised); color: var(--text-primary); font-size: 1.1rem; }
  .theme-toggle:hover { border-color: var(--sun-color); transform: translateY(-1px); }
  @media (max-width: 360px) { .theme-toggle { width: 2.5rem; height: 2.5rem; } }
</style>
