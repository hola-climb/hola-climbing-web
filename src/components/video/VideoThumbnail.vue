<script setup lang="ts">
import { ref, computed } from "vue";
import type { AnalysisStatus } from "@/types/api";
import { gradeColor, gradeTextColor } from "@/utils/gradeColor";

const props = defineProps<{
  title: string | null;
  thumbnailUrl?: string | null;
  grade?: string | null;
  gymName?: string | null;
  alt?: string;
  /** 상태 배지 표시 (VideoCard 등에서 사용) */
  status?: AnalysisStatus;
  /** 영상 길이(초). 있을 때만 duration 배지 표시 */
  durationSeconds?: number | null;
  /** 중앙 재생 아이콘 오버레이 숨기기 (기본: 표시) */
  hidePlayIcon?: boolean;
  /** 난이도 칩을 색상 도트만 표시 (텍스트 숨김) */
  dotOnly?: boolean;
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

    <!-- Grade chip (피드와 동일한 스타일) -->
    <span v-if="grade || gymName" class="vt-grade-chip" :class="{ 'vt-grade-chip--dot-only': dotOnly }">
      <span v-if="grade" class="vt-grade-dot" :style="{ background: gradeColor(grade) }" aria-hidden="true" />
      <template v-if="!dotOnly">{{ gymName ?? grade }}</template>
    </span>

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

.vt-grade-chip {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: calc(100% - 16px);
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  border-radius: 5px;
  line-height: 1;
  padding: 5px 8px;
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 1px 3px rgba(20, 22, 28, 0.1);
  backdrop-filter: saturate(140%) blur(6px);
  -webkit-backdrop-filter: saturate(140%) blur(6px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vt-grade-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border: 1px solid rgba(21, 21, 21, 0.1);
  border-radius: 50%;
}
.vt-grade-chip--dot-only {
  padding: 5px;
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
