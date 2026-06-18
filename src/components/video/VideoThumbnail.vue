<script setup lang="ts">
import { ref, computed } from "vue";
import type { AnalysisStatus } from "@/types/api";
import { gradeColor, gradeTextColor } from "@/utils/gradeColor";

const props = defineProps<{
  title: string | null;
  thumbnailUrl?: string | null;
  grade?: string | null;
  alt?: string;
  /** 상태 배지 표시 (VideoCard 등에서 사용) */
  status?: AnalysisStatus;
  /** 영상 길이(초). 있을 때만 duration 배지 표시 */
  durationSeconds?: number | null;
  /** 중앙 재생 아이콘 오버레이 숨기기 (기본: 표시) */
  hidePlayIcon?: boolean;
}>();

const emit = defineEmits<{
  error: [];
}>();

const broken = ref(false);

const statusLabel: Record<string, string> = {
  pending: "업로드 중",
  analyzing: "AI 분석 중",
  failed: "분석 실패",
};

const durationLabel = computed(() => {
  const sec = props.durationSeconds;
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});

/** 분석이 끝나 재생 가능한 상태일 때만 재생 아이콘 노출 */
const showPlayIcon = computed(() => !props.hidePlayIcon && (!props.status || props.status === "done"));

function onError() {
  broken.value = true;
  emit("error");
}
</script>

<template>
  <div class="vt-wrap">
    <img v-if="thumbnailUrl && !broken" :src="thumbnailUrl" :alt="alt ?? '클라이밍 영상'" class="vt-img" loading="lazy" @error="onError" />
    <div v-else class="vt-placeholder" :style="grade ? { background: gradeColor(grade) } : {}" aria-hidden="true">
      <span v-if="grade" class="vt-ph-label" :style="{ color: gradeTextColor(gradeColor(grade)) }">{{ title }}</span>
      <span v-else class="vt-ph-label">HOLA</span>
    </div>

    <!-- Play icon overlay (영상임을 명확히 표시) -->
    <span v-if="showPlayIcon" class="vt-play" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    </span>

    <!-- Duration badge -->
    <span v-if="durationLabel" class="vt-dur">{{ durationLabel }}</span>

    <!-- Grade badge -->
    <span v-if="grade && thumbnailUrl && !broken" class="vt-grade-badge" :style="{ background: gradeColor(grade), color: gradeTextColor(gradeColor(grade)) }">{{ grade }}</span>

    <!-- Status badge (pending / analyzing / failed) -->
    <div v-if="status && status !== 'done'" class="vt-status-badge" :class="`vt-status-${status}`">
      <span v-if="status === 'analyzing'" class="vt-ai-dot" />
      <span>{{ statusLabel[status] }}</span>
    </div>

    <!-- Default slot for extra overlays -->
    <slot />
  </div>
</template>

<style scoped>
.vt-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--surface-soft);
}

.vt-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.vt-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface-soft);
  display: grid;
  place-items: center;
}

.vt-ph-label {
  /* font-size: 22px; */
  font-weight: 600;
  color: rgba(0, 0, 0, 0.55);
}

.vt-grade-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 999px;
}

.vt-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
  color: #fff;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  padding-left: 2px;
}

.vt-dur {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 7px;
  border-radius: 999px;
}

.vt-status-badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-chip);
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  background: rgba(247, 247, 245, 0.85);
  color: var(--fg);
}

.vt-status-failed {
  color: var(--hold-pink);
}

.vt-ai-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
  animation: vt-pulse 1s ease-in-out infinite;
}

@keyframes vt-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
