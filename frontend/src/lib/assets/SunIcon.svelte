<script lang="ts">
  let { 
    size = 24, 
    color = '#f59e0b', 
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
  aria-label="Sun"
>
  <!-- Sun rays -->
  <!-- <g stroke={color} stroke-width="3" stroke-linecap="round"> -->
    <!-- Top ray -->
    <!-- <line x1="50" y1="5" x2="50" y2="15" /> -->
    <!-- Top-right ray -->
    <!-- <line x1="78.5" y1="21.5" x2="71.4" y2="28.6" /> -->
    <!-- Right ray -->
    <!-- <line x1="95" y1="50" x2="85" y2="50" /> -->
    <!-- Bottom-right ray -->
    <!-- <line x1="78.5" y1="78.5" x2="71.4" y2="71.4" /> -->
    <!-- Bottom ray -->
    <!-- <line x1="50" y1="95" x2="50" y2="85" /> -->
    <!-- Bottom-left ray -->
    <!-- <line x1="21.5" y1="78.5" x2="28.6" y2="71.4" /> -->
    <!-- Left ray -->
    <!-- <line x1="5" y1="50" x2="15" y2="50" /> -->
    <!-- Top-left ray -->
    <!-- <line x1="21.5" y1="21.5" x2="28.6" y2="28.6" /> -->
  <!-- </g> -->
  
  <!-- Sun body -->
  <circle 
    cx="50" 
    cy="50" 
    r="40" 
    fill={color}
    stroke={color}
    stroke-width="2"
  />
  
  <!-- Sun face (optional - can be removed for simpler design) -->
  <!-- <g fill="white" opacity="0.9"> -->
    <!-- Eyes -->
    <!-- <circle cx="42" cy="42" r="3" /> -->
    <!-- <circle cx="58" cy="42" r="3" /> -->
    <!-- Smile -->
    <!-- <path d="M 40 58 Q 50 68 60 58" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" /> -->
  <!-- </g> -->
</svg>
