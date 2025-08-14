<script lang="ts">
  import type { HintResponse } from '../api/types';

  interface Props {
    hint: HintResponse | null;
  }

  let { hint }: Props = $props();
</script>

{#if hint}
  <div class="mt-4 mx-auto max-w-2xl">
    <div class="bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-300 dark:border-blue-800 rounded-xl shadow-lg p-8" style="border-radius: 1rem; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.1);">
      
      <!-- Content -->
      <div class="relative">
        <!-- Header with icon -->
        <div class="flex items-center justify-center gap-3 mb-8">
          <h4 class="font-bold text-blue-800 dark:text-blue-200 text-lg">
            💡 Hint
          </h4>
        </div>
        
        <!-- Hint content -->
        <div class="space-y-6 text-center mx-4">
          <p class="text-blue-700 dark:text-blue-300 font-medium leading-loose px-6 py-3 break-words text-wrap" style="list-style: none; list-style-type: none; display: block; margin: 0 auto; max-width: 90%; line-height: 1.8; word-wrap: break-word; word-break: break-word; hyphens: auto;">
            {hint.reasoning}
          </p>
          {#if hint.found && hint.row !== undefined && hint.col !== undefined}
            <p class="text-blue-800 dark:text-blue-200 font-semibold leading-loose px-6 py-3 break-words text-wrap" style="list-style: none; list-style-type: none; display: block; margin: 0 auto; max-width: 90%; line-height: 1.8; word-wrap: break-word; word-break: break-word; hyphens: auto;">
              Suggested move: Place a {hint.piece_type} at row {hint.row + 1}, column {hint.col + 1}
            </p>
          {/if}
        </div>
      </div>
      
      <!-- Bottom accent line -->
      <div class="h-1 bg-blue-500 dark:bg-blue-400 rounded-full mt-8 mx-4"></div>
    </div>
  </div>
{/if}
