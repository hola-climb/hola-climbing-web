<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, watch, computed } from "vue";
import BaseSheet from "@/components/common/BaseSheet.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import type { Video, GymGrade, UpdateVideoPayload } from "@/types/api";
import { gymService } from "@/services/gym";
import type { Gym } from "@/types/api";

const props = defineProps<{
  open: boolean;
  video: Video | null;
}>();

const emit = defineEmits<{
  (e: "save", payload: UpdateVideoPayload): void;
  (e: "cancel"): void;
}>();

// ── form state ─────────────────────────────────────────────────────────────
const title = ref("");
const description = ref("");
const isPublic = ref(true);
const recordedDate = ref("");

// gym
const gymQuery = ref("");
const gymSearchResults = ref<Gym[]>([]);
const isSearchingGym = ref(false);
const selectedGym = ref<{ id: string; name: string } | null>(null);
let gymSearchTimer: ReturnType<typeof setTimeout> | null = null;

// grade
const grades = ref<GymGrade[]>([]);
const selectedGradeId = ref<number | null>(null);
const isLoadingGrades = ref(false);

const isSaving = ref(false);

// ── sync from video prop ────────────────────────────────────────────────────
watch(
  () => [props.open, props.video] as const,
  ([open, video]) => {
    if (!open || !video) return;
    title.value = video.title ?? "";
    description.value = video.description ?? "";
    isPublic.value = video.isPublic;
    recordedDate.value = (video as unknown as { recordedDate?: string | null }).recordedDate ?? "";
    if (video.gym) {
      selectedGym.value = { id: String(video.gym.id), name: video.gym.name };
      gymQuery.value = video.gym.name;
      loadGrades(String(video.gym.id));
    } else {
      selectedGym.value = null;
      gymQuery.value = "";
      grades.value = [];
    }
    selectedGradeId.value = video.gymGrade?.id ?? null;
    gymSearchResults.value = [];
  },
  { immediate: true },
);

// ── gym search ─────────────────────────────────────────────────────────────
function onGymInput() {
  selectedGym.value = null;
  selectedGradeId.value = null;
  grades.value = [];
  if (gymSearchTimer) clearTimeout(gymSearchTimer);
  if (!gymQuery.value.trim()) { gymSearchResults.value = []; return; }
  gymSearchTimer = setTimeout(searchGyms, 300);
}

async function searchGyms() {
  isSearchingGym.value = true;
  try {
    const { data } = await gymService.searchRaw({ keyword: gymQuery.value.trim(), page: 0, size: 8 });
    gymSearchResults.value = data;
  } catch {
    gymSearchResults.value = [];
  } finally {
    isSearchingGym.value = false;
  }
}

async function selectGym(gym: Gym) {
  selectedGym.value = { id: gym.id, name: gym.name };
  gymQuery.value = gym.name;
  gymSearchResults.value = [];
  selectedGradeId.value = null;
  await loadGrades(gym.id);
}

function clearGym() {
  selectedGym.value = null;
  gymQuery.value = "";
  gymSearchResults.value = [];
  grades.value = [];
  selectedGradeId.value = null;
}

async function loadGrades(gymId: string) {
  isLoadingGrades.value = true;
  try {
    const { data } = await gymService.getGrades(gymId);
    grades.value = data;
  } catch {
    grades.value = [];
  } finally {
    isLoadingGrades.value = false;
  }
}

// ── computed ────────────────────────────────────────────────────────────────
const selectedGrade = computed(() => grades.value.find(g => g.id === selectedGradeId.value) ?? null);

// gymId 변경 시 gymGradeId도 필수이므로 저장 가능 여부 확인
const gymChanged = computed(() => {
  const origGymId = props.video?.gym ? String(props.video.gym.id) : null;
  return selectedGym.value?.id !== origGymId;
});

const canSave = computed(() => {
  if (gymChanged.value && !selectedGradeId.value) return false; // gymId 바꿨으면 grade 필수
  return true;
});

// ── save ────────────────────────────────────────────────────────────────────
async function onSave() {
  if (isSaving.value || !canSave.value) return;
  isSaving.value = true;
  try {
    const payload: UpdateVideoPayload = {
      title: title.value.trim() || null,
      description: description.value.trim() || null,
      isPublic: isPublic.value,
      recordedDate: recordedDate.value || null,
    };

    const origGymId = props.video?.gym ? String(props.video.gym.id) : null;
    const newGymId = selectedGym.value?.id ?? null;

    if (newGymId !== origGymId) {
      payload.gymId = newGymId ? Number(newGymId) : null;
      payload.gymGradeId = selectedGradeId.value;
    } else if (selectedGradeId.value !== (props.video?.gymGrade?.id ?? null)) {
      // 같은 암장이지만 등급만 변경
      payload.gymGradeId = selectedGradeId.value;
    }

    emit("save", payload);
  } finally {
    isSaving.value = false;
  }
}

function onCancel() {
  if (!isSaving.value) emit("cancel");
}
</script>

<template>
  <BaseSheet class="edit-modal" :open="open" @close="onCancel">
    <div class="edit-body">
      <header class="edit-head">
        <div class="micro-label">EDIT</div>
        <h2 class="edit-title">영상 정보 수정</h2>
      </header>

      <div class="field-list">
        <!-- 제목 -->
        <div class="field-block">
          <label class="field-label" for="edit-title">제목</label>
          <input id="edit-title" v-model="title" class="field-input" type="text" placeholder="제목 없음" :maxlength="60" :disabled="isSaving" aria-label="영상 제목" />
        </div>

        <!-- 설명 -->
        <div class="field-block">
          <label class="field-label" for="edit-desc">설명</label>
          <textarea id="edit-desc" v-model="description" class="field-input field-textarea" placeholder="설명 없음" :maxlength="300" :disabled="isSaving" aria-label="영상 설명" rows="3" />
        </div>

        <!-- 암장 -->
        <div class="field-block gym-block">
          <label class="field-label" for="edit-gym">암장</label>
          <div class="gym-input-row">
            <input
              id="edit-gym"
              v-model="gymQuery"
              class="field-input"
              type="search"
              placeholder="암장 이름 검색"
              :disabled="isSaving"
              aria-label="암장 검색"
              aria-autocomplete="list"
              @input="onGymInput"
            />
            <button v-if="selectedGym" class="gym-clear-btn" aria-label="암장 선택 취소" @click="clearGym">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <!-- 검색 결과 드롭다운 -->
          <ul v-if="gymSearchResults.length" class="gym-dropdown" role="listbox">
            <li v-if="isSearchingGym" class="gym-option gym-option--hint">검색 중…</li>
            <li
              v-for="gym in gymSearchResults"
              :key="gym.id"
              class="gym-option"
              role="option"
              :aria-selected="selectedGym?.id === gym.id"
              @click="selectGym(gym)"
            >
              <span class="gym-opt-name">{{ gym.name }}</span>
              <span class="gym-opt-addr">{{ gym.address }}</span>
            </li>
          </ul>
          <p v-if="selectedGym" class="gym-selected-hint">✓ {{ selectedGym.name }}</p>
        </div>

        <!-- 난이도 (암장 선택 시 노출) -->
        <div v-if="selectedGym" class="field-block">
          <span class="field-label">난이도</span>
          <div v-if="isLoadingGrades" class="grade-hint">불러오는 중…</div>
          <div v-else-if="grades.length" class="grade-chips" role="radiogroup" aria-label="난이도 선택">
            <button
              v-for="g in grades"
              :key="g.id"
              class="grade-chip-btn"
              :class="{ selected: selectedGradeId === g.id }"
              role="radio"
              :aria-checked="selectedGradeId === g.id"
              :disabled="isSaving"
              @click="selectedGradeId = g.id"
            >
              {{ g.label }}
            </button>
          </div>
          <div v-else class="grade-hint">등록된 난이도가 없어요</div>
          <p v-if="gymChanged && !selectedGradeId" class="grade-required">암장을 변경하면 난이도를 선택해야 해요</p>
        </div>

        <!-- 촬영 날짜 -->
        <div class="field-block">
          <label class="field-label" for="edit-date">촬영 날짜</label>
          <input id="edit-date" v-model="recordedDate" class="field-input" type="date" :disabled="isSaving" aria-label="촬영 날짜" />
        </div>

        <!-- 공개 여부 -->
        <div class="field-block vis-block">
          <span class="field-label">공개 여부</span>
          <button class="vis-toggle" :class="{ on: isPublic }" role="switch" :aria-checked="isPublic" :disabled="isSaving" aria-label="공개 여부 토글" @click="isPublic = !isPublic">
            <span class="vis-thumb" />
          </button>
          <span class="vis-label">{{ isPublic ? "전체 공개" : "비공개" }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="edit-actions">
        <BaseButton variant="secondary" class="action-cancel" :disabled="isSaving" @click="onCancel">취소</BaseButton>
        <BaseButton variant="accent" class="action-save" :loading="isSaving" :disabled="!canSave" @click="onSave">저장</BaseButton>
      </div>
    </template>
  </BaseSheet>
</template>

<style scoped>
.edit-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.edit-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.edit-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.field-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 10px 14px;
}
.field-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-bottom: 4px;
}
.field-input {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--fg);
  outline: none;
  resize: none;
}
.field-input::placeholder { color: var(--fg-muted); font-weight: 400; }
.field-textarea { line-height: 1.5; padding: 0; }

/* ── Gym search ─────────────────────────────────── */
.gym-block { position: relative; }
.gym-input-row { display: flex; align-items: center; gap: 6px; }
.gym-clear-btn {
  background: none; border: none; padding: 2px; cursor: pointer;
  color: var(--fg-muted); display: grid; place-items: center; flex-shrink: 0;
}
.gym-dropdown {
  list-style: none; margin: 8px 0 0; padding: 0;
  border: 1px solid var(--border); border-radius: 12px;
  overflow: hidden; background: var(--surface);
}
.gym-option {
  padding: 10px 12px; cursor: pointer;
  display: flex; flex-direction: column; gap: 2px;
  transition: background var(--dur-fast) var(--ease-state);
}
.gym-option:active, .gym-option:hover { background: var(--surface-soft); }
.gym-option--hint { color: var(--fg-muted); font-size: 13px; cursor: default; }
.gym-opt-name { font-size: 14px; font-weight: 600; color: var(--fg); }
.gym-opt-addr { font-size: 11px; color: var(--fg-muted); }
.gym-selected-hint { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: var(--hold-lime-dark, #7aaa00); }

/* ── Grade chips ─────────────────────────────────── */
.grade-chips {
  display: flex; flex-wrap: wrap; gap: 6px; padding-top: 4px;
}
.grade-chip-btn {
  padding: 5px 12px; border-radius: 999px;
  border: 1.5px solid var(--border); background: var(--surface-soft);
  font-family: var(--font-sans); font-size: 13px; font-weight: 600;
  color: var(--fg); cursor: pointer;
  transition: all var(--dur-fast) var(--ease-state);
}
.grade-chip-btn.selected {
  background: var(--hold-dark); color: #fff; border-color: var(--hold-dark);
}
.grade-chip-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.grade-hint { font-size: 13px; color: var(--fg-muted); padding: 4px 0; }
.grade-required { margin: 6px 0 0; font-size: 12px; color: var(--hold-pink); font-weight: 600; }

/* ── Visibility toggle ───────────────────────────── */
.vis-block {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
}
.vis-block .field-label { flex: 1; margin: 0; }
.vis-toggle {
  width: 44px; height: 26px; background: var(--surface-soft);
  border: none; border-radius: 999px; position: relative;
  cursor: pointer; flex-shrink: 0;
  transition: background var(--dur-base) var(--ease-state);
}
.vis-toggle.on { background: var(--hold-lime); }
.vis-toggle:disabled { opacity: 0.4; cursor: not-allowed; }
.vis-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.15);
  transition: left var(--dur-base) var(--ease-state);
}
.vis-toggle.on .vis-thumb { left: 21px; }
.vis-label { font-size: var(--fs-caption); font-weight: 600; color: var(--fg-muted); min-width: 48px; }

/* ── Actions ─────────────────────────────────────── */
.edit-actions { display: flex; gap: 8px; }
.action-cancel { flex: 1; }
.action-save { flex: 1.4; }
</style>
