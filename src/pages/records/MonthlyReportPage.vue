<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted, onUnmounted } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import AppHeader from "@/components/common/AppHeader.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { statsService } from "@/services/stats";
import { getTagLabel } from "@/utils/tagLabels";
import { gradeColor } from "@/utils/gradeColor";
import type { MonthlyReport } from "@/types/api";

const route = useRoute();
const router = useRouter();

type View = "loading" | "generating" | "report" | "insufficient" | "failed";
const view = ref<View>("loading");
const month = ref("");
const report = ref<MonthlyReport | null>(null);

// ── helpers ────────────────────────────────────────
function lastMonthStr(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const monthLabel = computed(() => {
  const m = month.value.split("-")[1];
  return m ? `${Number(m)}월` : "";
});
const periodLabel = computed(() => month.value.replace("-", ". "));

const metrics = computed(() => report.value?.metrics ?? null);
const sortedTechniques = computed(() => {
  const counts = metrics.value?.techniqueCounts ?? {};
  const maxCounts = Math.max(...Object.values(counts));
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 1;
  return entries.map(([key, count]) => ({ key, label: getTagLabel(key), count, pct: (count / max) * 100, color: count === maxCounts ? "var(--hold-lime)" : "var(--hold-pink)" }));
});

const dynamicPct = computed(() => Math.round((metrics.value?.dynamicRatio ?? 0) * 100));

// 생성 가능 여부는 프론트에서 videos 개수로만 판정 (백엔드 호출 전에 검증).
const REPORT_MIN_VIDEOS = 10;
const videosCount = ref<number | null>(null);
const videosShortfall = computed(() => (videosCount.value == null ? null : Math.max(0, REPORT_MIN_VIDEOS - videosCount.value)));

// ── status → view ──────────────────────────────────
function applyStatus(data: MonthlyReport): "settled" | "generating" {
  report.value = data;
  if (data.status === "ready") {
    view.value = "report";
    return "settled";
  }
  if (data.status === "insufficientData") {
    view.value = "insufficient";
    return "settled";
  }
  if (data.status === "failed") {
    view.value = "failed";
    return "settled";
  }
  return "generating";
}

// ── polling (생성 중) ───────────────────────────────
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollCount = 0;
const MAX_POLLS = 20;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  view.value = "generating";
  stopPolling();
  pollCount = 0;
  pollTimer = setInterval(async () => {
    pollCount++;
    if (pollCount > MAX_POLLS) {
      stopPolling();
      view.value = "failed";
      return;
    }
    try {
      const { data } = await statsService.getMonthlyReport(month.value);
      if (applyStatus(data) === "settled") stopPolling();
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error(err);
    }
  }, 3000);
}

function openGym(gymId: number) {
  router.push(`/gyms/${gymId}`);
}

// ── 로드/생성 ────────────────────────────────────────
// 리포트 API는 호출 시 자동 생성된다. 따라서 생성 불가(영상 부족)면 절대 호출하지 않는다.
// 기준 암장 선택 단계 없음 — 서버가 자동(가장 많이 방문한 암장)으로 결정.
async function loadReport() {
  view.value = "loading";
  try {
    const { data } = await statsService.getMonthlyReport(month.value);
    if (applyStatus(data) === "generating") startPolling();
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    view.value = "failed";
  }
}

// 프론트 검증 — 해당 월 영상 수가 기준 이상인지. 집계 호출(getCalendarRaw)은 생성 트리거가 없다.
async function isGeneratable(m: string): Promise<boolean> {
  const [y, mo] = m.split("-").map(Number);
  try {
    const { data } = await statsService.getCalendarRaw(y, mo);
    videosCount.value = data.totalVideos;
    return data.totalVideos >= REPORT_MIN_VIDEOS;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    videosCount.value = 0;
    return false;
  }
}

async function init() {
  month.value = (route.query.month as string) || lastMonthStr();
  view.value = "loading";
  try {
    // 1) 이미 생성된 리포트면 열람 허용(영상 수와 무관). available 은 생성 트리거 없음.
    const { data: avail } = await statsService.getMonthlyReportAvailable();
    if ((avail.periods ?? []).includes(month.value)) {
      await loadReport();
      return;
    }
    // 2) 미생성 → 프론트에서 영상 수로 생성 가능 여부 검증
    if (!(await isGeneratable(month.value))) {
      view.value = "insufficient"; // ⚠️ 생성 불가 → monthly-reports 호출하지 않음
      return;
    }
    // 3) 생성 가능 → 이때만 리포트 API 호출(자동 생성)
    await loadReport();
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    view.value = "failed";
  }
}

onMounted(init);
onUnmounted(stopPolling);
</script>

<template>
  <IonPage>
    <AppHeader :title="`${monthLabel} 리포트`" />
    <IonContent class="center-scroll">
      <!-- 로딩 -->
      <div v-if="view === 'loading'" class="center-state">
        <LoadingState variant="dot" label="리포트를 불러오는 중" />
      </div>

      <!-- 생성 중 (polling) -->
      <div v-else-if="view === 'generating'" class="center-state">
        <LoadingState variant="dot" label="리포트를 만드는 중" />
        <div class="gen-title">리포트를 만드는 중…</div>
        <div class="gen-sub">한 달 기록과 영상 분석을 정리하고 있어요.</div>
      </div>

      <!-- 데이터 부족 -->
      <div v-else-if="view === 'insufficient'" class="pad center-text">
        <EmptyState hold="cyan" title="리포트 생성까지 조금만 더" :description="`${periodLabel} 데이터가 더 쌓이면 만들 수 있어요.`" />
        <p v-if="videosShortfall && videosShortfall > 0" class="need hola-card">
          영상
          <b>{{ videosShortfall }}개</b>
          더 올리면 생성돼요
        </p>
        <BaseButton variant="secondary" block class="cta" @click="router.push('/upload')">영상 올리러 가기</BaseButton>
      </div>

      <!-- 실패 -->
      <div v-else-if="view === 'failed'" class="pad center-text">
        <EmptyState hold="orange" title="리포트 생성에 실패했어요" description="잠시 후 다시 시도해 주세요." />
        <BaseButton variant="accent" block class="cta" @click="loadReport">다시 시도</BaseButton>
      </div>

      <!-- 리포트 -->
      <div v-else-if="view === 'report' && report" class="report">
        <!-- 헤더/서사 -->
        <div class="rp-head">
          <div class="rp-head-row">
            <span class="micro-label">{{ periodLabel }}</span>
            <span v-if="report.generatedAt" class="gen-at text-micro">{{ new Date(report.generatedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) }} 생성</span>
          </div>
          <h1 class="rp-headline">{{ report.narrative?.headline }}</h1>
          <p v-if="report.narrative?.summary" class="rp-summary">{{ report.narrative.summary }}</p>
        </div>

        <!-- 지표 -->
        <div v-if="metrics" class="metric-grid">
          <div class="metric hola-card">
            <div class="m-val">{{ metrics.sessions }}</div>
            <div class="m-lbl micro-label">세션</div>
          </div>
          <div class="metric hola-card">
            <div class="m-val">{{ metrics.videos }}</div>
            <div class="m-lbl micro-label">영상</div>
          </div>
          <!-- <div class="metric hola-card">
            <div class="m-val">{{ metrics.analyzedVideos }}</div>
            <div class="m-lbl micro-label">분석됨</div>
          </div> -->
          <!-- <div class="metric hola-card">
            <div class="m-val">{{ metrics.problemsSolved }}</div>
            <div class="m-lbl micro-label">완등</div>
          </div> -->
          <div class="metric hola-card">
            <div class="m-val">{{ metrics.gymsVisited }}</div>
            <div class="m-lbl micro-label">암장</div>
          </div>
          <div class="metric hola-card">
            <div class="m-val m-sm">{{ metrics.primaryGymName ?? "—" }}</div>
            <div class="m-lbl micro-label">대표 암장</div>
          </div>
        </div>

        <!-- 다이나믹/스태틱 -->
        <div v-if="metrics && metrics.dynamicCount + metrics.staticCount > 0" class="pad-x">
          <div class="ds-head">
            <span class="ds-dyn">다이나믹 {{ dynamicPct }}%</span>
            <span class="ds-sta">스태틱 {{ 100 - dynamicPct }}%</span>
          </div>
          <div class="ds-bar">
            <div class="ds-fill-dyn" :style="{ width: `${dynamicPct}%` }" />
            <div class="ds-fill-sta" :style="{ width: `${100 - dynamicPct}%` }" />
          </div>
        </div>

        <!-- 난이도 성장 -->
        <div v-if="report.grade" class="pad-x">
          <div class="grade-card hola-card">
            <span class="grade-swatch" :style="{ background: gradeColor(report.grade.maxGrade) }" aria-hidden="true" />
            <div class="grade-meta">
              <div class="grade-gym">{{ report.grade.gymName }}</div>
              <div class="grade-line">
                최고 난이도
                <b>{{ report.grade.maxGrade }}</b>
                <span v-if="report.grade.maxGradePrevMonth">· 지난달 {{ report.grade.maxGradePrevMonth }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 기술 빈도 -->
        <div v-if="sortedTechniques.length" class="pad-x">
          <div class="section-title">기술 사용 빈도</div>
          <div class="tech-card hola-card">
            <div v-for="t in sortedTechniques" :key="t.key" class="tech-row">
              <span class="tech-name">{{ t.label }}</span>
              <span class="tech-track"><span class="tech-fill" :style="{ width: `${t.pct}%`, background: t.color }" /></span>
              <span class="tech-count">{{ t.count }}</span>
            </div>
          </div>
        </div>

        <!-- 코칭 팁 -->
        <!-- <div v-if="report.tip" class="pad-x">
          <div class="tip-card hola-card">
            <div class="tip-head micro-label">코칭 팁</div>
            <p class="tip-msg">{{ report.tip.message }}</p>
            <div v-if="report.tip.techniqueKeys.length" class="chips">
              <span v-for="k in report.tip.techniqueKeys" :key="k" class="chip chip-orange">{{ getTagLabel(k) }}</span>
            </div>
          </div>
        </div> -->

        <div v-if="report.tip" class="pad-x">
          <div class="tip-card hola-card">
            <div class="tip-header">
              <div class="micro-label">코칭 팁</div>

              <!-- <span class="chip chip-lime">AI</span> -->
            </div>

            <p class="tip-msg">
              {{ report.tip.message }}
            </p>

            <div v-if="report.tip.techniqueKeys.length" class="chips">
              <span v-for="k in report.tip.techniqueKeys" :key="k" class="chip chip-orange">
                {{ getTagLabel(k) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 다음 달 목표 -->
        <div v-if="report.nextMonthGoal" class="pad-x">
          <div class="section-title">다음 달 목표</div>
          <div class="goal-card hola-card">
            <div class="goal-title">{{ report.nextMonthGoal.title }}</div>
            <p class="goal-rationale">{{ report.nextMonthGoal.rationale }}</p>
            <div v-if="report.nextMonthGoal.techniqueKeys.length" class="chips">
              <span v-for="k in report.nextMonthGoal.techniqueKeys" :key="k" class="chip chip-cyan">{{ getTagLabel(k) }}</span>
            </div>
          </div>
        </div>

        <!-- 추천 암장 -->
        <div v-if="report.recommendedGyms && report.recommendedGyms.length" class="pad-x rp-bottom">
          <div class="section-title">이 스타일에 맞는 암장</div>
          <button v-for="rg in report.recommendedGyms" :key="rg.gymId" class="reco hola-card" @click="openGym(rg.gymId)">
            <div class="reco-meta">
              <div class="reco-name">{{ rg.name }}</div>
              <div class="reco-reason">{{ rg.reason }}</div>
              <div class="chips reco-chips">
                <span v-for="k in rg.matchedTechniqueKeys" :key="k" class="chip chip-cyan">{{ getTagLabel(k) }}</span>
                <span class="chip chip-dark">영상 {{ rg.matchingVideoCount }}개 매칭</span>
              </div>
            </div>
            <svg class="reco-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <!-- 하이라이트 -->
        <!-- <div v-if="report.narrative?.highlights?.length" class="pad-x rp-bottom">
          <div class="section-title">이번 달 한눈에</div>
          <ul class="highlights hola-card">
            <li v-for="(h, i) in report.narrative.highlights" :key="i">{{ h }}</li>
          </ul>
        </div> -->
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.pad {
  padding: var(--s-4) 20px var(--s-12);
}
.pad-x {
  padding: 0 20px var(--s-8);
}
.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-4);
  min-height: 60vh;
  text-align: center;
}
.center-text {
  text-align: center;
}
.need {
  margin: 0;
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-button);
  font-size: var(--fs-caption);
}
.cta {
  margin-top: var(--s-4);
}

/* 생성 중 */
.gen-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
  margin: 0;
}
.gen-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0;
}

/* 리포트 */
.report {
  padding-bottom: var(--s-8);
}
.rp-head {
  padding: var(--s-4) 20px var(--s-8);
  /* border-bottom: 1px solid var(--border); */
  /* margin-bottom: var(--s-8); */
}
.rp-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.gen-at {
  white-space: nowrap;
}
.rp-headline {
  font-size: var(--fs-h1);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.015em;
  line-height: 1.25;
  margin: var(--s-3) 0 0;
}
.rp-summary {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  line-height: 1.45;
  margin: var(--s-3) 0 0;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--s-3);
  padding: 0 20px var(--s-8);
}
.metric {
  padding: var(--s-4) var(--s-2);
  text-align: center;
}
.m-val {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.015em;
  line-height: 1.1;
}
.m-val.m-sm {
  /* font-size: var(--fs-caption); */
  font-size: var(--fs-h3);
  line-height: 1.3;
}
.m-lbl {
  margin-top: var(--s-2);
}
.ds-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--s-2);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
}
.ds-dyn {
  color: var(--hold-pink);
}
.ds-sta {
  color: var(--on-tint-cyan);
}
.ds-bar {
  display: flex;
  height: var(--s-3);
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-soft);
}
.ds-fill-dyn {
  background: var(--hold-pink);
}
.ds-fill-sta {
  background: var(--hold-cyan);
}

.grade-card {
  display: flex;
  align-items: center;
  gap: var(--s-4);
}
.grade-swatch {
  width: var(--s-8);
  height: var(--s-8);
  border-radius: var(--s-2);
  flex-shrink: 0;
}
.grade-gym {
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
}
.grade-line {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin-top: var(--s-1);
}
.section-title {
  margin-bottom: var(--s-4);
}
.tech-card {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
.tech-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.tech-name {
  width: 64px;
  font-size: var(--fs-caption);
  font-weight: var(--w-bold);
  flex-shrink: 0;
}
.tech-track {
  flex: 1;
  height: var(--s-3);
  background: var(--surface-soft);
  border-radius: 999px;
  overflow: hidden;
}
.tech-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--hold-pink);
}
.tech-count {
  width: 24px;
  text-align: right;
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}

/* .tip-card {
  background: var(--tint-lime);
}
.tip-head {
  color: var(--on-tint-lime);
}
.tip-msg {
  font-size: var(--fs-body);
  line-height: 1.45;
  color: var(--on-tint-lime);
  margin: var(--s-3) 0 0;
} */

.tip-card {
  position: relative;
  overflow: hidden;
}

.tip-card::after {
  content: "";
  position: absolute;
  top: -40px;
  right: -40px;

  width: 120px;
  height: 120px;
  border-radius: 999px;

  background: var(--hold-lime);
  opacity: 0.12;
  filter: blur(32px);

  pointer-events: none;
}

.tip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tip-msg {
  margin-top: var(--s-3);

  font-size: var(--fs-body);
  line-height: 1.55;
  color: var(--fg);

  font-weight: 500;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-4);
}

.goal-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-bold);
}
.goal-rationale {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  line-height: 1.5;
  margin: var(--s-2) 0 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-4);
}

.reco {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  text-align: left;
  margin-bottom: var(--s-3);
  cursor: pointer;
}
.reco-meta {
  flex: 1;
  min-width: 0;
}
.reco-name {
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
}
.reco-reason {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin-top: var(--s-1);
  line-height: 1.4;
}
.reco-chips {
  align-items: center;
  margin-top: var(--s-3);
}
.reco-chevron {
  color: var(--fg-muted);
  flex-shrink: 0;
}

.highlights {
  margin: 0;
  padding-left: 36px;
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.highlights li {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  line-height: 1.5;
}
.rp-bottom:last-child {
  padding-bottom: var(--s-12);
}
</style>
