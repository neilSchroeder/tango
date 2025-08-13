<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { themeStore } from '$lib/stores/themeStore.svelte';
	import { onMount } from 'svelte';
	
	let { children } = $props();

	// Initialize theme on mount to ensure it's applied immediately
	onMount(() => {
		// Theme store will handle applying the dark class to document.documentElement
		// This is just to ensure it's initialized
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
