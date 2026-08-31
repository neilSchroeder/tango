<script lang="ts">
  import type { HintResponse } from '../api/types';

  interface Props {
    hint: HintResponse | null;
    onclose: () => void;
  }

  let { hint, onclose }: Props = $props();
</script>

{#if hint}
  <div class="sheet-backdrop" role="presentation" onclick={onclose}></div>
  <dialog class="hint-sheet" open aria-labelledby="hint-title">
    <div class="sheet-handle"></div>
    <header>
      <div>
        <p class="sheet-eyebrow">Next deduction</p>
        <h2 id="hint-title">Hint</h2>
      </div>
      <button onclick={onclose} aria-label="Close hint">×</button>
    </header>
    <div class="hint-copy">
      <p>{hint.reasoning}</p>
      {#if hint.found && hint.row !== undefined && hint.col !== undefined}
        <p class="suggestion">Place a <strong>{hint.piece_type}</strong> at <strong>({hint.row + 1}, {hint.col + 1})</strong>.</p>
      {/if}
    </div>
  </dialog>
{/if}

<style>
  .sheet-backdrop { position: fixed; z-index: 39; inset: 0; background: rgb(8 13 26 / 0.52); backdrop-filter: blur(2px); }
  .hint-sheet { position: fixed; z-index: 40; right: 0; bottom: 0; left: 0; max-height: min(55dvh, 30rem); padding: 0.65rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom)); overflow: auto; border: 1px solid var(--border-primary); border-bottom: 0; border-radius: 1rem 1rem 0 0; background: var(--surface-raised); box-shadow: 0 -20px 50px var(--shadow-color); color: var(--text-primary); }
  .sheet-handle { width: 2.5rem; height: 0.25rem; margin: 0 auto 0.8rem; border-radius: 9px; background: var(--border-primary); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  h2 { margin: 0; font: 700 1.4rem Georgia, serif; }
  .sheet-eyebrow { margin: 0 0 0.15rem; color: var(--sun-color); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  header button { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border: 1px solid var(--border-primary); border-radius: 50%; background: transparent; color: var(--text-primary); font-size: 1.3rem; }
  .hint-copy { display: grid; gap: 0.9rem; margin-top: 1rem; color: var(--text-secondary); font: 1rem/1.55 Georgia, serif; overflow-wrap: anywhere; }
  .hint-copy p { margin: 0; }
  .suggestion { padding: 0.85rem 1rem; border-left: 3px solid var(--sun-color); background: var(--surface-hover); color: var(--text-primary); }
  @media (min-width: 760px) { .hint-sheet { right: 50%; left: auto; width: 34rem; transform: translateX(50%); border-bottom: 1px solid var(--border-primary); border-radius: 1rem; bottom: 1.5rem; } }
</style>
