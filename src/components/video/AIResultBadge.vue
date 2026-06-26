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
    <!-- 1. 문제 유형 분류 -->
    <section class="result-block">
      <div class="block-label">문제 유형</div>
      <span
        v-if="hasProblemType"
        class="type-badge"
        :class="dynamic ? 'type-dynamic' : 'type-static'"
      >
        <AppIcon :name="dynamic ? 'zap' : 'pause'" :size="14" />
        {{ dynamic ? '다이나믹' : '스태틱' }}
      </span>
      <span v-else class="empty-text">분류 정보 없어요</span>
    </section>

    <!-- 2. 사용 기술 목록 -->
    <section class="result-block">
      <div class="block-label">
        사용 기술
        <span v-if="techniques.length" class="block-count">{{ techniques.length }}</span>
      </div>
      <div class="techniques">
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
        <span v-if="!techniques.length" class="empty-text">감지된 기술이 없어요</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ai-result {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 블록: 미세 라벨 + 콘텐츠 (세로 적층, DS UI Kit 결과 카드 패턴) */
.result-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.block-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}
.block-count {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--r-chip);
  background: var(--surface-soft);
  color: var(--fg-muted);
  font-size: 10px;
  font-weight: var(--w-bold);
  letter-spacing: 0;
}

/* 문제 유형 — 강조형 배지 (아이콘 + 채움) */
.type-badge {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 16px;
  border-radius: var(--r-chip);
  font-size: var(--fs-caption);
  font-weight: var(--w-bold);
  letter-spacing: -0.01em;
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
  height: 28px;
  padding: 0 12px;
  border-radius: var(--r-chip);
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
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
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
</style>
