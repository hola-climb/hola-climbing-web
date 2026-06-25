<script setup lang="ts">
// imports → props/emits → computed
import { computed } from "vue";
import { IonIcon } from "@ionic/vue";
import { documentTextOutline, chevronForward } from "ionicons/icons";
import BaseSheet from "@/components/common/BaseSheet.vue";

const props = defineProps<{
  /** 열림 상태 */
  open: boolean;
  /** 열람 가능한 리포트 월 (YYYY-MM), 최신순 */
  periods: string[];
}>();
const emit = defineEmits<{
  (e: "select", period: string): void;
  (e: "close"): void;
}>();

const items = computed(() =>
  props.periods.map((period) => {
    const [y, m] = period.split("-");
    return { period, label: `${y}년 ${Number(m)}월` };
  }),
);
</script>

<template>
  <BaseSheet class="report-picker" :open="open" @close="emit('close')">
    <template #header>
      <h2 class="picker-title">지난 리포트</h2>
    </template>

    <div class="picker-list">
      <button v-for="item in items" :key="item.period" class="picker-row" @click="emit('select', item.period)">
        <span class="picker-icon" aria-hidden="true">
          <IonIcon :icon="documentTextOutline" />
        </span>
        <span class="picker-label">{{ item.label }}</span>
        <IonIcon :icon="chevronForward" class="picker-chevron" aria-hidden="true" />
      </button>
    </div>
  </BaseSheet>
</template>

<style scoped>
.picker-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}

.picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding-bottom: var(--s-2);
}

.picker-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  padding: var(--s-4);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  transition: transform var(--dur-fast) var(--ease-state), background var(--dur-fast) var(--ease-state);
}
.picker-row:active {
  transform: scale(0.98);
  background: var(--surface-soft);
}

.picker-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--r-button);
  display: grid;
  place-items: center;
  font-size: 20px;
  flex-shrink: 0;
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
}

.picker-label {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-h3);
  font-weight: var(--w-bold);
  letter-spacing: -0.01em;
}

.picker-chevron {
  font-size: 18px;
  color: var(--fg-muted);
  flex-shrink: 0;
}
</style>
