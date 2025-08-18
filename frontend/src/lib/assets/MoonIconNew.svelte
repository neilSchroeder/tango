<script lang="ts">
  let { 
    size = 24, 
    color = '#6366F1', 
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
  <!-- Waxing crescent moon shape -->
  <path 
    d="M 50 15 
       C 65 20, 75 35, 75 50
       C 75 65, 65 80, 50 85
       C 60 75, 65 65, 65 50
       C 65 35, 60 25, 50 15 Z"
    fill={color}
    stroke={color}
    stroke-width="2"
    stroke-linejoin="round"
  />
  
  <!-- Moon craters for detail -->
  <g fill="white" opacity="0.3">
    <circle cx="58" cy="35" r="2.5" />
    <circle cx="62" cy="55" r="2" />
    <circle cx="55" cy="65" r="2" />
  </g>
  
  <!-- Optional stars around the moon -->
  <g fill={color} opacity="0.6">
    <!-- Star 1 - upper left -->
    <path d="M 25 20 L 27 25 L 32 25 L 28 29 L 30 34 L 25 31 L 20 34 L 22 29 L 18 25 L 23 25 Z" />
    <!-- Star 2 - lower left -->
    <path d="M 20 70 L 21 73 L 24 73 L 22 76 L 23 79 L 20 77 L 17 79 L 18 76 L 16 73 L 19 73 Z" />
    <!-- Star 3 - right side -->
    <path d="M 80 45 L 81 47 L 83 47 L 82 49 L 83 51 L 80 50 L 78 51 L 79 49 L 77 47 L 79 47 Z" />
  </g>
</svg>
