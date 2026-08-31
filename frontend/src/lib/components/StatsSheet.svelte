<script lang="ts">
  import Leaderboard from './Leaderboard.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();
</script>

{#if open}
  <div class="stats-backdrop" role="presentation" onclick={onclose}></div>
  <dialog class="stats-sheet" open aria-labelledby="stats-title">
    <header>
      <div>
        <p>Personal record</p>
        <h2 id="stats-title">Stats</h2>
      </div>
      <button onclick={onclose} aria-label="Close statistics">×</button>
    </header>
    <Leaderboard />
    <section class="rules">
      <h3>Rules</h3>
      <p>Every row and column holds three suns and three moons. Never place three identical symbols in a row. An equals marker links matching symbols; a cross links different ones.</p>
    </section>
  </dialog>
{/if}

<style>
  .stats-backdrop { position: fixed; z-index: 39; inset: 0; background: rgb(8 13 26 / 0.52); backdrop-filter: blur(2px); }
  .stats-sheet { position: fixed; z-index: 40; right: 0; bottom: 0; left: 0; box-sizing: border-box; width: 100%; max-width: none; max-height: 62dvh; margin: 0; padding: 0.8rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom)); overflow: auto; border: 1px solid var(--border-primary); border-bottom: 0; border-radius: 1rem 1rem 0 0; background: var(--surface-raised); color: var(--text-primary); box-shadow: 0 -20px 50px var(--shadow-color); }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
  header p { margin: 0 0 0.15rem; color: var(--sun-color); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  h2, h3 { margin: 0; font-family: Georgia, serif; }
  h2 { font-size: 1.55rem; }
  header button { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border: 1px solid var(--border-primary); border-radius: 50%; background: transparent; color: var(--text-primary); font-size: 1.3rem; }
  .rules { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-primary); }
  .rules p { color: var(--text-secondary); font: 0.9rem/1.55 Georgia, serif; }
  @media (min-width: 760px) { .stats-sheet { top: 0; right: 0; bottom: 0; left: auto; width: min(100%, 25rem); max-height: none; padding: 1.25rem; border: 0; border-left: 1px solid var(--border-primary); border-radius: 0; box-shadow: -20px 0 50px var(--shadow-color); } header { margin-bottom: 1.25rem; } .rules { margin-top: 1.5rem; padding-top: 1.25rem; } }
</style>