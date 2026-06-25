<script setup lang="ts">
import { ref, computed } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import { useRouter } from "vue-router";
import { useVideoStore } from "@/stores/video";
import { useUIStore } from "@/stores/ui";
import { gymService } from "@/services/gym";
import type { Gym, GymGrade } from "@/types/api";
import VideoTrimModal from "@/components/video/VideoTrimModal.vue";
import VideoThumbnailModal from "@/components/video/VideoThumbnailModal.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import { getErrorMessage } from "@/utils/apiError";

const router = useRouter();
const videoStore = useVideoStore();
const uiStore = useUIStore();

const MAX_DURATION = 60;

type UploadState = "idle" | "uploading" | "failed";
const uploadState = ref<UploadState>("idle");

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const durationSeconds = ref<number | null>(null);

// Trim editor
const trimEditorOpen = ref(false);
const pendingFile = ref<File | null>(null);

// Thumbnail selector
const thumbnailSelectorOpen = ref(false);
const selectedThumbnail = ref<File | null>(null);
const title = ref("");
const isPublic = ref(true);
const recordedDate = ref(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

// Gym search + selection
const gymQuery = ref("");
const gymResults = ref<Gym[]>([]);
const selectedGym = ref<Gym | null>(null);
let gymSearchTimer: ReturnType<typeof setTimeout> | null = null;
let gymSearchSeq = 0;

// Grade selection (depends on selected gym)
const grades = ref<GymGrade[]>([]);
const selectedGradeId = ref<number | null>(null);

const ringCirc = 2 * Math.PI * 42;
const uploadPct = computed(() => videoStore.uploadProgress);

const canSubmit = computed(() => !videoStore.isUploading && !!selectedFile.value && !!selectedGym.value && selectedGradeId.value != null && !!recordedDate.value);

function openFilePicker() {
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("video/")) {
    uiStore.showToast("동영상 파일만 업로드할 수 있어요.", "danger");
    return;
  }
  receivePicked(file);
  input.value = ""; // 동일 파일 재선택 시 change 가 다시 발화하도록 초기화
}

function receivePicked(file: File) {
  pendingFile.value = file;
  trimEditorOpen.value = true;
}

function onTrimApply(result: { file: File; durationSeconds: number }) {
  selectedFile.value = result.file;
  durationSeconds.value = result.durationSeconds;
  pendingFile.value = null;
  trimEditorOpen.value = false;
  thumbnailSelectorOpen.value = true;
}

function onTrimCancel() {
  pendingFile.value = null;
  trimEditorOpen.value = false;
}

function onThumbnailApply(result: { thumbnailFile: File | null }) {
  selectedThumbnail.value = result.thumbnailFile;
  thumbnailSelectorOpen.value = false;
}

function onGymQuery() {
  selectedGym.value = null;
  grades.value = [];
  selectedGradeId.value = null;
  if (gymSearchTimer) clearTimeout(gymSearchTimer);
  const seq = ++gymSearchSeq;
  const q = gymQuery.value.trim();
  if (!q) {
    gymResults.value = [];
    return;
  }
  gymSearchTimer = setTimeout(async () => {
    try {
      const { data } = await gymService.search({ keyword: q, page: 0, size: 8 });
      if (seq !== gymSearchSeq) return;
      gymResults.value = data.content;
    } catch {
      if (seq !== gymSearchSeq) return;
      gymResults.value = [];
    }
  }, 300);
}

async function pickGym(gym: Gym) {
  if (gymSearchTimer) clearTimeout(gymSearchTimer);
  gymSearchSeq++;
  selectedGym.value = gym;
  gymQuery.value = gym.name;
  gymResults.value = [];
  grades.value = [];
  selectedGradeId.value = null;
  try {
    const { data } = await gymService.getGrades(gym.id);
    grades.value = data;
  } catch {
    uiStore.showToast("난이도 목록을 불러오지 못했어요.", "danger");
  }
}

async function handleSubmit() {
  if (!canSubmit.value || !selectedFile.value || !selectedGym.value || selectedGradeId.value == null) return;
  uploadState.value = "uploading";
  try {
    const video = await videoStore.uploadVideo({
      file: selectedFile.value,
      gymId: Number(selectedGym.value.id),
      gymGradeId: selectedGradeId.value,
      recordedDate: recordedDate.value,
      isPublic: isPublic.value,
      title: title.value.trim() || undefined,
      durationSeconds: durationSeconds.value ?? undefined,
      thumbnailFile: selectedThumbnail.value,
    });

    uiStore.showToast("영상 업로드 완료! AI 분석을 시작해요.");
    router.replace(`/my/videos/${video.id}`);
  } catch (err: unknown) {
    uploadState.value = "failed";
    uiStore.showToast(getErrorMessage(err, "업로드에 실패했어요."), "danger");
  }
}
</script>

<template>
  <IonPage>
    <IonContent>
      <!-- Sheet wrapper — full screen but styled as bottom sheet -->
      <div class="sheet-bg">
        <!-- Handle -->
        <div class="handle-area">
          <div class="handle" aria-hidden="true" />
        </div>

        <!-- ── IDLE STATE ─────────────────────────────── -->
        <div v-if="uploadState === 'idle'" class="state-pad">
          <!-- Header row -->
          <div class="idle-header">
            <div class="micro-label">NEW CLIMB</div>
            <button class="close-btn" @click="router.back()" aria-label="닫기">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h1 class="drop-title">Drop a clip.</h1>
          <p class="drop-sub">AI가 베타를 찾고 그레이드를 제안해드려요.</p>

          <!-- Upload picker zone -->
          <div class="picker-zone" @click="openFilePicker" role="button" tabindex="0" aria-label="영상 파일 선택" @keydown.enter="openFilePicker">
            <input ref="fileInput" type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/ogg" class="hidden-input" @change="onFileChange" />
            <div class="picker-icon-wrap">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v13M5 10l7-7 7 7M5 21h14" />
              </svg>
            </div>
            <div class="picker-text">{{ selectedFile ? selectedFile.name : "영상 선택" }}</div>
            <div class="picker-hint">최대 60초 · MP4 / MOV</div>
            <div class="picker-btns">
              <button class="picker-btn primary" @click.stop="openFilePicker" aria-label="라이브러리에서 선택">라이브러리</button>
            </div>
          </div>

          <!-- Title (optional) -->
          <div class="field-stub mt-4">
            <div class="micro-label">TITLE</div>
            <input v-model="title" class="field-input" placeholder="오늘의 빨강 도전 (선택)" aria-label="제목" :maxlength="60" />
          </div>

          <!-- Gym search + select -->
          <div class="field-stub gym-stub mt-3">
            <div class="micro-label">GYM</div>
            <input v-model="gymQuery" class="field-input" placeholder="암장 이름 검색" aria-label="암장 검색" @input="onGymQuery" />
            <ul v-if="gymResults.length" class="gym-results">
              <li v-for="g in gymResults" :key="g.id">
                <button class="gym-result-item" @click="pickGym(g)">
                  <span class="gr-name">{{ g.name }}</span>
                  <span class="gr-addr">{{ g.address }}</span>
                </button>
              </li>
            </ul>
          </div>

          <!-- Grade select (after gym chosen) -->
          <div v-if="selectedGym" class="field-stub mt-3">
            <div class="micro-label">GRADE</div>
            <div v-if="grades.length" class="grade-chips">
              <button v-for="gr in grades" :key="gr.id" class="grade-chip" :class="{ active: selectedGradeId === gr.id }" @click="selectedGradeId = gr.id">
                {{ gr.label }}
              </button>
            </div>
            <p v-else class="picker-hint mt-2">난이도 정보가 없어요.</p>
          </div>

          <!-- Recorded date + public toggle -->
          <div class="quick-fields mt-3">
            <div class="field-stub">
              <div class="micro-label">DATE</div>
              <input v-model="recordedDate" type="date" class="field-input" aria-label="촬영일" />
            </div>
            <div class="field-stub vis-stub">
              <div class="micro-label">PUBLIC</div>
              <button class="vis-toggle" :class="{ on: isPublic }" role="switch" :aria-checked="isPublic" @click="isPublic = !isPublic">
                <span class="vis-thumb" />
              </button>
            </div>
          </div>

          <!-- Submit CTA -->
          <BaseButton variant="accent" block class="analyze-btn" :disabled="!canSubmit" aria-label="업로드 및 분석 시작" @click="handleSubmit">업로드</BaseButton>

          <!-- Trim editor -->
          <VideoTrimModal :open="trimEditorOpen" :file="pendingFile" :max-duration="MAX_DURATION" @apply="onTrimApply" @cancel="onTrimCancel" />

          <!-- Thumbnail frame selector -->
          <VideoThumbnailModal :open="thumbnailSelectorOpen" :file="selectedFile" @apply="onThumbnailApply" />
        </div>

        <!-- ── UPLOADING STATE ────────────────────────── -->
        <div v-else-if="uploadState === 'uploading'" class="state-pad center-state">
          <div class="glow glow-dark" aria-hidden="true" />
          <div class="ring-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden="true">
              <circle cx="55" cy="55" r="42" fill="none" stroke="var(--border)" stroke-width="6" />
              <circle
                cx="55"
                cy="55"
                r="42"
                fill="none"
                stroke="var(--hold-dark)"
                stroke-width="6"
                stroke-linecap="round"
                :stroke-dasharray="ringCirc"
                :stroke-dashoffset="ringCirc * (1 - uploadPct / 100)"
                transform="rotate(-90 55 55)"
              />
              <text x="55" y="62" text-anchor="middle" font-size="20" font-weight="800" fill="var(--fg)">{{ uploadPct }}%</text>
            </svg>
          </div>
          <div class="micro-label mt-6">UPLOADING</div>
          <div class="state-title">클립을 전송하는 중…</div>
          <div class="state-sub">업로드가 끝나면 AI 분석이 시작돼요.</div>
        </div>

        <!-- ── FAILED STATE ───────────────────────────── -->
        <div v-else-if="uploadState === 'failed'" class="state-pad center-state">
          <div class="fail-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div class="micro-label mt-6">FAILED</div>
          <div class="state-title">업로드에 실패했어요</div>
          <div class="state-sub">네트워크 상태를 확인하고 다시 시도해 주세요.</div>
          <div class="done-actions">
            <button class="action-btn secondary" @click="uploadState = 'idle'">처음으로</button>
            <button class="action-btn primary" :disabled="!canSubmit" @click="handleSubmit">다시 시도</button>
          </div>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* ── Sheet wrapper ──────────────────────────────── */
.sheet-bg {
  background: var(--bg);
  border-radius: 28px 28px 0 0;
  min-height: 100vh;
  padding-bottom: 40px;
}

.handle-area {
  display: grid;
  place-items: center;
  padding: 10px 0 4px;
}
.handle {
  width: 42px;
  height: 5px;
  border-radius: 999px;
  background: var(--border);
}

/* ── Shared state layout ────────────────────────── */
.state-pad {
  padding: 12px 20px 0;
}
.center-state {
  text-align: center;
  position: relative;
  padding-top: 16px;
}

/* ── Idle ───────────────────────────────────────── */
.idle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
/* .micro-label — canonical style in global.css */
.close-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--fg);
  display: grid;
  place-items: center;
}
.drop-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 4px 0 0;
}
.drop-sub {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  margin: 6px 0 0;
}

.picker-zone {
  margin-top: 18px;
  background: var(--surface);
  border: 1.5px dashed var(--border);
  border-radius: 20px;
  padding: 28px;
  text-align: center;
  cursor: pointer;
}
.hidden-input {
  display: none;
}
.picker-icon-wrap {
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--tint-lime);
  color: var(--on-tint-lime);
}
.picker-text {
  font-size: 16px;
  font-weight: 700;
  margin-top: 14px;
}
.picker-hint {
  font-size: 12px;
  color: var(--fg-muted);
  margin-top: 4px;
}
.picker-btns {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}
.picker-btn {
  height: 44px;
  padding: 0 16px;
  border-radius: 16px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: opacity var(--dur-fast) var(--ease-state);
}
.picker-btn:active {
  opacity: 0.8;
}
.picker-btn.primary {
  background: var(--hold-dark);
  border: none;
  color: #fff;
}

.quick-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}
.field-stub {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 10px 14px;
}
.field-input {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  margin-top: 2px;
  outline: none;
}
.field-input::placeholder {
  color: var(--fg-muted);
  font-weight: 400;
}

/* Gym search results */
.gym-stub {
  position: relative;
}
.gym-results {
  list-style: none;
  margin: 8px 0 0;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-button);
  box-shadow: var(--shadow-float);
  max-height: 220px;
  overflow-y: auto;
}
.gym-result-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
}
.gym-result-item:active {
  background: var(--surface-soft);
}
.gr-name {
  font-size: var(--fs-body);
  font-weight: 700;
}
.gr-addr {
  font-size: 11px;
  color: var(--fg-muted);
}

/* Grade chips */
.grade-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.grade-chip {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-state),
    color var(--dur-fast) var(--ease-state);
}
.grade-chip.active {
  background: var(--hold-dark);
  color: #fff;
  border-color: var(--hold-dark);
}

/* Visibility toggle */
.vis-stub {
  display: flex;
  flex-direction: column;
}
.vis-toggle {
  width: 44px;
  height: 26px;
  margin-top: 6px;
  background: var(--surface-soft);
  border: none;
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: background var(--dur-base) var(--ease-state);
}
.vis-toggle.on {
  background: var(--hold-lime);
}
.vis-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  transition: left var(--dur-base) var(--ease-state);
}
.vis-toggle.on .vis-thumb {
  left: 21px;
}

.analyze-btn {
  margin-top: 18px;
}

/* ── Uploading ───────────────────────────────────── */
.glow {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
  pointer-events: none;
  left: 50%;
  top: -40px;
  transform: translateX(-50%);
}
.glow-dark {
  background: var(--hold-dark);
}
.glow-cyan {
  background: var(--hold-cyan);
}

.ring-wrap {
  display: grid;
  place-items: center;
  margin-top: 20px;
  position: relative;
}
.state-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 6px;
}
.state-sub {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  margin-top: 6px;
  padding: 0 24px;
}

/* ── Analyzing ───────────────────────────────────── */
.breathing-hold {
  position: relative;
  width: 130px;
  height: 130px;
  display: grid;
  place-items: center;
  margin: 20px auto 0;
}
.breathe-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--tint-cyan);
  animation: breathe 1800ms ease-in-out infinite;
}
.hold-svg {
  position: relative;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.88);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

.progress-list {
  margin-top: 22px;
  padding: 0 28px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.progress-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--hold-lime);
  flex-shrink: 0;
}
.progress-dot.active {
  background: var(--hold-cyan);
  animation: breathe 1400ms ease-in-out infinite;
}
.progress-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-muted);
}
.progress-text.active {
  color: var(--fg);
}

/* ── Done ───────────────────────────────────────── */
.done-check-wrap {
  display: grid;
  place-items: center;
  margin-top: 10px;
}
.done-check {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--tint-lime);
  display: grid;
  place-items: center;
}
.done-text-center {
  text-align: center;
  margin-top: 16px;
}
.done-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 4px;
}
.done-sub {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  margin-top: 6px;
  padding: 0 24px;
}
.done-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 20px;
}
.done-stat {
  padding: 12px 14px;
  text-align: center;
}
.done-stat-val {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.015em;
  margin-top: 4px;
  color: var(--fg);
}
.done-stat-val.colored {
  color: var(--hold-pink);
}
.done-actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}
.action-btn {
  flex: 1;
  height: 52px;
  border-radius: 16px;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity var(--dur-fast) var(--ease-state),
    transform var(--dur-fast) var(--ease-state);
}
.action-btn:active {
  transform: scale(0.97);
}
.action-btn:disabled {
  opacity: 0.45;
  pointer-events: none;
}

/* ── Failed ──────────────────────────────────────── */
.fail-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin: 10px auto 0;
  border-radius: 50%;
  background: var(--tint-pink);
  color: var(--on-tint-pink);
}
.action-btn.secondary {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--fg);
}
.action-btn.primary {
  background: var(--hold-dark);
  border: none;
  color: #fff;
  flex: 1.4;
}
</style>
