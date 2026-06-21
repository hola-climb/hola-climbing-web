<script setup lang="ts">
// imports → props/emits → methods
import { IonIcon } from "@ionic/vue";
import { videocamOutline, createOutline, chevronForward } from "ionicons/icons";
import BaseSheet from "@/components/common/BaseSheet.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: "select", choice: "upload" | "record"): void;
  (e: "close"): void;
}>();

function choose(choice: "upload" | "record") {
  emit("select", choice);
}
</script>

<template>
  <BaseSheet class="choice-sheet" :open="open" :breakpoints="[0, 0.42]" :initial-breakpoint="0.42" @close="emit('close')">
    <div class="sheet">
      <h2 class="sheet-title">무엇을 추가할까요?</h2>

      <button class="choice choice--upload" @click="choose('upload')" aria-label="영상 업로드">
        <span class="choice-icon">
          <IonIcon :icon="videocamOutline" />
        </span>
        <span class="choice-text">
          <span class="choice-title">영상 업로드</span>
          <span class="choice-desc">AI가 기술을 분석해요</span>
        </span>
        <IonIcon :icon="chevronForward" class="choice-chevron" aria-hidden="true" />
      </button>

      <button class="choice choice--record" @click="choose('record')" aria-label="클라이밍 기록">
        <span class="choice-icon">
          <IonIcon :icon="createOutline" />
        </span>
        <span class="choice-text">
          <span class="choice-title">클라이밍 기록</span>
          <span class="choice-desc">오늘 푼 문제를 남겨요</span>
        </span>
        <IonIcon :icon="chevronForward" class="choice-chevron" aria-hidden="true" />
      </button>
    </div>
  </BaseSheet>
</template>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}
.sheet-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0 0 4px;
}

.choice {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  transition: transform var(--dur-fast) var(--ease-state), background var(--dur-fast) var(--ease-state);
}
.choice:active {
  transform: scale(0.98);
  background: var(--surface-soft);
}

.choice-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 24px;
  flex-shrink: 0;
}
.choice--upload .choice-icon {
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
}
.choice--record .choice-icon {
  background: var(--tint-lime);
  color: var(--on-tint-lime);
}

.choice-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.choice-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-bold);
  letter-spacing: -0.01em;
}
.choice-desc {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.choice-chevron {
  font-size: 18px;
  color: var(--fg-muted);
  flex-shrink: 0;
}
</style>
