<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  text: string;
  maxLength?: number;
  tag?: string;
}>();

const MAX = computed(() => props.maxLength ?? 150);
const expanded = ref(false);

const needsTruncation = computed(() => props.text.length > MAX.value);
const displayText = computed(() => (needsTruncation.value && !expanded.value ? props.text.slice(0, MAX.value).trimEnd() + "…" : props.text));
</script>

<template>
  <span class="expandable-text">
    <component :is="tag ?? 'span'">{{ displayText }}</component>
    <button v-if="needsTruncation" class="expand-btn" :aria-expanded="expanded" @click.stop="expanded = !expanded">
      {{ expanded ? "접기" : "더보기" }}
    </button>
  </span>
</template>

<style scoped>
.expandable-text {
  display: block;
}
.expand-btn {
  display: inline;
  background: none;
  border: none;
  padding: 0 0 0 4px;
  cursor: pointer;
  font-size: inherit;
  font-weight: 600;
  color: var(--fg-muted);
  font-family: var(--font-sans);
}
</style>
