<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let mounted = $state(false);
  let particles = $state<Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    rotationSpeed: number;
  }>>([]);
  
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#fecca7', '#ff9ff3', '#54a0ff'];
  
  function createParticle(id: number) {
    if (!browser) return null;
    
    return {
      id,
      x: Math.random() * window.innerWidth,
      y: -10,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10
    };
  }
  
  function animate() {
    if (!mounted || !browser) return;
    
    particles = particles.map(particle => ({
      ...particle,
      x: particle.x + particle.vx,
      y: particle.y + particle.vy,
      rotation: particle.rotation + particle.rotationSpeed,
      vy: particle.vy + 0.1 // gravity
    })).filter(particle => particle.y < window.innerHeight + 20);
    
    // Add new particles
    if (particles.length < 50 && Math.random() < 0.3) {
      const newParticle = createParticle(Date.now());
      if (newParticle) {
        particles.push(newParticle);
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  onMount(() => {
    if (!browser) return;
    
    mounted = true;
    
    // Create initial burst of particles
    for (let i = 0; i < 30; i++) {
      const particle = createParticle(i);
      if (particle) {
        particles.push(particle);
      }
    }
    
    animate();
    
    // Auto cleanup after 5 seconds
    const cleanup = setTimeout(() => {
      mounted = false;
    }, 5000);
    
    return () => {
      mounted = false;
      clearTimeout(cleanup);
    };
  });
</script>

{#if mounted}
  <div class="confetti-container fixed inset-0 pointer-events-none z-50">
    {#each particles as particle (particle.id)}
      <div
        class="confetti-particle fixed"
        style="
          left: {particle.x}px;
          top: {particle.y}px;
          width: {particle.size}px;
          height: {particle.size}px;
          background-color: {particle.color};
          transform: rotate({particle.rotation}deg);
          z-index: 9999;
        "
      ></div>
    {/each}
  </div>
{/if}

<style>
  .confetti-container {
    overflow: visible;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 9998;
  }
  
  .confetti-particle {
    border-radius: 50%;
    transition: none;
    pointer-events: none;
    position: fixed;
    display: block;
    opacity: 1;
    box-shadow: 0 0 2px rgba(0,0,0,0.1);
  }
</style>
