<script setup lang="ts">
// Lightweight SVG icon set — replaces unicode/emoji glyphs used as UI.
// Line icons use 1.75px stroke; solid icons (heart, star, play, pin) fill currentColor.

type IconDef = { d: string; fill?: boolean };

const ICONS: Record<string, IconDef> = {
  check: { d: "M20 6 9 17l-5-5" },
  close: { d: "M18 6 6 18M6 6l12 12" },
  heart: {
    d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z",
    fill: true,
  },
  star: {
    d: "M12 2.6l2.95 5.97 6.6.96-4.77 4.65 1.13 6.57L12 18.6l-5.9 3.1 1.13-6.57L2.45 10.49l6.6-.96z",
    fill: true,
  },
  play: { d: "M6 4v16l13-8z", fill: true },
  pause: { d: "M7 5h3v14H7zM14 5h3v14h-3z", fill: true },
  fullscreen: { d: "M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" },
  "fullscreen-exit": { d: "M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4" },
  pin: {
    d: "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 4a2.5 2.5 0 0 1 0 5.5z",
    fill: true,
  },
  mail: {
    d: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 2.2V18h16V7.2l-8 5.3-8-5.3z",
    fill: true,
  },
  zap: { d: "M13 2 4.5 13.5H11l-1 8.5L18.5 10H12l1-8z", fill: true },
};

const props = withDefaults(
  defineProps<{
    name: keyof typeof ICONS | string;
    size?: number;
    strokeWidth?: number;
  }>(),
  { size: 16, strokeWidth: 1.75 },
);

const icon = ICONS[props.name];
</script>

<template>
  <svg
    v-if="icon"
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="icon.fill ? 'currentColor' : 'none'"
    :stroke="icon.fill ? 'none' : 'currentColor'"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill-rule="evenodd"
    aria-hidden="true"
  >
    <path :d="icon.d" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex-shrink: 0;
}
</style>
