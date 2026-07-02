<script lang="ts">
export interface AdminColumn {
  key: string;
  label: string;
  /** CSS grid track, e.g. "1fr", "120px", ".6fr" */
  width?: string;
  align?: "left" | "right" | "center";
}
</script>

<script setup lang="ts" generic="T extends object">
// imports → props/emits
import LoadingState from "@/components/common/LoadingState.vue";

// 인터페이스 타입은 Record<string, unknown> 제약을 만족하지 않으므로
// 제약은 object 로 두고, 셀 값 접근 시에만 캐스팅한다.
function cellValue(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

const props = withDefaults(
  defineProps<{
    columns: AdminColumn[];
    rows: T[];
    rowKey: (row: T) => string | number;
    loading?: boolean;
    /** 행 클릭 가능 여부 (row-click emit) */
    clickable?: boolean;
    emptyText?: string;
  }>(),
  { loading: false, clickable: false, emptyText: "표시할 항목이 없어요." },
);

const emit = defineEmits<{ (e: "row-click", row: T): void }>();

function gridTemplate() {
  return props.columns.map((c) => c.width ?? "1fr").join(" ");
}
</script>

<template>
  <div class="table">
    <div class="thead" :style="{ gridTemplateColumns: gridTemplate() }">
      <span v-for="col in columns" :key="col.key" class="th" :style="{ textAlign: col.align ?? 'left' }">{{ col.label }}</span>
    </div>

    <LoadingState v-if="loading" variant="list" :count="6" />

    <p v-else-if="rows.length === 0" class="table-empty">{{ emptyText }}</p>

    <div v-else class="tbody">
      <div
        v-for="row in rows"
        :key="rowKey(row)"
        class="tr"
        :class="{ 'tr--clickable': clickable }"
        :style="{ gridTemplateColumns: gridTemplate() }"
        @click="clickable && emit('row-click', row)"
      >
        <div v-for="col in columns" :key="col.key" class="td" :style="{ textAlign: col.align ?? 'left', justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }">
          <slot :name="`cell-${col.key}`" :row="row" :value="cellValue(row, col.key)">
            {{ cellValue(row, col.key) ?? "—" }}
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table {
  width: 100%;
}
.thead {
  display: grid;
  gap: 14px;
  padding: 0 12px 10px;
  border-bottom: 1px solid var(--border);
}
.th {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.05em;
  color: var(--fg-muted);
  text-transform: uppercase;
}
.tbody {
  display: flex;
  flex-direction: column;
}
.tr {
  display: grid;
  gap: 14px;
  align-items: center;
  padding: 14px 12px;
  border-radius: 12px;
  border-bottom: 1px solid var(--border);
  transition: background var(--dur-fast) var(--ease-state);
}
.tr:last-child {
  border-bottom: 0;
}
.tr--clickable {
  cursor: pointer;
}
.tr--clickable:hover {
  background: var(--surface-soft);
}
.td {
  display: flex;
  align-items: center;
  min-width: 0;
  font-size: var(--fs-body);
  font-weight: var(--w-medium);
  color: var(--fg);
  overflow: hidden;
}
.table-empty {
  padding: 48px 0;
  text-align: center;
  font-size: var(--fs-body);
  color: var(--fg-muted);
}
</style>
