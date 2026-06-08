<script setup lang="ts">
import { computed } from 'vue'
import type { TechniqueFrequency } from '@/types/api'
import { getTagLabel } from '@/utils/tagLabels'

const props = defineProps<{ frequencies: TechniqueFrequency[] }>()

const sorted = computed(() =>
  [...props.frequencies].sort((a, b) => b.count - a.count).slice(0, 8),
)
const maxCount = computed(() => sorted.value[0]?.count ?? 1)
</script>

<template>
  <div class="stat-graph" role="img" aria-label="기술 빈도 그래프">
    <div v-if="!sorted.length" class="empty">기록된 기술이 없어요.</div>
    <div v-else class="bar-list">
      <div v-for="freq in sorted" :key="freq.key" class="bar-row">
        <span class="bar-label">{{ getTagLabel(freq.key) }}</span>
        <div class="bar-track" aria-label="`${getTagLabel(freq.key)}: ${freq.count}회`">
          <div
            class="bar-fill"
            :style="{ width: `${(freq.count / maxCount) * 100}%` }"
          />
        </div>
        <span class="bar-count">{{ freq.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-graph { width: 100%; }
.empty { color: var(--fg-muted); font-size: var(--fs-caption); text-align: center; padding: 16px 0; }

.bar-list { display: flex; flex-direction: column; gap: 10px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-label {
  width: 70px;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg);
  flex-shrink: 0;
  text-align: right;
}
.bar-track {
  flex: 1;
  height: 8px;
  background: var(--surface-soft);
  border-radius: 4px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--hold-cyan);
  border-radius: 4px;
  transition: width var(--dur-slow) var(--ease-soft);
}
.bar-count {
  width: 24px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-muted);
  text-align: right;
}
</style>
