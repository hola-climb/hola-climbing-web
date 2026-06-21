<script setup lang="ts">
// 디자인 시스템 토큰 기반 커스텀 비디오 플레이어.
// 네이티브 controls 대신 컨테이너 기준 absolute 컨트롤바를 사용해
// 리사이즈/방향 전환 시 재생바가 사라지던 문제를 구조적으로 해소한다.
import { ref, computed, onBeforeUnmount } from "vue";
import { IonSpinner } from "@ionic/vue";
import AppIcon from "@/components/common/AppIcon.vue";

const props = defineProps<{ src: string; poster?: string; ariaLabel: string }>();

const videoEl = ref<HTMLVideoElement | null>(null);
const seekTrackEl = ref<HTMLDivElement | null>(null);

const isPlaying = ref(false);
const isBuffering = ref(false);
const isFullscreen = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const controlsVisible = ref(true);
const dragging = ref(false);

let hideTimer: ReturnType<typeof setTimeout> | null = null;

const progressPct = computed(() => (duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0));

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── 컨트롤 자동 숨김 ─────────────────────────────────
function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}
function scheduleHide() {
  clearHideTimer();
  if (isPlaying.value && !dragging.value) {
    hideTimer = setTimeout(() => {
      controlsVisible.value = false;
    }, 2500);
  }
}
function showControls() {
  controlsVisible.value = true;
  scheduleHide();
}

// ── 재생 제어 ────────────────────────────────────────
function togglePlay() {
  const el = videoEl.value;
  if (!el) return;
  if (el.paused) {
    void el.play();
  } else {
    el.pause();
  }
}

function onPlay() {
  isPlaying.value = true;
  scheduleHide();
}
function onPause() {
  isPlaying.value = false;
  isBuffering.value = false;
  clearHideTimer();
  controlsVisible.value = true;
}
function onEnded() {
  isPlaying.value = false;
  controlsVisible.value = true;
}
function onWaiting() {
  isBuffering.value = true;
}
function onPlaying() {
  isBuffering.value = false;
}
function onLoadedMetadata() {
  if (videoEl.value) duration.value = videoEl.value.duration || 0;
}
function onTimeUpdate() {
  if (dragging.value) return;
  if (videoEl.value) currentTime.value = videoEl.value.currentTime;
}

// ── 시크바 드래그 (VideoTrimModal 패턴) ───────────────
function timeFromClientX(clientX: number): number {
  const track = seekTrackEl.value;
  if (!track || duration.value <= 0) return 0;
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return ratio * duration.value;
}
function onSeekPointerDown(e: PointerEvent) {
  if (duration.value <= 0) return;
  dragging.value = true;
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  currentTime.value = timeFromClientX(e.clientX);
  showControls();
}
function onSeekPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  currentTime.value = timeFromClientX(e.clientX);
}
function onSeekPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  if (videoEl.value) videoEl.value.currentTime = currentTime.value;
  dragging.value = false;
  scheduleHide();
}

// ── 전체화면 ─────────────────────────────────────────
async function toggleFullscreen() {
  const el = videoEl.value;
  if (!el) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      isFullscreen.value = false;
    } else {
      await el.requestFullscreen();
      isFullscreen.value = true;
    }
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
  }
}

onBeforeUnmount(clearHideTimer);
</script>

<template>
  <div class="player" @pointermove="showControls" @click="showControls">
    <video
      ref="videoEl"
      class="player-video"
      :src="src"
      :poster="poster"
      playsinline
      webkit-playsinline
      preload="metadata"
      :aria-label="ariaLabel"
      @click.stop="togglePlay"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @waiting="onWaiting"
      @playing="onPlaying"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
    />

    <!-- 버퍼링 -->
    <div v-if="isBuffering" class="buffering" role="status" aria-live="polite">
      <IonSpinner name="crescent" />
    </div>

    <!-- 중앙 재생/일시정지 토글 (정지 상태에서 노출) -->
    <button v-show="!isPlaying" class="center-toggle" :aria-label="isPlaying ? '일시정지' : '재생'" @click.stop="togglePlay">
      <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="28" />
    </button>

    <!-- 하단 컨트롤바 -->
    <div class="controls-bar" :class="{ hidden: !controlsVisible }" @click.stop>
      <button class="ctrl-btn" :aria-label="isPlaying ? '일시정지' : '재생'" @click="togglePlay">
        <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="18" />
      </button>

      <span class="time time-current">{{ formatDuration(currentTime) }}</span>

      <div
        ref="seekTrackEl"
        class="seek"
        @pointerdown="onSeekPointerDown"
        @pointermove="onSeekPointerMove"
        @pointerup="onSeekPointerUp"
        @pointercancel="onSeekPointerUp"
      >
        <div class="seek-track">
          <div class="seek-fill" :style="{ width: `${progressPct}%` }" />
        </div>
        <button
          class="seek-thumb"
          :style="{ left: `${progressPct}%` }"
          role="slider"
          aria-label="재생 위치"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(duration)"
          :aria-valuenow="Math.round(currentTime)"
        />
      </div>

      <span class="time time-total">{{ formatDuration(duration) }}</span>

      <button class="ctrl-btn" :aria-label="isFullscreen ? '전체화면 종료' : '전체화면'" @click="toggleFullscreen">
        <AppIcon :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'" :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}
.player-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* 버퍼링 */
.buffering {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.buffering ion-spinner {
  --color: #fff;
  width: 36px;
  height: 36px;
}

/* 중앙 토글 */
.center-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: rgba(20, 22, 28, 0.55);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-state), background var(--dur-fast) var(--ease-state);
}
.center-toggle:active {
  transform: translate(-50%, -50%) scale(0.94);
}

/* 하단 컨트롤바 */
.controls-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(20, 22, 28, 0.65), transparent);
  transition: opacity var(--dur-base) var(--ease-state);
  z-index: 2;
}
.controls-bar.hidden {
  opacity: 0;
  pointer-events: none;
}

.ctrl-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: var(--r-button, 14px);
  transition: transform var(--dur-fast) var(--ease-state);
}
.ctrl-btn:active {
  transform: scale(0.9);
}

.time {
  flex-shrink: 0;
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.9);
}

/* 시크바 */
.seek {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 28px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}
.seek-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
  overflow: hidden;
}
.seek-fill {
  height: 100%;
  background: var(--hold-cyan);
  border-radius: 999px;
}
.seek-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  transform: translateY(-50%);
  border: none;
  border-radius: 50%;
  background: var(--hold-cyan);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  cursor: grab;
  padding: 0;
}
.seek-thumb:active {
  cursor: grabbing;
}
</style>
