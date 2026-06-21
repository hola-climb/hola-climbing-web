<script setup lang="ts">
// imports → router → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import { useRouter, useRoute } from "vue-router";
import LoadingState from "@/components/common/LoadingState.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import { climbingLogService } from "@/services/climbingLog";
import { gymService } from "@/services/gym";
import { useUIStore } from "@/stores/ui";
import { gradeColor } from "@/utils/gradeColor";
import { getErrorMessage } from "@/utils/apiError";
import type { Gym, GymGrade } from "@/types/api";

const router = useRouter();
const route = useRoute();
const uiStore = useUIStore();

// 편집 모드: /climbing-log/:id
const logId = computed(() => (route.params.id ? String(route.params.id) : null));
const isEdit = computed(() => logId.value != null);

const isLoading = ref(false);
const isSaving = ref(false);

// 날짜 (KST 로컬 날짜)
const climbedOn = ref(new Date().toISOString().slice(0, 10));
const memo = ref("");

// 암장 검색 + 선택
const gymQuery = ref("");
const gymResults = ref<Gym[]>([]);
const selectedGym = ref<Gym | null>(null);
let gymSearchTimer: ReturnType<typeof setTimeout> | null = null;
let gymSearchSeq = 0;

// 난이도별 카운트 — 라벨 → 푼 문제 수
interface GradeRow {
  label: string;
  color: string;
  count: number;
}
const gradeRows = ref<GradeRow[]>([]);

const totalProblems = computed(() => gradeRows.value.reduce((sum, r) => sum + r.count, 0));

const canSubmit = computed(() => !isSaving.value && !!selectedGym.value && !!climbedOn.value && totalProblems.value > 0);

// ── 난이도 행 구성 ─────────────────────────────────────
/** 암장 난이도 + 기존 카운트를 병합해 행을 만든다. 암장에서 사라진 라벨도 카운트가 있으면 유지. */
function buildGradeRows(grades: GymGrade[], existing: Record<string, number> = {}) {
  const rows: GradeRow[] = grades
    .slice()
    .sort((a, b) => b.difficultyOrder - a.difficultyOrder)
    .map((g) => ({ label: g.label, color: gradeColor(g.label), count: existing[g.label] ?? 0 }));
  // 암장 난이도 목록에 없지만 기존 기록에 있는 라벨 추가
  for (const [label, count] of Object.entries(existing)) {
    if (!rows.some((r) => r.label === label)) {
      rows.push({ label, color: gradeColor(label), count });
    }
  }
  gradeRows.value = rows;
}

function inc(row: GradeRow) {
  row.count++;
}
function dec(row: GradeRow) {
  if (row.count > 0) row.count--;
}

// ── 암장 검색 ──────────────────────────────────────────
function onGymQuery() {
  selectedGym.value = null;
  gradeRows.value = [];
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

async function pickGym(gym: Gym, existing: Record<string, number> = {}) {
  if (gymSearchTimer) clearTimeout(gymSearchTimer);
  gymSearchSeq++;
  selectedGym.value = gym;
  gymQuery.value = gym.name;
  gymResults.value = [];
  try {
    const { data } = await gymService.getGrades(gym.id);
    buildGradeRows(data, existing);
  } catch {
    uiStore.showToast("난이도 목록을 불러오지 못했어요.", "danger");
    // 난이도 조회 실패 시 기존 카운트만이라도 노출
    buildGradeRows([], existing);
  }
}

// ── 저장 ───────────────────────────────────────────────
async function handleSubmit() {
  if (!canSubmit.value || !selectedGym.value) return;
  // count > 0 인 항목만 전송
  const gradeCounts: Record<string, number> = {};
  for (const row of gradeRows.value) {
    if (row.count > 0) gradeCounts[row.label] = row.count;
  }
  const payload = {
    gymId: Number(selectedGym.value.id),
    climbedOn: climbedOn.value,
    gradeCounts,
    memo: memo.value.trim() || null,
  };

  isSaving.value = true;
  try {
    if (isEdit.value && logId.value) {
      await climbingLogService.update(logId.value, payload);
      uiStore.showToast("기록을 수정했어요.");
    } else {
      await climbingLogService.create(payload);
      uiStore.showToast("클라이밍 기록을 저장했어요.");
    }
    router.replace("/records");
  } catch (err: unknown) {
    uiStore.showToast(getErrorMessage(err, "저장에 실패했어요."), "danger");
  } finally {
    isSaving.value = false;
  }
}

// ── 편집 모드 초기 로드 ────────────────────────────────
async function loadForEdit() {
  if (!logId.value) return;
  isLoading.value = true;
  try {
    const { data } = await climbingLogService.get(logId.value);
    climbedOn.value = data.climbedOn;
    memo.value = data.memo ?? "";
    // 암장 이름 해석 후 선택 상태로 복원
    let gym: Gym = {
      id: String(data.gymId),
      name: "암장",
      address: "",
      latitude: 0,
      longitude: 0,
      thumbnailUrl: null,
      ratingAvg: null,
      ratingCount: 0,
      distanceKm: null,
      isFavorited: false,
      isOpen: false,
    };
    try {
      const { data: g } = await gymService.getGym(String(data.gymId));
      gym = { ...gym, name: g.name, address: g.address };
    } catch {
      /* 이름 해석 실패 시 기본값 유지 */
    }
    await pickGym(gym, data.gradeCounts);
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("기록을 불러오지 못했어요.", "danger");
    router.replace("/records");
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  if (isEdit.value) loadForEdit();
});
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="sheet-bg">
        <div class="handle-area">
          <div class="handle" aria-hidden="true" />
        </div>

        <div class="state-pad">
          <!-- Header -->
          <div class="idle-header">
            <div class="micro-label">{{ isEdit ? "EDIT LOG" : "NEW LOG" }}</div>
            <button class="close-btn" @click="router.back()" aria-label="닫기">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h1 class="drop-title">{{ isEdit ? "기록 수정" : "오늘의 기록" }}</h1>
          <p class="drop-sub">암장과 난이도별 푼 문제 수를 기록해요.</p>

          <!-- Loading (edit prefill) -->
          <div v-if="isLoading" class="center-load">
            <LoadingState variant="list" :count="4" label="기록을 불러오는 중" />
          </div>

          <template v-else>
            <!-- Gym search + select -->
            <div class="field-stub gym-stub mt-4">
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

            <!-- Date -->
            <div class="field-stub mt-3">
              <div class="micro-label">DATE</div>
              <input v-model="climbedOn" type="date" class="field-input" aria-label="등반일" />
            </div>

            <!-- Grade counters (after gym chosen) -->
            <div v-if="selectedGym" class="grades-block mt-3">
              <div class="grades-head">
                <span class="micro-label">GRADES</span>
                <span class="total-pill">{{ totalProblems }} sends</span>
              </div>
              <div v-if="gradeRows.length" class="grade-counters">
                <div v-for="row in gradeRows" :key="row.label" class="counter-row" :class="{ dim: row.count === 0 }">
                  <span class="grade-dot" :style="{ background: row.color }" aria-hidden="true" />
                  <span class="grade-name">{{ row.label }}</span>
                  <div class="stepper">
                    <button class="step-btn" :disabled="row.count === 0" :aria-label="`${row.label} 1개 줄이기`" @click="dec(row)">−</button>
                    <span class="step-count" aria-live="polite">{{ row.count }}</span>
                    <button class="step-btn" :aria-label="`${row.label} 1개 늘리기`" @click="inc(row)">+</button>
                  </div>
                </div>
              </div>
              <p v-else class="picker-hint mt-2">난이도 정보가 없어요.</p>
            </div>

            <!-- Memo -->
            <div class="field-stub mt-3">
              <div class="micro-label">MEMO</div>
              <textarea v-model="memo" class="field-input memo-input" rows="2" placeholder="오늘 컨디션, 느낌 (선택)" aria-label="메모" :maxlength="300" />
            </div>

            <!-- Submit -->
            <BaseButton variant="accent" block class="analyze-btn" :loading="isSaving" :disabled="!canSubmit" :aria-label="isEdit ? '기록 수정 저장' : '기록 저장'" @click="handleSubmit">
              {{ isEdit ? "수정 저장" : "기록 저장" }}
            </BaseButton>
          </template>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
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
.state-pad {
  padding: 12px 20px 0;
}
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
.center-load {
  padding: 24px 0;
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
.memo-input {
  resize: none;
  font-weight: 500;
  line-height: 1.5;
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

/* Grade counters */
.grades-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px 14px;
}
.grades-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.total-pill {
  font-size: 11px;
  font-weight: 800;
  color: var(--fg-muted);
}
.grade-counters {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}
.counter-row {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  transition: opacity var(--dur-fast) var(--ease-state);
}
.counter-row.dim {
  opacity: 0.5;
}
.grade-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.grade-name {
  font-size: var(--fs-body);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
}
.step-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--fg);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background var(--dur-fast) var(--ease-state);
}
.step-btn:active {
  background: var(--border);
}
.step-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.step-count {
  min-width: 26px;
  text-align: center;
  font-size: 15px;
  font-weight: 800;
}

.picker-hint {
  font-size: 12px;
  color: var(--fg-muted);
}

.analyze-btn {
  margin-top: 18px;
}
</style>
