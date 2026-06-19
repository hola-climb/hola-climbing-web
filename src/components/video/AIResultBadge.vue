<script setup lang="ts">
import { computed } from "vue";
import type { TechniqueTag } from "@/types/api";
import { getTagLabel } from "@/utils/tagLabels";
import AppIcon from "@/components/common/AppIcon.vue";

const props = defineProps<{
  techniques: TechniqueTag[];
  problemType: "DYNAMIC" | "STATIC" | null;
  isDynamic?: boolean | null;
}>();

const hasProblemType = computed(() => props.isDynamic != null || props.problemType != null);
const dynamic = computed(() => props.isDynamic ?? props.problemType === "DYNAMIC");
</script>

<template>
  <div class="ai-result">
    <div class="section-label">AI 분석 결과</div>

    <!-- 1. 문제 유형 분류 -->
    <div class="result-group">
      <span class="group-label">문제 유형</span>
      <div class="group-body">
        <span
          v-if="hasProblemType"
          class="type-badge"
          :class="dynamic ? 'type-dynamic' : 'type-static'"
        >
          <AppIcon :name="dynamic ? 'zap' : 'pause'" :size="13" />
          {{ dynamic ? '다이나믹' : '스태틱' }}
        </span>
        <span v-else class="empty-text">분류 정보 없음</span>
      </div>
    </div>

    <div class="group-divider" />

    <!-- 2. 사용 기술 목록 -->
    <div class="result-group">
      <span class="group-label">사용 기술</span>
      <div class="group-body techniques">
        <span
          v-for="tag in techniques"
          :key="tag.key"
          class="technique-chip"
          :class="`feedback-${tag.userFeedback ?? 'none'}`"
        >
          {{ getTagLabel(tag.key) }}
          <span v-if="tag.userFeedback === 'correct'" class="feedback-icon" role="img" aria-label="정확">
            <AppIcon name="check" :size="13" :stroke-width="2.25" />
          </span>
          <span v-else-if="tag.userFeedback === 'incorrect'" class="feedback-icon feedback-wrong" role="img" aria-label="오류">
            <AppIcon name="close" :size="13" :stroke-width="2.25" />
          </span>
        </span>
        <span v-if="!techniques.length" class="empty-text">감지된 기술 없음</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-label {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}

/* 그룹: 좌측 라벨 + 우측 콘텐츠 */
.result-group {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.group-label {
  flex-shrink: 0;
  width: 56px;
  padding-top: 4px;
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg-muted);
}
.group-body {
  flex: 1;
  min-width: 0;
}

.group-divider {
  height: 1px;
  background: var(--border);
}

/* 문제 유형 — 강조형 배지 (아이콘 + 채움) */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--r-chip);
  font-size: 13px;
  font-weight: var(--w-bold);
}
.type-dynamic {
  background: var(--hold-cyan);
  color: var(--on-tint-dark);
}
.type-static {
  background: var(--surface-soft);
  color: var(--fg);
}

/* 사용 기술 — 가벼운 태그 칩 */
.techniques {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.technique-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--r-chip);
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
  font-size: 12px;
  font-weight: 600;
}
.feedback-icon {
  display: inline-flex;
  align-items: center;
}
.feedback-correct {
  background: var(--tint-lime);
  color: var(--on-tint-lime);
}
.feedback-incorrect {
  background: var(--tint-pink);
  color: var(--on-tint-pink);
}
.feedback-wrong {
  color: var(--hold-pink);
}
.empty-text {
  display: inline-block;
  padding-top: 3px;
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
</style>
