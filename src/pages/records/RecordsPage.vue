<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent } from "@ionic/vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import VideoThumbnail from "@/components/video/VideoThumbnail.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { useRouter } from "vue-router";
import { statsService } from "@/services/stats";
import { gymService } from "@/services/gym";
import { videoService } from "@/services/video";
import { climbingLogService } from "@/services/climbingLog";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { gradeColor, gradeTextColor, gradeDifficulty } from "@/utils/gradeColor";
import type { FeedVideo, GymGrade } from "@/types/api";

// ── Types ──────────────────────────────────────────
interface GradeRow {
  grade: string;
  color: string;
  count: number;
  difficultyOrder: number;
}

interface Session {
  key: string;
  logId: string | null; // 클라이밍 기록 id (없으면 영상 전용 그룹)
  dateLabel: string;
  venue: string;
  totalProblems: number;
  memo: string | null;
  gradeRows: GradeRow[];
  videos: FeedVideo[];
}

interface CalendarCell {
  date: string; // YYYY-MM-DD
  day: number; // 1-31
  hasRecord: boolean; // videoCount > 0 || logCount > 0
  videoCount: number; // 날짜 아래 표시 숫자
  isToday: boolean;
  isCurrentMonth: boolean;
}

/** 달력 한 날짜의 원본 카운트 */
interface DayCount {
  videoCount: number;
  logCount: number;
}

// ── Store / router ─────────────────────────────────
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();
const isDesktop = useMediaQuery("(min-width: 700px)");

// ── State ──────────────────────────────────────────
const now = new Date();
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1); // 1-indexed

const isLoading = ref(true);
const isDetailLoading = ref(false);

/** 이번 달 집계 (달력 응답의 월 단위 합계) */
const monthSummary = ref<{ totalVideos: number; totalProblems: number; totalGymVisits: number }>({
  totalVideos: 0,
  totalProblems: 0,
  totalGymVisits: 0,
});

/** 기록이 있는 날짜: date → { videoCount, logCount } */
const recordMap = ref<Map<string, DayCount>>(new Map());

/** selected date for detail view (null = calendar view) */
const selectedDate = ref<string | null>(null);
const selectedSessions = ref<Session[]>([]);

const gymNameCache = new Map<number, string>();

// ── Computed ───────────────────────────────────────
const monthLabel = computed(() => {
  const d = new Date(year.value, month.value - 1, 1);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
});

/** Calendar grid: starts on Monday */
const calendarCells = computed<CalendarCell[]>(() => {
  const todayStr = toDateStr(new Date());
  const firstDay = new Date(year.value, month.value - 1, 1);
  const lastDay = new Date(year.value, month.value, 0);

  // Mon=0 … Sun=6 offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: CalendarCell[] = [];

  // Prev-month filler
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - (i + 1));
    cells.push({
      date: toDateStr(d),
      day: d.getDate(),
      hasRecord: false,
      videoCount: 0,
      isToday: false,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year.value, month.value - 1, day);
    const dateStr = toDateStr(d);
    const entry = recordMap.value.get(dateStr);
    cells.push({
      date: dateStr,
      day,
      hasRecord: !!entry, // recordMap 에는 videoCount>0 || logCount>0 인 날만 담긴다
      videoCount: entry?.videoCount ?? 0,
      isToday: dateStr === todayStr,
      isCurrentMonth: true,
    });
  }

  // Next-month filler to fill last row
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 1; i <= 7 - remainder; i++) {
      const d = new Date(lastDay);
      d.setDate(d.getDate() + i);
      cells.push({
        date: toDateStr(d),
        day: d.getDate(),
        hasRecord: false,
        videoCount: 0,
        isToday: false,
        isCurrentMonth: false,
      });
    }
  }

  return cells;
});

const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return "";
  const d = new Date(selectedDate.value);
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
});

// ── Helpers ────────────────────────────────────────
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function resolveGymName(gymId: number): Promise<string> {
  if (gymNameCache.has(gymId)) return gymNameCache.get(gymId)!;
  try {
    const { data } = await gymService.getGym(String(gymId));
    const name = data.name ?? "암장";
    gymNameCache.set(gymId, name);
    return name;
  } catch {
    return "암장";
  }
}

const gymGradeCache = new Map<number, GymGrade[]>();

async function resolveGymGrades(gymId: number): Promise<GymGrade[]> {
  if (gymGradeCache.has(gymId)) return gymGradeCache.get(gymId)!;
  try {
    const { data } = await gymService.getGrades(String(gymId));
    gymGradeCache.set(gymId, data);
    return data;
  } catch {
    return [];
  }
}

type DayLog = Awaited<ReturnType<typeof statsService.getCalendarDay>>["data"][number];

/** 클라이밍 기록(log) 기준 세션 빌드 (난이도 바 포함) */
async function buildLogSession(log: DayLog, dayVideos: FeedVideo[]): Promise<Session> {
  const [venue, gymGrades] = await Promise.all([resolveGymName(log.gymId), resolveGymGrades(log.gymId)]);
  const countMap = log.gradeCounts ?? {};

  // All gym grades sorted by difficultyOrder descending (hardest first)
  const gradeRows: GradeRow[] = gymGrades
    .slice()
    .sort((a, b) => b.difficultyOrder - a.difficultyOrder)
    .map((g) => ({
      grade: g.label,
      color: gradeColor(g.label),
      count: (countMap as Record<string, number>)[g.label] ?? 0,
      difficultyOrder: g.difficultyOrder,
    }));

  // Fallback: if no gym grades from API, build from climbed grades only
  if (gradeRows.length === 0) {
    Object.entries(countMap).forEach(([grade, count]) => {
      gradeRows.push({ grade, color: gradeColor(grade), count: count as number, difficultyOrder: gradeDifficulty(grade) });
    });
    gradeRows.sort((a, b) => b.difficultyOrder - a.difficultyOrder);
  }

  // recordedDate 기반으로 이미 날짜 필터됨 → gymId로만 매칭
  const videos = dayVideos.filter((v) => v.gymId === String(log.gymId));
  return {
    key: String(log.id),
    logId: String(log.id),
    dateLabel: selectedDateLabel.value,
    venue,
    totalProblems: log.totalProblems,
    memo: log.memo,
    gradeRows,
    videos,
  };
}

/** 영상만 있는 암장 그룹 빌드 (기록 없음 → 썸네일만) */
async function buildVideoOnlySession(gymId: string, videos: FeedVideo[]): Promise<Session> {
  // 영상 응답의 gymName 우선 사용, 없으면 암장 API 폴백
  const venue = videos.find((v) => v.gymName)?.gymName ?? (await resolveGymName(Number(gymId)));
  return {
    key: `gym-${gymId}`,
    logId: null,
    dateLabel: selectedDateLabel.value,
    venue,
    totalProblems: 0,
    memo: null,
    gradeRows: [],
    videos,
  };
}

/** logs ∪ videos 를 gymId 기준으로 합쳐 세션 목록 생성 (기록 보유 그룹 먼저) */
async function buildSessions(logs: DayLog[], dayVideos: FeedVideo[]): Promise<Session[]> {
  const loggedGymIds = new Set(logs.map((l) => String(l.gymId)));

  // 1) 클라이밍 기록 보유 세션
  const logSessions = await Promise.all(logs.map((log) => buildLogSession(log, dayVideos)));

  // 2) 기록 없는 암장의 영상 전용 세션 (gymId별 그룹)
  const videoOnlyByGym = new Map<string, FeedVideo[]>();
  for (const v of dayVideos) {
    if (!v.gymId || loggedGymIds.has(v.gymId)) continue;
    const list = videoOnlyByGym.get(v.gymId) ?? [];
    list.push(v);
    videoOnlyByGym.set(v.gymId, list);
  }
  const videoOnlySessions = await Promise.all([...videoOnlyByGym.entries()].map(([gymId, videos]) => buildVideoOnlySession(gymId, videos)));

  return [...logSessions, ...videoOnlySessions];
}

// ── Actions ────────────────────────────────────────
/** 달력 카운트 맵 + 월 집계 갱신 (selectedDate 유지) */
async function refreshCalendarMap() {
  const { data } = await statsService.getCalendarRaw(year.value, month.value);
  const map = new Map<string, DayCount>();
  for (const item of data.days ?? []) {
    // 영상 또는 기록이 있는 날만 표시 대상
    if (item.videoCount > 0 || item.logCount > 0) {
      map.set(item.date, { videoCount: item.videoCount, logCount: item.logCount });
    }
  }
  recordMap.value = map;
  monthSummary.value = {
    totalVideos: data.totalVideos ?? 0,
    totalProblems: data.totalProblems ?? 0,
    totalGymVisits: data.totalGymVisits ?? 0,
  };
}

async function load() {
  isLoading.value = true;
  selectedDate.value = null;
  try {
    await refreshCalendarMap();
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("기록을 불러오지 못했어요.", "danger");
  } finally {
    isLoading.value = false;
  }
}

async function selectDate(cell: CalendarCell) {
  if (!cell.hasRecord || !cell.isCurrentMonth) return;
  selectedDate.value = cell.date;
  isDetailLoading.value = true;
  selectedSessions.value = [];
  try {
    const userId = authStore.user?.id ?? "";
    const [dayRes, videosRes] = await Promise.allSettled([
      statsService.getCalendarDay(cell.date),
      // recordedDate 필터로 해당 날짜 영상만 정확히 조회
      userId ? videoService.getVideosByDate(userId, cell.date) : Promise.resolve([]),
    ]);
    if (dayRes.status === "rejected") throw dayRes.reason;
    const dayVideos: FeedVideo[] = videosRes.status === "fulfilled" ? videosRes.value : [];
    selectedSessions.value = await buildSessions(dayRes.value.data, dayVideos);
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("기록을 불러오지 못했어요.", "danger");
  } finally {
    isDetailLoading.value = false;
  }
}

function goBackToCalendar() {
  selectedDate.value = null;
  selectedSessions.value = [];
}

// ── 기록 수정/삭제 ─────────────────────────────────
function editSession(session: Session) {
  // session.key === 클라이밍 기록 id
  router.push(`/climbing-log/${session.key}`);
}

const deleteTargetKey = ref<string | null>(null);
const isDeleteAlertOpen = ref(false);

function askDeleteSession(session: Session) {
  deleteTargetKey.value = session.key;
  isDeleteAlertOpen.value = true;
}

async function confirmDeleteSession() {
  const key = deleteTargetKey.value;
  isDeleteAlertOpen.value = false;
  deleteTargetKey.value = null;
  if (!key) return;
  try {
    await climbingLogService.remove(key);
    uiStore.showToast("기록을 삭제했어요.");
    // 해당 날짜에서 제거 후, 남은 기록이 없으면 달력으로 복귀
    selectedSessions.value = selectedSessions.value.filter((s) => s.key !== key);
    if (selectedSessions.value.length === 0) goBackToCalendar();
    // 달력 카운트만 갱신 (상세 화면 유지)
    await refreshCalendarMap();
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("삭제에 실패했어요.", "danger");
  }
}

function prevMonth() {
  if (month.value === 1) {
    month.value = 12;
    year.value--;
  } else month.value--;
  load();
}

function nextMonth() {
  if (month.value === 12) {
    month.value = 1;
    year.value++;
  } else month.value++;
  load();
}

async function handleRefresh(event: CustomEvent) {
  await load();
  (event.target as HTMLIonRefresherElement).complete();
}

function handleScroll(event: CustomEvent<{ scrollTop: number }>) {
  window.dispatchEvent(new CustomEvent("hola:tab-bar-scroll", { detail: { scrolled: event.detail.scrollTop > 12 } }));
}

onMounted(load);
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <button v-if="selectedDate && !isDesktop" class="back-btn" aria-label="달력으로 돌아가기" @click="goBackToCalendar">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <span v-else class="brand-label">RECORDS</span>

          <span v-if="selectedDate && !isDesktop" class="toolbar-title">{{ selectedDateLabel }}</span>
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent :scroll-events="true" @ion-scroll="handleScroll">
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div class="records-layout">
        <!-- ── CALENDAR VIEW ───────────────────────── -->
        <div v-if="!selectedDate || isDesktop" class="calendar-pane">
          <!-- Hero -->
          <div class="hero page-padding">
            <h1 class="hero-title">이번 달 기록</h1>
          </div>

          <!-- Stats strip (이번 달 집계) -->
          <div class="stats-strip page-padding">
            <div class="mini-stat hola-card">
              <div class="mini-lbl">VIDEOS</div>
              <div class="mini-val">{{ monthSummary.totalVideos }}</div>
            </div>
            <div class="mini-stat hola-card">
              <div class="mini-lbl">PROBLEMS</div>
              <div class="mini-val">{{ monthSummary.totalProblems }}</div>
            </div>
            <div class="mini-stat hola-card">
              <div class="mini-lbl">GYM VISITS</div>
              <div class="mini-val">{{ monthSummary.totalGymVisits }}</div>
            </div>
          </div>

          <!-- Calendar section -->
          <div class="calendar-section page-padding">
            <!-- Month nav -->
            <div class="month-nav">
              <button class="nav-btn" aria-label="이전 달" @click="prevMonth">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span class="month-label">{{ monthLabel }}</span>
              <button class="nav-btn" aria-label="다음 달" @click="nextMonth">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <!-- Day-of-week headers -->
            <div class="cal-grid">
              <div v-for="d in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="d" class="dow-cell">{{ d }}</div>
            </div>

            <!-- Loading skeleton -->
            <div v-if="isLoading" class="cal-grid">
              <div v-for="i in 35" :key="i" class="day-cell skeleton" />
            </div>

            <!-- Calendar cells -->
            <div v-else class="cal-grid">
              <button
                v-for="cell in calendarCells"
                :key="cell.date"
                class="day-cell"
                :class="{
                  'has-record': cell.hasRecord && cell.isCurrentMonth,
                  'is-today': cell.isToday,
                  'other-month': !cell.isCurrentMonth,
                  clickable: cell.hasRecord && cell.isCurrentMonth,
                }"
                :aria-label="cell.hasRecord ? `${cell.day}일, 기록 있음` : `${cell.day}일`"
                :disabled="!cell.hasRecord || !cell.isCurrentMonth"
                @click="selectDate(cell)"
              >
                <span class="day-num">{{ cell.day }}</span>
                <span v-if="cell.videoCount > 0 && cell.isCurrentMonth" class="record-count" aria-hidden="true">{{ cell.videoCount }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ── DETAIL VIEW ─────────────────────────── -->
        <div v-if="selectedDate || isDesktop" class="detail-pane">
          <!-- Desktop placeholder (no date selected) -->
          <EmptyState v-if="!selectedDate" compact hold="cyan" title="날짜를 선택하세요" description="달력에서 기록이 있는 날짜를 누르면 상세를 볼 수 있어요." />

          <!-- Loading -->
          <div v-else-if="isDetailLoading" class="detail-skeleton page-padding">
            <LoadingState variant="list" :count="3" label="기록을 불러오는 중" />
          </div>

          <!-- Empty -->
          <EmptyState v-else-if="selectedSessions.length === 0" compact hold="orange" title="기록이 없어요" description="해당 날짜에 저장된 기록이 없습니다." />

          <!-- Desktop detail header (date label) -->
          <template v-else>
            <div v-if="isDesktop" class="detail-date-head page-padding">{{ selectedDateLabel }}</div>
            <div class="sessions page-padding">
              <div v-for="session in selectedSessions" :key="session.key" class="session-group">
                <!-- Session header -->
                <div class="session-header">
                  <div class="session-venue">{{ session.venue }}</div>
                  <div class="session-head-right">
                    <span class="session-duration">{{ session.logId ? `${session.totalProblems} sends` : `영상 ${session.videos.length}개` }}</span>
                    <template v-if="session.logId">
                      <button class="icon-btn" aria-label="기록 수정" @click="editSession(session)">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button class="icon-btn danger" aria-label="기록 삭제" @click="askDeleteSession(session)">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Grade completion bar card (클라이밍 기록 있을 때만) -->
                <div v-if="session.gradeRows.length" class="grades-card hola-card">
                  <div class="grade-bars">
                    <div v-for="row in session.gradeRows" :key="row.grade" class="grade-row" :class="{ 'grade-row--empty': row.count === 0 }">
                      <span class="grade-dot" :style="{ background: row.color }" aria-hidden="true" />
                      <span class="grade-name">{{ row.grade }}</span>
                      <div class="bar-track" aria-hidden="true">
                        <div
                          class="bar-fill"
                          :style="{
                            width: session.totalProblems > 0 ? `${(row.count / Math.max(...session.gradeRows.map((r) => r.count))) * 100}%` : '0%',
                            background: row.color,
                          }"
                        />
                      </div>
                      <span class="grade-count">{{ row.count > 0 ? row.count : "—" }}</span>
                    </div>
                  </div>

                  <!-- Memo -->
                  <div v-if="session.memo" class="memo memo-border">
                    {{ session.memo }}
                  </div>
                </div>

                <!-- Video thumbnails -->
                <div v-if="session.videos.length" class="video-row">
                  <button v-for="v in session.videos" :key="v.id" class="video-thumb" :aria-label="v.title ?? '클라이밍 영상'" @click="router.push(`/my/videos/${v.id}`)">
                    <VideoThumbnail :thumbnail-url="v.thumbnailUrl" :grade="v.grade" :title="v.title" :alt="v.title ?? ''" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 기록 삭제 확인 -->
      <ConfirmDialog
        :open="isDeleteAlertOpen"
        title="기록 삭제"
        message="이 클라이밍 기록을 삭제할까요? 되돌릴 수 없어요."
        confirm-text="삭제"
        danger
        @confirm="confirmDeleteSession"
        @cancel="isDeleteAlertOpen = false"
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* ── Desktop two-pane ───────────────────────────── */
@media (min-width: 700px) {
  .records-layout {
    display: flex;
    height: 100%;
    gap: 24px;
    padding: 0 24px;
  }
  .calendar-pane {
    width: 380px;
    flex-shrink: 0;
    overflow-y: auto;
  }
  .detail-pane {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    border-left: 1px solid var(--border);
  }
  .detail-date-head {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
    padding-top: 20px;
    padding-bottom: 4px;
  }
}

/* ── Toolbar ────────────────────────────────────── */
.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  height: 52px;
}
.brand-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.toolbar-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.back-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--fg);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

/* ── Hero ───────────────────────────────────────── */
.hero {
  padding-top: 16px;
  padding-bottom: 4px;
}
.hero-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.05;
  margin: 0;
}

/* ── Mini stats ─────────────────────────────────── */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding-top: 16px;
  padding-bottom: 0;
  max-width: 500px;
}
.mini-stat {
  padding: 12px;
}
.mini-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}
.mini-val {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.015em;
  margin-top: 4px;
}

/* ── Calendar ───────────────────────────────────── */
.calendar-section {
  padding-top: 24px;
  padding-bottom: 120px;
  max-width: 500px;
}
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.month-label {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.nav-btn {
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--fg);
  display: grid;
  place-items: center;
  border-radius: 8px;
  transition: background var(--dur-fast) var(--ease-state);
}
.nav-btn:active {
  background: var(--surface-soft);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.dow-cell {
  height: 28px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: default;
  position: relative;
  padding: 0;
  transition:
    transform var(--dur-fast) var(--ease-state),
    background var(--dur-fast) var(--ease-state);
}
.day-cell.clickable {
  cursor: pointer;
}
.day-cell.clickable:active {
  transform: scale(0.9);
}

.day-num {
  font-size: var(--fs-body);
  font-weight: 600;
  line-height: 1;
  color: var(--fg);
}
.day-cell.other-month .day-num {
  color: var(--fg-muted);
  opacity: 0.4;
}

/* Today — outlined ring so it's visible even without a record */
.day-cell.is-today {
  box-shadow: inset 0 0 0 2px var(--fg);
}
.day-cell.is-today .day-num {
  font-weight: 800;
}

/* Record day — solid lime fill with DARK text (design-system contrast) */
.day-cell.has-record {
  background: var(--hold-lime);
  box-shadow: 0 4px 12px rgba(200, 255, 0, 0.45);
}
.day-cell.has-record .day-num {
  font-weight: 800;
  color: var(--fg);
}
.record-count {
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  color: var(--fg);
  opacity: 0.6;
}

/* Today AND has a record — lime fill + dark ring */
.day-cell.is-today.has-record {
  box-shadow:
    inset 0 0 0 2px var(--fg),
    0 4px 12px rgba(200, 255, 0, 0.45);
}

/* Skeleton */
.day-cell.skeleton {
  background: var(--surface-soft);
  border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* ── States ─────────────────────────────────────── */
.detail-skeleton {
  padding-top: 16px;
}
/* .micro-label — canonical style in global.css */

/* ── Session detail ─────────────────────────────── */
.sessions {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 20px;
  padding-bottom: 120px;
}
.session-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 4px 10px;
}
.session-venue {
  font-size: 15px;
  font-weight: 700;
}
.session-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.session-duration {
  font-size: 12px;
  color: var(--fg-muted);
}
.icon-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--fg-muted);
  display: grid;
  place-items: center;
  border-radius: 8px;
  transition: background var(--dur-fast) var(--ease-state);
}
.icon-btn:active {
  background: var(--surface-soft);
}
.icon-btn.danger {
  color: var(--hold-pink);
}

/* ── Grade completion bars ──────────────────────── */
.grades-card {
  padding: 0;
}
.grade-bars {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 0;
}
.grade-row {
  display: grid;
  grid-template-columns: 12px 52px 1fr 24px;
  align-items: center;
  gap: 10px;
  padding: 7px 18px;
  transition: opacity var(--dur-fast) var(--ease-state);
}
.grade-row--empty {
  opacity: 0.35;
}
.grade-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.grade-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-track {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-soft);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s var(--ease-state);
  min-width: 0;
}
.grade-count {
  font-size: 12px;
  font-weight: 800;
  color: var(--fg-muted);
  text-align: right;
}

.memo {
  padding: 12px 18px;
  font-size: 13px;
  color: var(--fg-muted);
  line-height: 1.5;
}
.memo-border {
  border-top: 1px solid var(--border);
}

/* ── Video thumbnails ───────────────────────────── */
.video-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-top: 10px;
}
.video-row::-webkit-scrollbar {
  display: none;
}
.video-thumb {
  flex: 0 0 auto;
  width: 100px;
  height: 100px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  border: none;
  padding: 0;
  cursor: pointer;
  background: var(--surface-soft);
}
</style>
