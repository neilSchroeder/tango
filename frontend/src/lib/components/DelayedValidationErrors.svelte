<script lang="ts">
  import { errorStore } from '../stores/errorStore.svelte';

  // Get delayed validation errors from errorStore
  const delayedValidationErrors = $derived(errorStore.getDelayedValidationErrors());
</script>

{#if delayedValidationErrors.length > 0}
  <div class="mt-4 mx-auto max-w-2xl">
    <div class="bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 rounded-xl shadow-lg p-8" style="border-radius: 1rem; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.1);">
      
      <!-- Content -->
      <div class="relative">
        <!-- Header with icon -->
        <div class="flex items-center justify-center gap-3 mb-8">
          <h4 class="font-bold text-red-800 dark:text-red-200 text-lg">
            Rule Violations
          </h4>
        </div>
        
        <!-- Error list -->
        <div class="space-y-6 text-center mx-4" style="list-style: none;">
          {#each delayedValidationErrors as error}
            <p class="text-red-700 dark:text-red-300 font-medium leading-loose px-6 py-3 break-words text-wrap" style="list-style: none; list-style-type: none; display: block; margin: 0 auto; max-width: 90%; line-height: 1.8; word-wrap: break-word; word-break: break-word; hyphens: auto;">
              {error}
            </p>
          {/each}
        </div>
      </div>
      
      <!-- Bottom accent line -->
      <div class="h-1 bg-red-500 dark:bg-red-400 rounded-full mt-8 mx-4"></div>
    </div>
  </div>
{/if}
