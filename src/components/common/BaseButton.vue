<script setup lang="ts">
// imports → props/emits → composables → state → computed → methods

withDefaults(
  defineProps<{
    /** primary = dark CTA · accent = lime · secondary = bordered surface */
    variant?: "primary" | "accent" | "secondary";
    /** md = 52px (screen CTA) · sm = 40px (inline / compact) */
    size?: "md" | "sm";
    /** full-width */
    block?: boolean;
    /** busy state — shows a soft breathing dot trio, never a spinner */
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
  }>(),
  { variant: "primary", size: "md", block: false, loading: false, disabled: false, type: "button" },
);

defineEmits<{ (e: "click", ev: MouseEvent): void }>();
</script>

<template>
  <button
    :type="type"
    class="bb"
    :class="[`bb--${variant}`, `bb--${size}`, { 'bb--block': block, 'bb--loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="$emit('click', $event)"
  >
    <span class="bb-content" :class="{ 'is-hidden': loading }">
      <slot name="icon" />
      <slot />
    </span>
    <span v-if="loading" class="bb-dots" aria-hidden="true"><i /><i /><i /></span>
  </button>
</template>

<style scoped>
.bb {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: var(--r-button);
  font-family: var(--font-sans);
  font-weight: var(--w-bold);
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    transform var(--dur-fast) var(--ease-state),
    background var(--dur-fast) var(--ease-state),
    opacity var(--dur-fast) var(--ease-state);
}
.bb:active {
  transform: scale(0.97);
}
.bb:disabled {
  cursor: not-allowed;
}
.bb:disabled:not(.bb--loading) {
  opacity: 0.4;
}

/* ── Sizes ──────────────────────────────────────── */
.bb--md {
  height: 52px;
  padding: 0 22px;
  font-size: 15px;
}
.bb--sm {
  height: 40px;
  padding: 0 16px;
  font-size: var(--fs-caption);
}
.bb--block {
  width: 100%;
}

/* ── Variants ───────────────────────────────────── */
.bb--primary {
  background: var(--hold-dark);
  color: #fff;
}
.bb--accent {
  background: var(--hold-lime);
  color: var(--fg);
}
.bb--secondary {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
}

/* ── Loading (soft breathing dots, inherits text color) ── */
.bb--loading {
  cursor: default;
}
.bb--loading:active {
  transform: none;
}
.bb-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bb-content.is-hidden {
  visibility: hidden;
}
.bb-dots {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.bb-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: breathe 1400ms var(--ease-state) infinite;
}
.bb-dots i:nth-child(2) {
  animation-delay: 160ms;
}
.bb-dots i:nth-child(3) {
  animation-delay: 320ms;
}
@media (prefers-reduced-motion: reduce) {
  .bb-dots i {
    animation: none;
    opacity: 0.6;
  }
}
</style>
