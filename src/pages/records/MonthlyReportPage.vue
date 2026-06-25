<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted, onUnmounted } from "vue";
import { IonPage, IonContent, IonSpinner } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import AppHeader from "@/components/common/AppHeader.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import { statsService } from "@/services/stats";
import { getTagLabel } from "@/utils/tagLabels";
import { gradeColor } from "@/utils/gradeColor";
import type { MonthlyReport, GymRanking } from "@/types/api";

const route = useRoute();
const router = useRouter();

type View = "loading" | "gymSelect" | "generating" | "report" | "insufficient" | "failed";
const view = ref<View>("loading");
const month = ref("");
const report = ref<MonthlyReport | null>(null);

const gymRankings = ref<GymRanking[]>([]);
const selectedGymId = ref<number | null>(null);
const isGenerating = ref(false);

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
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 1;
  return entries.map(([key, count]) => ({ key, label: getTagLabel(key), count, pct: (count / max) * 100 }));
});
const dynamicPct = computed(() => Math.round((metrics.value?.dynamicRatio ?? 0) * 100));

// 부족 카드 안내 — 분석완료 3 / 영상 10 기준 부족분
const shortfall = computed(() => {
  const m = report.value?.metrics;
  const minAnalyzed = report.value?.requirement?.minAnalyzedVideos ?? 3;
  const minVideos = report.value?.requirement?.minVideos ?? 10;
  if (!m) return null;
  return {
    analyzed: Math.max(0, minAnalyzed - m.analyzedVideos),
    videos: Math.max(0, minVideos - m.videos),
    minAnalyzed,
    minVideos,
  };
});

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

// ── 생성 플로우 ─────────────────────────────────────
async function openGymSelect() {
  view.value = "gymSelect";
  try {
    const { data } = await statsService.getGymRankings(month.value, 10);
    gymRankings.value = data;
    selectedGymId.value = data[0]?.gymId ?? null; // 기본: 가장 많이 방문한 암장
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    gymRankings.value = [];
  }
}

async function generate() {
  const gymId = selectedGymId.value ?? gymRankings.value[0]?.gymId;
  if (gymId == null) return;
  isGenerating.value = true;
  view.value = "generating";
  try {
    const { data } = await statsService.getMonthlyReport(month.value, gymId);
    if (applyStatus(data) === "generating") startPolling();
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    view.value = "failed";
  } finally {
    isGenerating.value = false;
  }
}

function openGym(gymId: number) {
  router.push(`/gyms/${gymId}`);
}

// ── init ────────────────────────────────────────────
async function init() {
  month.value = (route.query.month as string) || lastMonthStr();
  view.value = "loading";
  try {
    const { data } = await statsService.getMonthlyReport(month.value); // gymId 생략 = 상태 조회
    if (data.status === "ready") {
      report.value = data;
      view.value = "report";
    } else if (data.status === "generating") {
      report.value = data;
      startPolling();
    } else if (data.status === "insufficientData") {
      report.value = data;
      view.value = "insufficient";
    } else {
      // failed / 미생성 → 생성 플로우
      await openGymSelect();
    }
  } catch (err: unknown) {
    // 404(미생성) 포함 → 생성 플로우
    if (import.meta.env.DEV) console.error(err);
    await openGymSelect();
  }
}

onMounted(init);
onUnmounted(stopPolling);
</script>

<template>
  <IonPage>
    <AppHeader :title="`${monthLabel} 리포트`" />
    <IonContent>
      <!-- 로딩 -->
      <div v-if="view === 'loading'" class="center-state">
        <IonSpinner name="crescent" />
      </div>

      <!-- 생성 플로우: 난이도 기준 암장 선택 -->
      <div v-else-if="view === 'gymSelect'" class="pad">
        <span class="eyebrow">{{ periodLabel }} 리포트 만들기</span>
        <h1 class="title">난이도 기준 암장을 골라주세요</h1>
        <p class="sub">선택한 암장 기준으로 난이도 성장을 분석해요. 안 고르면 가장 많이 방문한 곳으로 만들어요.</p>

        <div v-if="gymRankings.length" class="gym-list">
          <button
            v-for="g in gymRankings"
            :key="g.gymId"
            class="gym-opt hola-card"
            :class="{ active: selectedGymId === g.gymId }"
            :aria-pressed="selectedGymId === g.gymId"
            @click="selectedGymId = g.gymId"
          >
            <span class="radio" :class="{ on: selectedGymId === g.gymId }" aria-hidden="true" />
            <span class="gym-meta">
              <span class="gym-name">{{ g.gymName }}</span>
              <span class="gym-visits">방문 {{ g.visitCount }}회</span>
            </span>
          </button>
        </div>
        <p v-else class="sub">{{ periodLabel }}에 방문한 암장 기록이 없어요.</p>

        <BaseButton variant="accent" block class="cta" :disabled="!gymRankings.length || isGenerating" @click="generate">
          리포트 생성
        </BaseButton>
      </div>

      <!-- 생성 중 (polling) -->
      <div v-else-if="view === 'generating'" class="center-state">
        <IonSpinner name="crescent" />
        <div class="gen-title">리포트를 만드는 중…</div>
        <div class="gen-sub">한 달 기록과 영상 분석을 정리하고 있어요.</div>
      </div>

      <!-- 데이터 부족 -->
      <div v-else-if="view === 'insufficient'" class="pad center-text">
        <div class="lock-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 class="title">리포트 생성까지 조금만 더</h1>
        <p class="sub">{{ periodLabel }} 데이터가 더 쌓이면 만들 수 있어요.</p>
        <p v-if="shortfall && (shortfall.analyzed > 0 || shortfall.videos > 0)" class="need">
          분석 완료 영상 <b>{{ shortfall.analyzed }}개</b> · 영상 <b>{{ shortfall.videos }}개</b> 더 올리면 생성돼요
        </p>
        <BaseButton variant="secondary" block class="cta" @click="router.push('/upload')">영상 올리러 가기</BaseButton>
      </div>

      <!-- 실패 -->
      <div v-else-if="view === 'failed'" class="pad center-text">
        <h1 class="title">리포트 생성에 실패했어요</h1>
        <p class="sub">잠시 후 다시 시도해 주세요.</p>
        <BaseButton variant="accent" block class="cta" @click="openGymSelect">다시 시도</BaseButton>
      </div>

      <!-- 리포트 -->
      <div v-else-if="view === 'report' && report" class="report">
        <!-- 헤더/서사 -->
        <div class="rp-head">
          <div class="rp-head-row">
            <span class="eyebrow">{{ periodLabel }}</span>
            <span v-if="report.generatedAt" class="gen-at">{{ new Date(report.generatedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) }} 생성</span>
          </div>
          <h1 class="rp-headline">{{ report.narrative?.headline }}</h1>
          <p v-if="report.narrative?.summary" class="rp-summary">{{ report.narrative.summary }}</p>
        </div>

        <!-- 지표 -->
        <div v-if="metrics" class="metric-grid">
          <div class="metric"><div class="m-val">{{ metrics.sessions }}</div><div class="m-lbl">세션</div></div>
          <div class="metric"><div class="m-val">{{ metrics.videos }}</div><div class="m-lbl">영상</div></div>
          <div class="metric"><div class="m-val">{{ metrics.analyzedVideos }}</div><div class="m-lbl">분석됨</div></div>
          <div class="metric"><div class="m-val">{{ metrics.problemsSolved }}</div><div class="m-lbl">완등</div></div>
          <div class="metric"><div class="m-val">{{ metrics.gymsVisited }}</div><div class="m-lbl">암장</div></div>
          <div class="metric"><div class="m-val m-sm">{{ metrics.primaryGymName ?? "—" }}</div><div class="m-lbl">대표 암장</div></div>
        </div>

        <!-- 다이나믹/스태틱 -->
        <div v-if="metrics && (metrics.dynamicCount + metrics.staticCount) > 0" class="pad-x">
          <div class="ds-head"><span class="ds-dyn">다이나믹 {{ dynamicPct }}%</span><span class="ds-sta">스태틱 {{ 100 - dynamicPct }}%</span></div>
          <div class="ds-bar"><div class="ds-fill-dyn" :style="{ width: `${dynamicPct}%` }" /><div class="ds-fill-sta" :style="{ width: `${100 - dynamicPct}%` }" /></div>
        </div>

        <!-- 난이도 성장 -->
        <div v-if="report.grade" class="pad-x">
          <div class="grade-card hola-card">
            <span class="grade-swatch" :style="{ background: gradeColor(report.grade.maxGrade) }" aria-hidden="true" />
            <div class="grade-meta">
              <div class="grade-gym">{{ report.grade.gymName }}</div>
              <div class="grade-line">최고 난이도 <b>{{ report.grade.maxGrade }}</b><span v-if="report.grade.maxGradePrevMonth"> · 지난달 {{ report.grade.maxGradePrevMonth }}</span></div>
            </div>
          </div>
        </div>

        <!-- 기술 빈도 -->
        <div v-if="sortedTechniques.length" class="pad-x">
          <div class="sec-title">기술 사용 빈도</div>
          <div class="tech-card hola-card">
            <div v-for="t in sortedTechniques" :key="t.key" class="tech-row">
              <span class="tech-name">{{ t.label }}</span>
              <span class="tech-track"><span class="tech-fill" :style="{ width: `${t.pct}%` }" /></span>
              <span class="tech-count">{{ t.count }}</span>
            </div>
          </div>
        </div>

        <!-- 코칭 팁 -->
        <div v-if="report.tip" class="pad-x">
          <div class="tip-card">
            <div class="tip-head">코칭 팁</div>
            <p class="tip-msg">{{ report.tip.message }}</p>
            <div v-if="report.tip.techniqueKeys.length" class="chips">
              <span v-for="k in report.tip.techniqueKeys" :key="k" class="chip chip-amber">{{ getTagLabel(k) }}</span>
            </div>
          </div>
        </div>

        <!-- 다음 달 목표 -->
        <div v-if="report.nextMonthGoal" class="pad-x">
          <div class="sec-title">다음 달 목표</div>
          <div class="goal-card">
            <div class="goal-title">{{ report.nextMonthGoal.title }}</div>
            <p class="goal-rationale">{{ report.nextMonthGoal.rationale }}</p>
            <div v-if="report.nextMonthGoal.techniqueKeys.length" class="chips">
              <span v-for="k in report.nextMonthGoal.techniqueKeys" :key="k" class="chip chip-teal">{{ getTagLabel(k) }}</span>
            </div>
          </div>
        </div>

        <!-- 추천 암장 -->
        <div v-if="report.recommendedGyms && report.recommendedGyms.length" class="pad-x rp-bottom">
          <div class="sec-title">이 스타일에 맞는 암장</div>
          <button v-for="rg in report.recommendedGyms" :key="rg.gymId" class="reco hola-card" @click="openGym(rg.gymId)">
            <div class="reco-meta">
              <div class="reco-name">{{ rg.name }}</div>
              <div class="reco-reason">{{ rg.reason }}</div>
              <div class="chips reco-chips">
                <span v-for="k in rg.matchedTechniqueKeys" :key="k" class="chip chip-teal">{{ getTagLabel(k) }}</span>
                <span class="reco-vid">영상 {{ rg.matchingVideoCount }}개 매칭</span>
              </div>
            </div>
            <svg class="reco-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        <!-- 하이라이트 -->
        <div v-if="report.narrative?.highlights?.length" class="pad-x rp-bottom">
          <div class="sec-title">이번 달 한눈에</div>
          <ul class="highlights">
            <li v-for="(h, i) in report.narrative.highlights" :key="i">{{ h }}</li>
          </ul>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.pad {
  padding: 16px 20px 40px;
}
.pad-x {
  padding: 0 20px 16px;
}
.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 60vh;
  text-align: center;
}
.center-text {
  text-align: center;
}
.eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
}
.title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 8px 0 0;
}
.sub {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  line-height: 1.6;
  margin: 8px 0 0;
}
.need {
  margin: 14px 0 0;
  padding: 11px;
  background: var(--surface-soft);
  border-radius: var(--r-button);
  font-size: 13px;
}
.cta {
  margin-top: 20px;
}

/* 생성 중 */
.gen-title {
  font-size: 18px;
  font-weight: 800;
  margin-top: 6px;
}
.gen-sub {
  font-size: 13px;
  color: var(--fg-muted);
}
.lock-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin: 12px auto 0;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--fg-muted);
}

/* 암장 선택 */
.gym-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
}
.gym-opt {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 14px;
  border: 1px solid var(--border);
  cursor: pointer;
}
.gym-opt.active {
  border-color: var(--hold-dark);
}
.radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--border);
  flex-shrink: 0;
}
.radio.on {
  border-color: var(--hold-dark);
  background: radial-gradient(circle at center, var(--hold-dark) 0 5px, transparent 6px);
}
.gym-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gym-name {
  font-size: 15px;
  font-weight: 700;
}
.gym-visits {
  font-size: 12px;
  color: var(--fg-muted);
}

/* 리포트 */
.rp-head {
  padding: 12px 20px 16px;
  border-bottom: 1px solid var(--border);
}
.rp-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.gen-at {
  font-size: 11px;
  color: var(--fg-muted);
}
.rp-headline {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.4;
  margin: 8px 0 0;
}
.rp-summary {
  font-size: 13px;
  color: var(--fg-muted);
  line-height: 1.6;
  margin: 8px 0 0;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 16px 20px;
}
.metric {
  background: var(--surface-soft);
  border-radius: var(--r-button);
  padding: 12px 6px;
  text-align: center;
}
.m-val {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.015em;
}
.m-val.m-sm {
  font-size: 13px;
  line-height: 1.3;
}
.m-lbl {
  font-size: 11px;
  color: var(--fg-muted);
  margin-top: 2px;
}
.ds-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
}
.ds-dyn {
  color: var(--hold-purple-ink, var(--fg));
}
.ds-sta {
  color: var(--hold-cyan-ink, var(--fg-muted));
}
.ds-bar {
  display: flex;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
}
.ds-fill-dyn {
  background: var(--hold-purple, #7f77dd);
}
.ds-fill-sta {
  background: var(--hold-cyan, #5dcaa5);
}

.grade-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
}
.grade-swatch {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  flex-shrink: 0;
}
.grade-gym {
  font-size: 13px;
  font-weight: 700;
}
.grade-line {
  font-size: 12px;
  color: var(--fg-muted);
  margin-top: 2px;
}

.sec-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}
.tech-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tech-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tech-name {
  width: 64px;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.tech-track {
  flex: 1;
  height: 14px;
  background: var(--surface-soft);
  border-radius: 999px;
  overflow: hidden;
}
.tech-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--hold-lime);
}
.tech-count {
  width: 24px;
  text-align: right;
  font-size: 12px;
  color: var(--fg-muted);
}

.tip-card {
  padding: 14px;
  background: var(--tint-lime);
  border-radius: var(--r-card);
}
.tip-head {
  font-size: 13px;
  font-weight: 700;
  color: var(--on-tint-lime);
}
.tip-msg {
  font-size: 13px;
  line-height: 1.6;
  color: var(--on-tint-lime);
  margin: 4px 0 0;
}

.goal-card {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-card);
}
.goal-title {
  font-size: 15px;
  font-weight: 700;
}
.goal-rationale {
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.5;
  margin: 4px 0 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.chip {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 999px;
}
.chip-teal {
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
}
.chip-amber {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--fg);
}

.reco {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 13px;
  margin-bottom: 8px;
  cursor: pointer;
}
.reco-meta {
  flex: 1;
  min-width: 0;
}
.reco-name {
  font-size: 14px;
  font-weight: 700;
}
.reco-reason {
  font-size: 12px;
  color: var(--fg-muted);
  margin-top: 2px;
  line-height: 1.4;
}
.reco-chips {
  align-items: center;
  margin-top: 8px;
}
.reco-vid {
  font-size: 11px;
  color: var(--fg-muted);
}
.reco-chevron {
  color: var(--fg-muted);
  flex-shrink: 0;
}

.highlights {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.highlights li {
  font-size: 13px;
  color: var(--fg-muted);
  line-height: 1.5;
}
.rp-bottom:last-child {
  padding-bottom: 40px;
}
</style>
