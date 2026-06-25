<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    progress: number;
    stage: string;
    message?: string;
    /** 분석 done → 완료 시퀀스(마지막 홀드 lime + 체크) 재생 트리거 */
    finishing?: boolean;
  }>(),
  { message: "", finishing: false },
);

const emit = defineEmits<{ (e: "complete"): void }>();

// ── 분석 단계 정의 (서버 stage 키 ↔ 라벨/진행률/설명) ──────────────
const STAGES = [
  { key: "started", title: "분석 시작", pct: 10, desc: "영상을 분석하기 위해 준비하고 있어요." },
  { key: "downloaded", title: "영상 다운로드 완료", pct: 30, desc: "영상을 분석 가능한 형태로 정리하고 있어요." },
  { key: "pose_estimation", title: "포즈 추정 완료", pct: 70, desc: "몸의 움직임과 관절 위치를 추적했어요." },
  { key: "classification", title: "기술 분류 완료 · 결과 전송 중", pct: 90, desc: "분석 결과를 정리하고 있어요." },
  { key: "completed", title: "완료", pct: 100, desc: "분석이 완료되었어요. 결과를 확인해 보세요." },
] as const;

// ── 등반 루트 레이아웃 (viewBox 300×264, 아래→위 지그재그) ──────────
const HOLDS = [
  { x: 78, y: 226, rot: -8 },
  { x: 214, y: 188, rot: 12 },
  { x: 82, y: 138, rot: -14 },
  { x: 218, y: 90, rot: 9 },
  { x: 150, y: 40, rot: -4 },
] as const;

const PEBBLE = "M 38 92 C 22 60, 60 18, 108 22 C 158 26, 188 60, 178 110 C 168 158, 118 168, 78 158 C 44 150, 50 122, 38 92 Z";
const PEBBLE_S = 0.3;

function holdTransform(h: (typeof HOLDS)[number]): string {
  return `translate(${h.x} ${h.y}) rotate(${h.rot}) scale(${PEBBLE_S}) translate(-108 -92)`;
}

const N = HOLDS.length;
const LAST = N - 1;
const PCTS = [10, 30, 70, 90, 100];

// 연결선 세그먼트 (홀드 i → i+1, 유기적 2차 베지어). 제어점 보관(빛 위치 평가용).
const SEGMENTS = HOLDS.slice(0, -1).map((a, i) => {
  const b = HOLDS[i + 1];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = (i % 2 === 0 ? 1 : -1) * 24;
  const cx = mx + (-dy / len) * off;
  const cy = my + (dx / len) * off;
  return { id: i, ax: a.x, ay: a.y, cx, cy, bx: b.x, by: b.y, d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}` };
});

function pointAt(seg: number, t: number): { x: number; y: number } {
  const s = SEGMENTS[Math.max(0, Math.min(SEGMENTS.length - 1, seg))];
  const mt = 1 - t;
  return {
    x: mt * mt * s.ax + 2 * mt * t * s.cx + t * t * s.bx,
    y: mt * mt * s.ay + 2 * mt * t * s.cy + t * t * s.by,
  };
}

const clamped = computed(() => Math.min(100, Math.max(0, props.progress)));

function posFromProgress(p: number): number {
  if (p <= PCTS[0]) return 0;
  for (let i = 0; i < PCTS.length - 1; i++) {
    if (p <= PCTS[i + 1]) return i + (p - PCTS[i]) / (PCTS[i + 1] - PCTS[i]);
  }
  return LAST;
}

// ── 빛 이동(rAF) ───────────────────────────────────
// displayPos 가 targetBase + anticipation 으로 이징 추적. SSE↑ 시 가속.
// 분석이 분 단위로 길 수 있으므로 느리게 — 기어가기는 감속하며 끊임없이 접근(하드 정지 없음).
const ANTIC_MAX = 0.82; // 다음 홀드 직전까지(도달 전) 접근하는 최대 비율
const ANTIC_TAU = 16000; // 기어가기 감속 시간상수(클수록 더 느리고 오래 이동)
const TAU = 1100; // 목표 추적 이징(클수록 SSE 점프 시 더 부드럽고 천천히 글라이드)
const REACH_FRAC = 0.9; // 강조 이동 임계(ANTIC_MAX보다 커야 도달 전 오인 방지)

const displayPos = ref(0);
const targetBase = ref(0);
let anticipation = 0;
let rafId: number | null = null;
let lastTs: number | null = null;

function recomputeTarget() {
  const byProgress = posFromProgress(clamped.value);
  const byStage = STAGES.findIndex((s) => s.key === props.stage);
  const tb = Math.max(byProgress, byStage);
  if (tb > targetBase.value) {
    targetBase.value = tb;
    anticipation = 0;
  }
}

function frame(ts: number) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min(ts - lastTs, 64);
  lastTs = ts;
  // 감속 기어가기: 다음 홀드 쪽으로 점점 느려지며 접근(완전히 멈추지 않음)
  anticipation += (ANTIC_MAX - anticipation) * (1 - Math.exp(-dt / ANTIC_TAU));
  const goal = Math.min(targetBase.value + anticipation, LAST);
  const k = 1 - Math.exp(-dt / TAU);
  let next = displayPos.value + (goal - displayPos.value) * k;
  if (Math.abs(goal - next) < 0.0008) next = goal;
  displayPos.value = next;
  rafId = requestAnimationFrame(frame);
}

function stopFrame() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastTs = null;
}

// ── 완료 시퀀스 ───────────────────────────────────
const phase = ref<"run" | "success">("run");
let outroStarted = false;
let completeTimer: number | null = null;

function runSuccess() {
  if (outroStarted) return;
  outroStarted = true;
  stopFrame();
  displayPos.value = LAST;
  phase.value = "success";
  completeTimer = window.setTimeout(() => emit("complete"), 1050);
}

watch([clamped, () => props.stage], () => {
  recomputeTarget();
});
watch(
  () => props.finishing,
  (f) => {
    if (f) runSuccess();
  },
  { immediate: true },
);
watch(clamped, (v) => {
  if (v >= 100) runSuccess();
});

onMounted(() => {
  recomputeTarget();
  // 동작 줄이기 설정과 무관하게 항상 빛 이동 재생(로딩 인디케이터의 부드러운 빛은 무방).
  if (phase.value === "run") rafId = requestAnimationFrame(frame);
});
onUnmounted(() => {
  stopFrame();
  if (completeTimer !== null) clearTimeout(completeTimer);
});

// ── 푸터용 단계 인덱스 (SSE 기준) ──────────
const reachedIndex = computed(() => {
  if (phase.value === "success") return LAST;
  const byKey = STAGES.findIndex((s) => s.key === props.stage);
  if (byKey >= 0) return byKey;
  const p = clamped.value;
  if (p >= 100) return 4;
  if (p >= 90) return 3;
  if (p >= 70) return 2;
  if (p >= 30) return 1;
  if (p >= 10) return 0;
  return -1;
});
const isWaiting = computed(() => phase.value === "run" && reachedIndex.value < 0);

// ── 빛 위치 기반 시각 상태 ──────────────────────────
const lightSeg = computed(() => Math.max(0, Math.min(SEGMENTS.length - 1, Math.floor(displayPos.value))));
const lightT = computed(() => {
  if (displayPos.value >= LAST) return 1;
  return displayPos.value - Math.floor(displayPos.value);
});
const lightPoint = computed(() => pointAt(lightSeg.value, lightT.value));
const showLight = computed(() => {
  if (phase.value !== "run") return false;
  const frac = displayPos.value - Math.floor(displayPos.value);
  return displayPos.value > 0.04 && displayPos.value < LAST && frac > 0.04;
});

const highlightIndex = computed(() => {
  if (phase.value === "success") return LAST;
  if (isWaiting.value) return 0;
  const floor = Math.max(0, Math.min(LAST, Math.floor(displayPos.value)));
  const frac = displayPos.value - floor;
  return frac >= REACH_FRAC ? Math.min(floor + 1, LAST) : floor;
});

function holdClass(i: number): string {
  if (phase.value === "success") return i === LAST ? "is-final" : "is-done";
  const hi = highlightIndex.value;
  if (i === hi) return isWaiting.value && i === 0 ? "is-active is-waiting" : "is-active";
  if (i < hi) return "is-done";
  return "is-todo";
}

// 웹: dash 로 부드럽게 채워지는 양(pathLength=1 정규화, offset 1=숨김 0=채움)
function segDashoffset(i: number): number {
  if (phase.value === "success") return 0;
  if (i < lightSeg.value) return 0;
  if (i === lightSeg.value) return 1 - lightT.value;
  return 1;
}
// iOS 안전: dash 가 안 그려지는 WKWebView 대비, 통과 완료된 세그먼트는 solid 로 점등.
// rAF(displayPos) 와 무관하게 SSE 단계(reachedIndex)에만 의존 → rAF 불안정해도 단계별로 켜짐.
function segSolidOn(i: number): boolean {
  return phase.value === "success" || reachedIndex.value > i;
}

// ── 푸터 정보 ───────────────────────────────────────
const footer = computed(() => {
  if (phase.value === "success") {
    return { title: "완료", pct: 100, desc: "분석이 완료되었어요. 결과를 확인해 보세요." };
  }
  if (reachedIndex.value < 0) {
    return { title: "분석 대기 중", pct: clamped.value, desc: props.message || "분석 대기열에 등록되었어요." };
  }
  const s = STAGES[reachedIndex.value];
  return { title: s.title, pct: clamped.value, desc: props.message || s.desc };
});

const finalHold = HOLDS[HOLDS.length - 1];
</script>

<template>
  <div
    class="loader"
    role="progressbar"
    :aria-valuenow="footer.pct"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="`AI 분석 ${footer.pct}% — ${footer.title}`"
  >
    <div class="wall">
      <svg class="route" viewBox="0 0 300 264" role="presentation" aria-hidden="true">
        <defs>
          <radialGradient id="arl-gloss" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stop-color="white" stop-opacity="0.5" />
            <stop offset="55%" stop-color="white" stop-opacity="0" />
          </radialGradient>
        </defs>

        <g class="lines">
          <!-- 베이스(옅은 회색) -->
          <path v-for="seg in SEGMENTS" :key="`b${seg.id}`" class="line-base" :d="seg.d" />
          <!-- iOS 안전: 완료 세그먼트 solid 점등(class/opacity = 홀드 색과 동일 메커니즘) -->
          <path
            v-for="seg in SEGMENTS"
            :key="`s${seg.id}`"
            class="line-solid"
            :class="{ on: segSolidOn(seg.id), final: phase === 'success' }"
            :d="seg.d"
          />
          <!-- 웹: dash 로 빛 뒤를 따라 부드럽게 채워짐 -->
          <path
            v-for="seg in SEGMENTS"
            :key="`l${seg.id}`"
            class="line-lit"
            :class="{ 'is-final': phase === 'success' }"
            :d="seg.d"
            pathLength="1"
            :style="{ strokeDashoffset: segDashoffset(seg.id) }"
          />
        </g>

        <!-- 연결선을 따라 이동하는 빛 -->
        <g v-if="showLight" class="travel-light">
          <circle class="travel-glow" :cx="lightPoint.x" :cy="lightPoint.y" r="11" />
          <circle class="travel-core" :cx="lightPoint.x" :cy="lightPoint.y" r="4.5" />
        </g>

        <!-- 완료 시 glow 확산 링 -->
        <circle v-if="phase === 'success'" class="glow-ring" :cx="finalHold.x" :cy="finalHold.y" r="30" />

        <!-- 홀드 -->
        <g v-for="(h, i) in HOLDS" :key="i" :transform="holdTransform(h)">
          <g class="hold" :class="holdClass(i)">
            <path class="pebble" :d="PEBBLE" />
            <path class="gloss" :d="PEBBLE" fill="url(#arl-gloss)" />
            <circle class="dot" cx="108" cy="92" r="6" />
            <path v-if="i === HOLDS.length - 1" class="check" d="M 84 94 L 100 112 L 130 74" />
          </g>
        </g>
      </svg>
    </div>

    <!-- 하단 정보 카드 -->
    <div class="info-card" :class="{ done: phase === 'success' }">
      <div class="info-head">
        <span class="dot-led" :class="{ done: phase === 'success' }" aria-hidden="true" />
        <span class="info-title">{{ footer.title }}</span>
        <span class="info-pct">{{ footer.pct }}%</span>
      </div>
      <p class="info-desc">{{ footer.desc }}</p>
    </div>
  </div>
</template>

<style scoped>
.loader {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 클라이밍 벽 ───────────────────────────────── */
.wall {
  position: relative;
  height: 264px;
  border-radius: var(--r-card);
  background: radial-gradient(120% 90% at 50% 100%, var(--surface-soft) 0%, var(--surface) 72%);
  border: 1px solid var(--border);
  overflow: hidden;
}
.route {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* ── 연결선 ───────────────────────────────────── */
.line-base {
  fill: none;
  stroke: var(--border);
  stroke-width: 4;
  stroke-linecap: round;
}
/* iOS 안전 solid 점등 — dash 미사용, class 로 표시(홀드 색과 동일). */
.line-solid {
  fill: none;
  stroke: var(--hold-pink);
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0;
  transition: opacity 0.45s var(--ease-soft);
}
.line-solid.on {
  opacity: 1;
}
.line-solid.final {
  stroke: var(--hold-lime-ink);
}
/* 웹: dash 로 빛 뒤를 부드럽게 채움(WKWebView에선 안 그려져도 line-solid 가 대체) */
.line-lit {
  fill: none;
  stroke: var(--hold-pink);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 1;
  filter: drop-shadow(0 0 4px rgba(255, 77, 148, 0.55));
}
.line-lit.is-final {
  stroke: var(--hold-lime-ink);
}

/* ── 이동하는 빛 ──────────────────────────────── */
.travel-light {
  pointer-events: none;
}
.travel-glow {
  fill: var(--hold-pink);
  opacity: 0.28;
}
.travel-core {
  fill: #fff;
  stroke: var(--hold-pink);
  stroke-width: 2.5;
}

/* ── 홀드 ─────────────────────────────────────── */
.hold {
  transform-box: fill-box;
  transform-origin: center;
}
.pebble {
  fill: #dfe2ea;
  transition: fill 0.4s var(--ease-state);
}
.gloss {
  pointer-events: none;
}
.dot {
  fill: rgba(0, 0, 0, 0.18);
  transition: opacity 0.3s var(--ease-state);
}

.hold.is-todo .pebble {
  fill: #dfe2ea;
}
.hold.is-done .pebble {
  fill: #ffd3e4;
}
.hold.is-active .pebble {
  fill: var(--hold-pink);
}
.hold.is-active {
  filter: drop-shadow(0 0 6px rgba(255, 77, 148, 0.5));
  animation: hold-pulse 2s ease-in-out infinite;
}
.hold.is-active.is-waiting .pebble {
  fill: #ffc2dc;
}
.hold.is-active.is-waiting {
  filter: drop-shadow(0 0 4px rgba(255, 77, 148, 0.3));
}
@keyframes hold-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

.hold.is-final .pebble {
  fill: var(--hold-lime);
}
.hold.is-final {
  filter: drop-shadow(0 0 12px rgba(200, 255, 0, 0.75));
  animation: hold-final 0.6s var(--ease-soft) forwards;
}
.hold.is-final .dot {
  opacity: 0;
}
@keyframes hold-final {
  0% {
    transform: scale(1);
  }
  55% {
    transform: scale(1.24);
  }
  100% {
    transform: scale(1.16);
  }
}

/* glow 확산 링 */
.glow-ring {
  fill: none;
  stroke: var(--hold-lime);
  stroke-width: 3;
  transform-box: fill-box;
  transform-origin: center;
  animation: glow-spread 0.7s var(--ease-soft) forwards;
}
@keyframes glow-spread {
  0% {
    opacity: 0.7;
    transform: scale(0.4);
  }
  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

/* 완료 체크 — opacity reveal(dash draw 미사용) */
.check {
  fill: none;
  stroke: var(--hold-dark);
  stroke-width: 11;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transition: opacity 0.3s var(--ease-soft) 0.3s;
}
.hold.is-final .check {
  opacity: 1;
}

/* ── 하단 정보 카드 ────────────────────────────── */
.info-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.4s var(--ease-state);
}
.info-card.done {
  border-color: var(--hold-lime-ink);
}
.info-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hold-pink);
  flex-shrink: 0;
  animation: led-blink 1.4s ease-in-out infinite;
}
.dot-led.done {
  background: var(--hold-lime-ink);
  animation: none;
}
@keyframes led-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
.info-title {
  flex: 1;
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  color: var(--fg);
}
.info-pct {
  font-size: var(--fs-caption);
  font-weight: var(--w-bold);
  color: var(--hold-lime-ink);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.info-desc {
  margin: 0;
  padding-left: 15px;
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  line-height: 1.45;
}
</style>
