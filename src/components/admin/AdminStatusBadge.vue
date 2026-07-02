<script setup lang="ts">
// imports → props/emits
import type { BadgeTone } from "@/utils/adminLabels";

withDefaults(
  defineProps<{
    label: string;
    tone?: BadgeTone;
  }>(),
  { tone: "neutral" },
);
</script>

<template>
  <span class="badge" :class="`badge--${tone}`">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: var(--r-chip);
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.badge--neutral {
  background: var(--border);
  color: var(--fg);
}
.badge--pink {
  background: var(--tint-pink);
  color: var(--on-tint-pink);
}
.badge--lime {
  background: var(--tint-lime);
  color: var(--on-tint-lime);
}
.badge--orange {
  background: var(--tint-orange);
  color: var(--on-tint-orange);
}
.badge--cyan {
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
}
.badge--dark {
  background: var(--hold-dark);
  color: #fff;
}
</style>
