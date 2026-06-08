<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ dynamicCount: number; staticCount: number }>()

const total = computed(() => props.dynamicCount + props.staticCount)
const dynamicPct = computed(() => total.value ? Math.round((props.dynamicCount / total.value) * 100) : 0)
const staticPct = computed(() => 100 - dynamicPct.value)

// SVG donut params
const radius = 48
const stroke = 12
const circ = computed(() => 2 * Math.PI * radius)
const dynamicDash = computed(() => (dynamicPct.value / 100) * circ.value)
</script>

<template>
  <div class="donut-wrap" role="img" :aria-label="`다이나믹 ${dynamicPct}% / 스태틱 ${staticPct}%`">
    <svg :width="(radius + stroke) * 2" :height="(radius + stroke) * 2" class="donut-svg">
      <!-- Background ring -->
      <circle
        :cx="radius + stroke"
        :cy="radius + stroke"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
        stroke="var(--surface-soft)"
      />
      <!-- Dynamic segment -->
      <circle
        :cx="radius + stroke"
        :cy="radius + stroke"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
        stroke="var(--hold-cyan)"
        stroke-linecap="round"
        :stroke-dasharray="`${dynamicDash} ${circ - dynamicDash}`"
        stroke-dashoffset="0"
        transform="rotate(-90)"
        :style="{ transformOrigin: `${radius + stroke}px ${radius + stroke}px` }"
      />
    </svg>

    <div class="donut-legend">
      <div class="legend-item">
        <span class="legend-dot dynamic" aria-hidden="true" />
        <span class="legend-label">다이나믹</span>
        <span class="legend-pct">{{ dynamicPct }}%</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot static" aria-hidden="true" />
        <span class="legend-label">스태틱</span>
        <span class="legend-pct">{{ staticPct }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.donut-wrap { flex-wrap: nowrap; 
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 0;
}
.donut-svg { flex-shrink: 0; }

.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-dot.dynamic { background: var(--hold-cyan); }
.legend-dot.static  { background: var(--surface-soft); border: 2px solid var(--border); }
.legend-label { font-size: var(--fs-caption); flex: 1; white-space: nowrap; }
.legend-pct { font-size: var(--fs-body); font-weight: var(--w-bold); }
</style>
