<script lang="ts">
  let { 
    size = 40, 
    color = '#1d4ed8', 
    class: className = '' 
  }: {
    size?: number;
    color?: string;
    class?: string;
  } = $props();
</script>

<svg 
  width={size} 
  height={size} 
  viewBox="0 0 100 100" 
  fill="none" 
  xmlns="http://www.w3.org/2000/svg"
  class={className}
  aria-label="Waxing Crescent Moon"
>
  <!-- Waxing crescent moon shape - larger with same proportions -->
  <path 
    d="M 32 15 
       C 60 20, 72 36, 72 50
       C 72 64, 60 80, 32 85
       C 42 74, 48 64, 48 50
       C 48 36, 42 26, 32 15 Z"
    fill={color}
    stroke={color}
    stroke-width="2"
    stroke-linejoin="round"
  />
  
  <!-- Moon craters for detail -->
  <!--   <!-- Moon craters for detail -->
  <g fill="white" opacity="0.3">
    <circle cx="44" cy="30" r="2" />
    <circle cx="54" cy="50" r="2.5" />
    <circle cx="46" cy="70" r="2" />
  </g> -->
  
  <!-- Optional stars around the moon
  <!-- <g fill={color} opacity="0.6">
    <!-- Star 1 - upper left -->
    <!-- <path d="M 25 20 L 27 25 L 32 25 L 28 29 L 30 34 L 25 31 L 20 34 L 22 29 L 18 25 L 23 25 Z" /> -->
    <!-- Star 2 - lower left -->
    <!-- <path d="M 20 70 L 21 73 L 24 73 L 22 76 L 23 79 L 20 77 L 17 79 L 18 76 L 16 73 L 19 73 Z" /> -->
    <!-- Star 3 - right side -->
    <!-- <path d="M 80 45 L 81 47 L 83 47 L 82 49 L 83 51 L 80 50 L 78 51 L 79 49 L 77 47 L 79 47 Z" /> -->
  <!-- </g> --> 
</svg>
