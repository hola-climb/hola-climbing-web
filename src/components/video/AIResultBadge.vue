<script setup lang="ts">
import type { TechniqueTag } from '@/types/api'
import { getTagLabel } from '@/utils/tagLabels'

defineProps<{
  techniques: TechniqueTag[]
  problemType: 'DYNAMIC' | 'STATIC' | null
}>()
</script>

<template>
  <div class="ai-result">
    <div class="section-label">AI 분석 결과</div>

    <div v-if="problemType" class="problem-type">
      <span class="chip" :class="problemType === 'DYNAMIC' ? 'chip-cyan' : 'chip-dark'">
        {{ problemType === 'DYNAMIC' ? '다이나믹' : '스태틱' }}
      </span>
    </div>

    <div class="techniques">
      <span
        v-for="tag in techniques"
        :key="tag.key"
        class="technique-chip"
        :class="`feedback-${tag.userFeedback ?? 'none'}`"
      >
        {{ getTagLabel(tag.key) }}
        <span v-if="tag.userFeedback === 'correct'" class="feedback-icon" aria-label="정확">✓</span>
        <span v-else-if="tag.userFeedback === 'incorrect'" class="feedback-icon feedback-wrong" aria-label="오류">✗</span>
      </span>
      <span v-if="!techniques.length" class="empty-text">감지된 기술 없음</span>
    </div>
  </div>
</template>

<style scoped>
.ai-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.section-label {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}
.problem-type { display: flex; gap: 6px; }
.techniques {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.technique-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--r-chip);
  background: var(--tint-cyan);
  color: #066a78;
  font-size: 12px;
  font-weight: 600;
}
.feedback-correct {
  background: var(--tint-lime);
  color: #4a6a00;
}
.feedback-incorrect {
  background: var(--tint-pink);
  color: #C7286A;
}
.feedback-icon { font-size: 11px; }
.feedback-wrong { color: var(--hold-pink); }
.empty-text { font-size: var(--fs-caption); color: var(--fg-muted); }
</style>
