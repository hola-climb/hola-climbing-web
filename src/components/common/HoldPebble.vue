<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue'

const props = defineProps<{
  color?: 'pink' | 'lime' | 'orange' | 'cyan' | 'dark'
  size?: number
}>()

const fills: Record<string, string> = {
  pink: '#FF4D94',
  lime: '#C8FF00',
  orange: '#FF9800',
  cyan: '#22D3EE',
  dark: '#151515',
}

const uid = getCurrentInstance()!.uid
const fill = computed(() => fills[props.color ?? 'pink'])
const gradId = computed(() => `hpg-${props.color ?? 'pink'}-${uid}`)
const sz = computed(() => props.size ?? 64)
const h = computed(() => Math.round((sz.value * 180) / 200))
</script>

<template>
  <svg :viewBox="'0 0 200 180'" :width="sz" :height="h" aria-hidden="true">
    <defs>
      <radialGradient :id="gradId" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="white" stop-opacity="0.55" />
        <stop offset="55%" stop-color="white" stop-opacity="0" />
      </radialGradient>
    </defs>
    <path
      d="M 38 92 C 22 60, 60 18, 108 22 C 158 26, 188 60, 178 110 C 168 158, 118 168, 78 158 C 44 150, 50 122, 38 92 Z"
      :fill="fill"
    />
    <path
      d="M 38 92 C 22 60, 60 18, 108 22 C 158 26, 188 60, 178 110 C 168 158, 118 168, 78 158 C 44 150, 50 122, 38 92 Z"
      :fill="`url(#${gradId})`"
    />
    <circle cx="108" cy="92" r="6" fill="rgba(0,0,0,0.3)" />
  </svg>
</template>
