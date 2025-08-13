<script lang="ts">
  import type { HintResponse } from '../api/types';

  interface Props {
    hint: HintResponse | null;
  }

  let { hint }: Props = $props();
</script>

{#if hint}
  <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg transition-colors duration-200">
    <h4 class="font-semibold text-blue-800 dark:text-blue-200 mb-2 transition-colors duration-200">💡 Hint</h4>
    <p class="text-sm text-blue-700 dark:text-blue-300 transition-colors duration-200">
      {hint.reasoning}
    </p>
    {#if hint.found && hint.row !== undefined && hint.col !== undefined}
      <p class="text-xs text-blue-600 dark:text-blue-400 mt-2 transition-colors duration-200">
        Suggested move: Place a {hint.piece_type} at row {hint.row + 1}, column {hint.col + 1}
      </p>
    {/if}
  </div>
{/if}
