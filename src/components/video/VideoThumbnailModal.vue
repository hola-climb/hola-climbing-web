<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { IonModal } from "@ionic/vue";
import { useUIStore } from "@/stores/ui";

const props = defineProps<{
  open: boolean;
  file: File | null;
}>();

const emit = defineEmits<{
  (e: "apply", result: { thumbnailFile: File | null }): void;
}>();

const uiStore = useUIStore();

type ViewState = "selecting" | "previewing";
const viewState = ref<ViewState>("selecting");

const videoEl = ref<HTMLVideoElement | null>(null);
const trackEl = ref<HTMLElement | null>(null);
const objectUrl = ref<string | null>(null);
const capturedUrl = ref<string | null>(null);
const capturedFile = ref<File | null>(null);
const sourceDuration = ref(0);
const currentSec = ref(0);
const metadataReady = ref(false);
const dragging = ref(false);

const currentPct = computed(() =>
  sourceDuration.value > 0 ? (currentSec.value / sourceDuration.value) * 100 : 0,
);

function cleanupUrls() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
  cleanupCapture();
}

function cleanupCapture() {
  if (capturedUrl.value) {
    URL.revokeObjectURL(capturedUrl.value);
    capturedUrl.value = null;
  }
  capturedFile.value = null;
}

function resetForFile() {
  viewState.value = "selecting";
  metadataReady.value = false;
  sourceDuration.value = 0;
  currentSec.value = 0;
  cleanupUrls();
  if (props.file) {
    objectUrl.value = URL.createObjectURL(props.file);
  }
}

watch(
  () => [props.open, props.file] as const,
  ([open]) => {
    if (open && props.file) resetForFile();
    if (!open) cleanupUrls();
  },
  { immediate: true },
);

function onLoadedMetadata() {
  const el = videoEl.value;
  if (!el || !isFinite(el.duration) || el.duration <= 0) {
    uiStore.showToast("영상 정보를 읽을 수 없어요.", "danger");
    emit("apply", { thumbnailFile: null });
    return;
  }
  sourceDuration.value = el.duration;
  // iOS WKWebView는 currentTime=0에서 검은 프레임을 렌더링하지 않으므로
  // play/pause로 프레임을 강제 디코딩한 뒤 첫 프레임으로 시크한다.
  el.play().catch(() => {}).finally(() => {
    el.pause();
    el.currentTime = Math.min(0.1, el.duration);
  });
  metadataReady.value = true;
}

function onVideoError() {
  uiStore.showToast("영상을 불러올 수 없어요.", "danger");
  emit("apply", { thumbnailFile: null });
}

// ── 스크러버 ────────────────────────────────────────────────────────
function secFromClientX(clientX: number): number {
  const track = trackEl.value;
  if (!track || sourceDuration.value <= 0) return 0;
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return ratio * sourceDuration.value;
}

function seekTo(sec: number) {
  const el = videoEl.value;
  if (!el) return;
  el.pause();
  el.currentTime = Math.min(sourceDuration.value, Math.max(0, sec));
  currentSec.value = el.currentTime;
}

function onPointerDown(e: PointerEvent) {
  if (!metadataReady.value) return;
  dragging.value = true;
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  seekTo(secFromClientX(e.clientX));
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  seekTo(secFromClientX(e.clientX));
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  dragging.value = false;
}

function onSeeked() {
  const el = videoEl.value;
  if (el) currentSec.value = el.currentTime;
}

// ── 프레임 캡처 ──────────────────────────────────────────────────────
async function captureFrame(): Promise<void> {
  const el = videoEl.value;
  if (!el) return;
  el.pause();

  const canvas = document.createElement("canvas");
  canvas.width = el.videoWidth || 640;
  canvas.height = el.videoHeight || 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    uiStore.showToast("프레임 캡처에 실패했어요.", "danger");
    return;
  }
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height);

  const file = await new Promise<File | null>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.85,
    );
  });

  if (!file) {
    uiStore.showToast("프레임 캡처에 실패했어요.", "danger");
    return;
  }

  cleanupCapture();
  capturedFile.value = file;
  capturedUrl.value = URL.createObjectURL(file);
  viewState.value = "previewing";
}

function onReselect() {
  cleanupCapture();
  viewState.value = "selecting";
}

function onSkip() {
  emit("apply", { thumbnailFile: null });
}

function onApply() {
  emit("apply", { thumbnailFile: capturedFile.value });
}

onBeforeUnmount(cleanupUrls);
</script>

<template>
  <IonModal class="thumb-modal" :is-open="open" :initial-breakpoint="1" :breakpoints="[0, 1]">
    <div class="thumb-wrap">
      <div class="grabber" aria-hidden="true" />

      <header class="thumb-head">
        <div class="micro-label">THUMBNAIL</div>
        <h2 class="thumb-title">커버 프레임을 골라요</h2>
        <p class="thumb-sub">타임라인을 밀어 원하는 장면을 선택하세요.</p>
      </header>

      <!-- 영상 미리보기 / 캡처 이미지 -->
      <div class="preview-box">
        <!-- 선택 단계: 비디오 -->
        <video
          v-show="viewState === 'selecting'"
          ref="videoEl"
          class="preview-media"
          :src="objectUrl ?? undefined"
          preload="auto"
          playsinline
          muted
          @loadedmetadata="onLoadedMetadata"
          @error="onVideoError"
          @seeked="onSeeked"
        />
        <!-- 미리보기 단계: 캡처된 이미지 -->
        <img
          v-if="viewState === 'previewing' && capturedUrl"
          class="preview-media"
          :src="capturedUrl"
          alt="선택된 썸네일 프레임"
        />
        <div v-if="viewState === 'previewing'" class="preview-badge" aria-hidden="true">썸네일 미리보기</div>
      </div>

      <!-- 타임라인 스크러버 (선택 단계에서만) -->
      <div v-if="viewState === 'selecting'" class="timeline" :class="{ disabled: !metadataReady }">
        <div
          ref="trackEl"
          class="track"
          aria-label="타임라인"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div class="track-fill" :style="{ width: `${currentPct}%` }" />
          <div
            class="playhead"
            :style="{ left: `${currentPct}%` }"
            role="slider"
            aria-label="재생 위치"
            :aria-valuenow="Math.round(currentSec)"
            :aria-valuemin="0"
            :aria-valuemax="Math.round(sourceDuration)"
          />
        </div>
      </div>

      <!-- 액션 버튼 -->
      <div class="thumb-actions">
        <template v-if="viewState === 'selecting'">
          <button class="act-btn secondary" aria-label="건너뛰기 (자동 첫 프레임)" @click="onSkip">건너뛰기</button>
          <button class="act-btn primary" :disabled="!metadataReady" aria-label="이 프레임으로 설정" @click="captureFrame">이 프레임으로 설정</button>
        </template>
        <template v-else>
          <button class="act-btn secondary" aria-label="다시 선택" @click="onReselect">다시 선택</button>
          <button class="act-btn primary" aria-label="이 썸네일 적용" @click="onApply">적용</button>
        </template>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.thumb-modal {
  --border-radius: var(--r-sheet);
}
.thumb-wrap {
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

.thumb-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.thumb-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.thumb-sub {
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
.preview-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.preview-badge {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: var(--w-bold);
  display: flex;
  align-items: center;
}

.timeline {
  flex-shrink: 0;
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
  cursor: pointer;
}
.track-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--hold-lime) 40%, transparent);
  border-radius: 12px 0 0 12px;
  pointer-events: none;
}
.playhead {
  position: absolute;
  top: 50%;
  width: 18px;
  height: 56px;
  margin-left: -9px;
  transform: translateY(-50%);
  border-radius: 8px;
  background: var(--hold-dark);
  cursor: ew-resize;
  touch-action: none;
}
.playhead::after {
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

.thumb-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.act-btn {
  flex: 1;
  height: 52px;
  border-radius: var(--r-button);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  cursor: pointer;
  transition:
    opacity var(--dur-fast) var(--ease-state),
    transform var(--dur-fast) var(--ease-state);
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
</style>
