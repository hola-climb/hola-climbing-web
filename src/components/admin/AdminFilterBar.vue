<script setup lang="ts">
// imports → props/emits
import AdminIcon from "@/components/admin/AdminIcon.vue";

withDefaults(
  defineProps<{
    keyword: string;
    keywordPlaceholder?: string;
    /** 키워드 검색창 표시 여부 */
    searchable?: boolean;
  }>(),
  { keywordPlaceholder: "검색어", searchable: true },
);

const emit = defineEmits<{
  (e: "update:keyword", value: string): void;
  (e: "search"): void;
}>();
</script>

<template>
  <div class="filter-bar">
    <div class="filters">
      <slot />
    </div>

    <div v-if="searchable" class="search">
      <input
        :value="keyword"
        class="admin-input search-input"
        :placeholder="keywordPlaceholder"
        :aria-label="keywordPlaceholder"
        @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
        @keydown.enter="emit('search')"
      />
      <button class="search-btn" aria-label="검색" @click="emit('search')">
        <AdminIcon name="search" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.filters :deep(.admin-select) {
  width: auto;
  min-width: 130px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  width: 240px;
}
.search-btn {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 12px;
  background: var(--hold-dark);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-state);
}
.search-btn:hover {
  background: #2a2a2a;
}
</style>
