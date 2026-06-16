<script setup lang="ts">
// imports → props/emits → composables → state → computed → methods
import HoldPebble from "@/components/common/HoldPebble.vue";

withDefaults(
  defineProps<{
    /** Headline — one short line, sentence case, no period */
    title: string;
    /** Optional supporting line below the title */
    description?: string;
    /** Brand hold silhouette color */
    hold?: "pink" | "lime" | "orange" | "cyan" | "dark";
    /** Optional primary action label; when set, an action button is shown */
    actionLabel?: string;
    /** Tighter spacing + smaller hold for inline/section empties */
    compact?: boolean;
  }>(),
  { hold: "cyan", compact: false },
);

defineEmits<{ (e: "action"): void }>();
</script>

<template>
  <div class="empty-state" :class="{ compact }">
    <div class="hold-wrap" aria-hidden="true">
      <HoldPebble :color="hold" :size="compact ? 56 : 88" />
    </div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="empty-desc">{{ description }}</p>

    <!-- Custom action takes precedence; otherwise render the labelled button -->
    <slot name="action">
      <button v-if="actionLabel" class="empty-action" type="button" @click="$emit('action')">
        {{ actionLabel }}
      </button>
    </slot>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--s-2);
  padding: var(--s-12) var(--s-6);
}
.empty-state.compact {
  padding: var(--s-8) var(--s-4);
}
.hold-wrap {
  opacity: 0.5;
  margin-bottom: var(--s-1);
}
.empty-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
  color: var(--fg);
  margin: 0;
}
.empty-desc {
  font-size: var(--fs-caption);
  font-weight: var(--w-medium);
  color: var(--fg-muted);
  line-height: 1.45;
  margin: 0;
  max-width: 280px;
}
.empty-action {
  margin-top: var(--s-4);
  height: 48px;
  padding: 0 22px;
  border: 0;
  border-radius: var(--r-button);
  background: var(--hold-dark);
  color: #fff;
  font-family: var(--font-sans);
  font-weight: var(--w-bold);
  font-size: var(--fs-body);
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-state);
}
.empty-action:active {
  transform: scale(0.97);
}
</style>
