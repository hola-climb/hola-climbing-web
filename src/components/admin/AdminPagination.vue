<script setup lang="ts">
// imports → props/emits → computed
import { computed } from "vue";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const props = defineProps<{
  /** 0-based current page */
  page: number;
  totalPages: number;
  totalElements: number;
}>();

const emit = defineEmits<{ (e: "change", page: number): void }>();

const canPrev = computed(() => props.page > 0);
const canNext = computed(() => props.page < props.totalPages - 1);

function go(p: number) {
  if (p < 0 || p >= props.totalPages || p === props.page) return;
  emit("change", p);
}
</script>

<template>
  <div class="pager">
    <span class="pager-info">총 {{ totalElements.toLocaleString() }}건</span>
    <div class="pager-controls">
      <button class="pager-btn" :disabled="!canPrev" aria-label="이전 페이지" @click="go(page - 1)">
        <AdminIcon name="chevron-left" />
      </button>
      <span class="pager-current">{{ totalPages === 0 ? 0 : page + 1 }} / {{ totalPages }}</span>
      <button class="pager-btn" :disabled="!canNext" aria-label="다음 페이지" @click="go(page + 1)">
        <AdminIcon name="chevron-right" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
}
.pager-info {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  font-weight: var(--w-medium);
}
.pager-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pager-current {
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg);
  min-width: 56px;
  text-align: center;
}
.pager-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--fg);
  font-size: 18px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-state);
}
.pager-btn:hover:not(:disabled) {
  background: var(--surface-soft);
}
.pager-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
