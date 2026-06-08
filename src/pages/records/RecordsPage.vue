<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, IonSpinner } from "@ionic/vue";
import { useRouter } from "vue-router";
import { statsService } from "@/services/stats";
import { gymService } from "@/services/gym";
import { videoService } from "@/services/video";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { gradeColor, gradeTextColor, gradeDifficulty } from "@/utils/gradeColor";
import type { UserStats, FeedVideo } from "@/types/api";

// ── Types ──────────────────────────────────────────
interface RouteRow {
  grade: string;
  count: number;
  difficulty: number;
}

interface Session {
  key: string;
  dateLabel: string;
  venue: string;
  totalProblems: number;
  memo: string | null;
  routes: RouteRow[];
  videos: FeedVideo[];
}

interface CalendarCell {
  date: string; // YYYY-MM-DD
  day: number; // 1-31
  hasRecord: boolean;
  totalProblems: number;
  isToday: boolean;
  isCurrentMonth: boolean;
}

// ── Store / router ─────────────────────────────────
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();
const isDesktop = useMediaQuery("(min-width: 1024px)");

// ── State ──────────────────────────────────────────
const now = new Date();
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1); // 1-indexed

const isLoading = ref(true);
const isDetailLoading = ref(false);
const stats = ref<UserStats | null>(null);

/** dates that have records: date → totalProblems */
const recordMap = ref<Map<string, number>>(new Map());

/** selected date for detail view (null = calendar view) */
const selectedDate = ref<string | null>(null);
const selectedSessions = ref<Session[]>([]);

const gymNameCache = new Map<number, string>();

// ── Computed ───────────────────────────────────────
const monthLabel = computed(() => {
  const d = new Date(year.value, month.value - 1, 1);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
});

const techniqueCount = computed(() => {
  const tc = stats.value?.techniqueCounts;
  return tc ? Object.keys(tc).length : 0;
});

const climbingHours = computed(() => {
  const sec = stats.value?.totalClimbingSeconds ?? 0;
  return sec >= 3600 ? `${(sec / 3600).toFixed(1)}h` : sec > 0 ? `${Math.floor(sec / 60)}m` : "0";
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
      totalProblems: 0,
      isToday: false,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year.value, month.value - 1, day);
    const dateStr = toDateStr(d);
    const problems = recordMap.value.get(dateStr) ?? 0;
    cells.push({
      date: dateStr,
      day,
      hasRecord: problems > 0,
      totalProblems: problems,
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
        totalProblems: 0,
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

function buildSessions(logs: Awaited<ReturnType<typeof statsService.getCalendarDay>>["data"], dayVideos: FeedVideo[]): Promise<Session[]> {
  return Promise.all(
    logs.map(async (log) => {
      const venue = await resolveGymName(log.gymId);
      const routes: RouteRow[] = Object.entries(log.gradeCounts ?? {})
        .map(([grade, count]) => ({ grade, count, difficulty: gradeDifficulty(grade) }))
        .sort((a, b) => b.difficulty - a.difficulty);
      const climbedDate = log.climbedOn.slice(0, 10);
      const videos = dayVideos.filter((v) => v.gymId === String(log.gymId) && v.createdAt.slice(0, 10) === climbedDate);
      return {
        key: String(log.id),
        dateLabel: selectedDateLabel.value,
        venue,
        totalProblems: log.totalProblems,
        memo: log.memo,
        routes,
        videos,
      };
    }),
  );
}

// ── Actions ────────────────────────────────────────
async function load() {
  isLoading.value = true;
  selectedDate.value = null;
  try {
    const [statsRes, calRes] = await Promise.all([statsService.getStats(), statsService.getCalendarRaw(year.value, month.value)]);
    stats.value = statsRes.data;

    const map = new Map<string, number>();
    for (const item of calRes.data) {
      if (item.logCount > 0) map.set(item.date, item.totalProblems);
    }
    recordMap.value = map;
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
      userId ? videoService.getUserVideos(userId, { page: 0, size: 50 }) : Promise.resolve({ data: { content: [] } }),
    ]);
    if (dayRes.status === "rejected") throw dayRes.reason;
    const dayVideos: FeedVideo[] = videosRes.status === "fulfilled" ? (videosRes.value.data.content as FeedVideo[]) : [];
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

    <IonContent>
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

        <!-- Stats strip -->
        <div class="stats-strip page-padding">
          <div class="mini-stat hola-card">
            <div class="mini-lbl">VIDEOS</div>
            <div class="mini-val">{{ stats?.totalVideos ?? 0 }}</div>
          </div>
          <div class="mini-stat hola-card">
            <div class="mini-lbl">CLIMB</div>
            <div class="mini-val">{{ climbingHours }}</div>
          </div>
          <div class="mini-stat hola-card">
            <div class="mini-lbl">MOVES</div>
            <div class="mini-val">{{ techniqueCount }}</div>
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
              <span v-if="cell.hasRecord && cell.isCurrentMonth" class="record-count" aria-hidden="true">{{ cell.totalProblems }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── DETAIL VIEW ─────────────────────────── -->
      <div v-if="selectedDate || isDesktop" class="detail-pane">
        <!-- Desktop placeholder (no date selected) -->
        <div v-if="!selectedDate" class="state-center empty">
          <p class="empty-title">날짜를 선택하세요</p>
          <p class="empty-sub">달력에서 기록이 있는 날짜를 누르면 상세를 볼 수 있어요.</p>
        </div>

        <!-- Loading -->
        <div v-else-if="isDetailLoading" class="state-center">
          <IonSpinner name="crescent" />
        </div>

        <!-- Empty -->
        <div v-else-if="selectedSessions.length === 0" class="state-center empty">
          <p class="empty-title">기록이 없어요</p>
          <p class="empty-sub">해당 날짜에 저장된 기록이 없습니다.</p>
        </div>

        <!-- Desktop detail header (date label) -->
        <template v-else>
        <div v-if="isDesktop" class="detail-date-head page-padding">{{ selectedDateLabel }}</div>
        <div class="sessions page-padding">
          <div v-for="session in selectedSessions" :key="session.key" class="session-group">
            <!-- Session header -->
            <div class="session-header">
              <div class="session-venue">{{ session.venue }}</div>
              <div class="session-duration">{{ session.totalProblems }} sends</div>
            </div>

            <!-- Grade pills card -->
            <div class="grades-card hola-card">
              <div class="grade-pills">
                <div v-for="route in session.routes" :key="route.grade" class="grade-pill">
                  <span class="grade-dot" :style="{ background: gradeColor(route.grade) }" aria-hidden="true" />
                  <span class="grade-label">{{ route.grade }}</span>
                  <span class="grade-count" :style="{ color: 'var(--hold-orange)' }">{{ route.count }}</span>
                </div>
              </div>

              <!-- Memo -->
              <div v-if="session.memo" class="memo memo-border">
                {{ session.memo }}
              </div>
            </div>

            <!-- Video thumbnails -->
            <div v-if="session.videos.length" class="video-row">
              <button v-for="v in session.videos" :key="v.id" class="video-thumb" :aria-label="v.title ?? '클라이밍 영상'" @click="router.push(`/videos/${v.id}`)">
                <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" :alt="v.title ?? ''" loading="lazy" />
                <div v-else class="video-ph" :style="{ background: gradeColor(v.grade) }">
                  <span :style="{ color: gradeTextColor(gradeColor(v.grade)) }">{{ v.grade ?? "HOLA" }}</span>
                </div>
                <span
                  v-if="v.grade"
                  class="v-grade-badge"
                  :style="{
                    background: gradeColor(v.grade),
                    color: gradeTextColor(gradeColor(v.grade)),
                  }"
                >
                  {{ v.grade }}
                </span>
              </button>
            </div>
          </div>
        </div>
        </template>
      </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* ── Desktop two-pane ───────────────────────────── */
@media (min-width: 1024px) {
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
  font-size: 14px;
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
.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 64px 24px;
  text-align: center;
}
.empty-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}
.empty-sub {
  font-size: 13px;
  color: var(--fg-muted);
  margin: 0;
}
.micro-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}

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
.session-duration {
  font-size: 12px;
  color: var(--fg-muted);
}

/* ── Grade pills ────────────────────────────────── */
.grades-card {
  padding: 0;
}
.grade-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px 18px;
}
.grade-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
}
.grade-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.grade-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}
.grade-count {
  font-size: 13px;
  font-weight: 800;
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
  padding-bottom: 4px;
}
.video-row::-webkit-scrollbar {
  display: none;
}
.video-thumb {
  flex: 0 0 auto;
  width: 88px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  border: none;
  padding: 0;
  cursor: pointer;
  background: var(--surface-soft);
}
.video-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.video-ph {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
.video-ph span {
  font-size: 14px;
  font-weight: 800;
}
.v-grade-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 999px;
}
</style>
