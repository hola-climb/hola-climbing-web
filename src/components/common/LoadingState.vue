<script setup lang="ts">
// imports → props/emits → composables → state → computed → methods
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /**
     * list  — stacked row skeletons (feed, gym list, notifications)
     * card  — large media-card skeletons (detail hero)
     * grid  — 2-col video-card skeletons (feed, my videos)
     * dot   — soft breathing dot for AI / lightweight inline waits
     */
    variant?: "list" | "card" | "grid" | "dot";
    /** Number of skeleton blocks for list/card variants */
    count?: number;
    /** Accessible status text announced to screen readers */
    label?: string;
    /** Thumb aspect ratio for grid variant — "9/16" (feed) or "1/1" (my videos) */
    thumbAspect?: "9/16" | "1/1";
  }>(),
  { variant: "list", count: 4, label: "불러오는 중", thumbAspect: "9/16" },
);

const items = computed(() => Array.from({ length: props.count }, (_, i) => i));
</script>

<template>
  <div class="loading-state" role="status" :aria-label="label">
    <!-- AI / inline: breathing dot, never a spinner -->
    <div v-if="variant === 'dot'" class="dot-wrap">
      <span class="ai-dot" />
    </div>

    <!-- List rows -->
    <template v-else-if="variant === 'list'">
      <div v-for="i in items" :key="i" class="sk-row">
        <div class="sk sk-thumb" />
        <div class="sk-lines">
          <div class="sk sk-line sk-line-lg" />
          <div class="sk sk-line sk-line-sm" />
        </div>
      </div>
    </template>

    <!-- Video grid (mirrors .video-grid-card thumb + meta) -->
    <div v-else-if="variant === 'grid'" class="sk-grid">
      <div v-for="i in items" :key="i" class="sk-grid-card">
        <div class="sk sk-grid-thumb" :style="{ aspectRatio: thumbAspect }" />
        <div class="sk-grid-meta">
          <div class="sk sk-line sk-line-lg" />
          <div class="sk sk-line sk-line-sm" />
        </div>
      </div>
    </div>

    <!-- Media cards -->
    <template v-else>
      <div v-for="i in items" :key="i" class="sk sk-card" />
    </template>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
.dot-wrap {
  display: grid;
  place-items: center;
  padding: var(--s-12) 0;
}

/* Shimmer surface — soft, neutral, no hard motion */
.sk {
  position: relative;
  overflow: hidden;
  background: var(--surface-soft);
  border-radius: var(--r-button);
}
.sk::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  animation: sk-shimmer 1400ms var(--ease-state) infinite;
}
@keyframes sk-shimmer {
  100% {
    transform: translateX(100%);
  }
}

.sk-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.sk-thumb {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}
.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.sk-line {
  height: 12px;
  border-radius: var(--r-chip);
}
.sk-line-lg {
  width: 70%;
}
.sk-line-sm {
  width: 40%;
}
.sk-card {
  width: 100%;
  height: 200px;
  border-radius: var(--r-card);
}

/* Video grid skeleton — mirrors FeedPage / MyVideosPage card geometry */
.sk-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 768px) {
  .sk-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1024px) {
  .sk-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
}
.sk-grid-card {
  background: var(--surface);
  border-radius: var(--r-card, 16px);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.sk-grid-thumb {
  width: 100%;
  border-radius: 0;
}
.sk-grid-meta {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: 10px 12px 14px;
}

@media (prefers-reduced-motion: reduce) {
  .sk::after {
    animation: none;
  }
}
</style>
