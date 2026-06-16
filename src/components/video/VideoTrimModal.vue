<script setup lang="ts">
// imports → props/emits → composables → state → computed → methods
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { IonModal, IonSpinner } from "@ionic/vue";
import { useVideoTrim } from "@/composables/useVideoTrim";
import { useUIStore } from "@/stores/ui";
import { clampSelection, formatMMSS } from "@/utils/videoTrim";

const props = defineProps<{
  open: boolean;
  file: File | null;
  maxDuration: number;
}>();

const emit = defineEmits<{
  (e: "apply", result: { file: File; durationSeconds: number }): void;
  (e: "cancel"): void;
}>();

const uiStore = useUIStore();
const { loadState, trimProgress, ensureLoaded, trim } = useVideoTrim();

const MAX_FILE_BYTES = 300 * 1024 * 1024; // 300MB 메모리 가드

type ViewState = "editing" | "engineLoading" | "processing";
const viewState = ref<ViewState>("editing");

const videoEl = ref<HTMLVideoElement | null>(null);
const trackEl = ref<HTMLElement | null>(null);
const objectUrl = ref<string | null>(null);
const sourceDuration = ref(0);
const metadataReady = ref(false);

const startSec = ref(0);
const endSec = ref(0);
const dragging = ref<"start" | "end" | null>(null);

const selectedDuration = computed(() => Math.max(0, endSec.value - startSec.value));
const startPct = computed(() => (sourceDuration.value > 0 ? (startSec.value / sourceDuration.value) * 100 : 0));
const endPct = computed(() => (sourceDuration.value > 0 ? (endSec.value / sourceDuration.value) * 100 : 100));
const overLimit = computed(() => selectedDuration.value > props.maxDuration);
const canApply = computed(() => metadataReady.value && selectedDuration.value >= 1 && !overLimit.value && viewState.value === "editing");

const selectedLabel = computed(() => formatMMSS(selectedDuration.value));
const sourceLabel = computed(() => formatMMSS(sourceDuration.value));

function cleanupUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
}

function resetForFile() {
  viewState.value = "editing";
  metadataReady.value = false;
  sourceDuration.value = 0;
  startSec.value = 0;
  endSec.value = 0;
  trimProgress.value = 0;
  cleanupUrl();
  if (props.file) {
    if (props.file.size > MAX_FILE_BYTES) {
      uiStore.showToast("파일이 너무 커서 편집할 수 없어요. 더 짧거나 작은 영상을 선택해 주세요.", "danger");
      emit("cancel");
      return;
    }
    objectUrl.value = URL.createObjectURL(props.file);
  }
}

watch(
  () => [props.open, props.file] as const,
  ([open]) => {
    if (open && props.file) resetForFile();
    if (!open) cleanupUrl();
  },
  { immediate: true },
);

function onLoadedMetadata() {
  const el = videoEl.value;
  if (!el || !isFinite(el.duration) || el.duration <= 0) {
    onVideoError();
    return;
  }
  sourceDuration.value = el.duration;
  startSec.value = 0;
  // 초기 선택 구간: 최대 maxDuration 까지.
  endSec.value = Math.min(el.duration, props.maxDuration);
  metadataReady.value = true;
}

function onVideoError() {
  uiStore.showToast("영상 정보를 읽을 수 없어요.", "danger");
  emit("cancel");
}

// ── 핸들 드래그 ────────────────────────────────────────────────
function secFromClientX(clientX: number): number {
  const track = trackEl.value;
  if (!track || sourceDuration.value <= 0) return 0;
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return ratio * sourceDuration.value;
}

function seekTo(sec: number) {
  const el = videoEl.value;
  if (el) el.currentTime = Math.min(sourceDuration.value, Math.max(0, sec));
}

function onPointerDown(which: "start" | "end", e: PointerEvent) {
  if (!metadataReady.value) return;
  dragging.value = which;
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  const sec = secFromClientX(e.clientX);
  if (dragging.value === "start") {
    const next = Math.min(sec, endSec.value - 0.1);
    startSec.value = Math.max(0, next);
    seekTo(startSec.value);
  } else {
    const next = Math.max(sec, startSec.value + 0.1);
    endSec.value = Math.min(sourceDuration.value, next);
    seekTo(endSec.value);
  }
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  dragging.value = null;
}

function previewSelection() {
  const el = videoEl.value;
  if (!el) return;
  el.currentTime = startSec.value;
  void el.play();
}

function onTimeUpdate() {
  const el = videoEl.value;
  if (!el || dragging.value) return;
  if (el.currentTime >= endSec.value) {
    el.pause();
    el.currentTime = startSec.value;
  }
}

// ── 적용 / 취소 ────────────────────────────────────────────────
async function onApply() {
  if (!props.file || !canApply.value) return;
  const { start, end } = clampSelection(startSec.value, endSec.value, sourceDuration.value);
  try {
    if (loadState.value !== "ready") {
      viewState.value = "engineLoading";
      await ensureLoaded();
    }
    viewState.value = "processing";
    const result = await trim(props.file, start, end);
    viewState.value = "editing";
    emit("apply", result);
  } catch (err) {
    if (import.meta.env.DEV) console.error("trim failed", err);
    const msg = loadState.value === "error" ? "편집 엔진을 불러오지 못했어요. 다시 시도해 주세요." : "영상 편집에 실패했어요. 다시 시도해 주세요.";
    uiStore.showToast(msg, "danger");
    viewState.value = "editing";
  }
}

function onCancel() {
  if (viewState.value === "processing") return; // 처리 중에는 취소 불가
  emit("cancel");
}

onBeforeUnmount(cleanupUrl);
</script>

<template>
  <IonModal class="trim-modal" :is-open="open" :initial-breakpoint="1" :breakpoints="[0, 1]" @did-dismiss="onCancel">
    <div class="trim-wrap">
      <div class="grabber" aria-hidden="true" />

      <header class="trim-head">
        <div class="micro-label">TRIM</div>
        <h2 class="trim-title">필요한 구간만 잘라요</h2>
        <p class="trim-sub">등반 시작·종료 지점을 맞춰 주세요. 최대 {{ maxDuration }}초.</p>
      </header>

      <!-- 미리보기 -->
      <div class="preview-box">
        <video
          v-if="objectUrl"
          ref="videoEl"
          class="preview-video"
          :src="objectUrl"
          preload="metadata"
          playsinline
          muted
          @loadedmetadata="onLoadedMetadata"
          @error="onVideoError"
          @timeupdate="onTimeUpdate"
        />
        <button v-if="metadataReady" class="preview-play" aria-label="선택 구간 미리보기" @click="previewSelection">▶ 미리보기</button>
      </div>

      <!-- 타임라인 스크러버 -->
      <div class="timeline" :class="{ disabled: !metadataReady }">
        <div ref="trackEl" class="track" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
          <div class="track-selected" :style="{ left: `${startPct}%`, width: `${endPct - startPct}%` }" />
          <button
            class="handle handle-start"
            :style="{ left: `${startPct}%` }"
            role="slider"
            aria-label="시작 지점"
            :aria-valuemin="0"
            :aria-valuemax="Math.round(sourceDuration)"
            :aria-valuenow="Math.round(startSec)"
            @pointerdown="onPointerDown('start', $event)"
          />
          <button
            class="handle handle-end"
            :style="{ left: `${endPct}%` }"
            role="slider"
            aria-label="끝 지점"
            :aria-valuemin="0"
            :aria-valuemax="Math.round(sourceDuration)"
            :aria-valuenow="Math.round(endSec)"
            @pointerdown="onPointerDown('end', $event)"
          />
        </div>
        <div class="time-row">
          <span class="time-sel" :class="{ warn: overLimit }">{{ selectedLabel }}</span>
          <span class="time-total">/ {{ sourceLabel }}</span>
        </div>
        <p v-if="overLimit" class="limit-hint">최대 {{ maxDuration }}초까지 잘라낼 수 있어요.</p>
      </div>

      <!-- 액션 -->
      <div class="trim-actions">
        <button class="act-btn secondary" :disabled="viewState === 'processing'" aria-label="취소" @click="onCancel">취소</button>
        <button class="act-btn primary" :disabled="!canApply" aria-label="적용" @click="onApply">적용</button>
      </div>

      <!-- 엔진 로딩 / 처리 오버레이 -->
      <div v-if="viewState !== 'editing'" class="overlay" role="status" aria-live="polite">
        <IonSpinner name="crescent" />
        <template v-if="viewState === 'engineLoading'">
          <div class="ov-title">편집 엔진 준비 중…</div>
          <div class="ov-sub">처음 한 번만 시간이 걸려요.</div>
        </template>
        <template v-else>
          <div class="ov-title">영상을 자르는 중… {{ trimProgress }}%</div>
        </template>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.trim-modal {
  --border-radius: var(--r-sheet);
}
.trim-wrap {
  position: relative;
  height: 100%;
  background: var(--bg);
  padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grabber {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  margin: 0 auto 2px;
}

.trim-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
/* .micro-label — canonical style in global.css */
.trim-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.trim-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0;
}

.preview-box {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #000;
  border-radius: var(--r-card);
  overflow: hidden;
  display: grid;
  place-items: center;
}
.preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.preview-play {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: var(--w-bold);
  cursor: pointer;
}

.timeline.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.track {
  position: relative;
  height: 44px;
  border-radius: 12px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  touch-action: none;
}
.track-selected {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--hold-lime) 40%, transparent);
  border-top: 2px solid var(--hold-lime);
  border-bottom: 2px solid var(--hold-lime);
}
.handle {
  position: absolute;
  top: 50%;
  width: 18px;
  height: 56px;
  margin-left: -9px;
  transform: translateY(-50%);
  border: none;
  border-radius: 8px;
  background: var(--hold-dark);
  cursor: ew-resize;
  touch-action: none;
}
.handle::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 18px;
  transform: translate(-50%, -50%);
  background: #fff;
  border-radius: 2px;
}

.time-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 10px;
}
.time-sel {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
  color: var(--fg);
}
.time-sel.warn {
  color: #d8412f;
}
.time-total {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.limit-hint {
  font-size: 12px;
  color: #d8412f;
  margin: 6px 0 0;
}

.trim-actions {
  display: flex;
  gap: 8px;
}
.act-btn {
  flex: 1;
  height: 52px;
  border-radius: var(--r-button);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  cursor: pointer;
  transition: opacity var(--dur-fast) var(--ease-state), transform var(--dur-fast) var(--ease-state);
}
.act-btn:active {
  transform: scale(0.97);
}
.act-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.act-btn.secondary {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--fg);
}
.act-btn.primary {
  flex: 1.4;
  background: var(--hold-lime);
  border: none;
  color: var(--fg);
}

.overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  z-index: 10;
}
.ov-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
  color: var(--fg);
}
.ov-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
</style>
