<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, computed, watch, onUnmounted } from "vue";

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

// 홀드 페블 원본 좌표계(200×180), 시각 중심 ≈ (108, 92)
const PEBBLE = "M 38 92 C 22 60, 60 18, 108 22 C 158 26, 188 60, 178 110 C 168 158, 118 168, 78 158 C 44 150, 50 122, 38 92 Z";
const PEBBLE_S = 0.3; // 스케일 (≈73px 폭)

function holdTransform(h: (typeof HOLDS)[number]): string {
  // 페블 중심(108,92)을 점(x,y)에 맞추고 회전·스케일
  return `translate(${h.x} ${h.y}) rotate(${h.rot}) scale(${PEBBLE_S}) translate(-108 -92)`;
}

// 연결선 세그먼트 (홀드 i → i+1, 유기적 곡선)
const SEGMENTS = HOLDS.slice(0, -1).map((a, i) => {
  const b = HOLDS[i + 1];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = (i % 2 === 0 ? 1 : -1) * 24; // 좌우 번갈아 휘어짐
  const cx = mx + (-dy / len) * off;
  const cy = my + (dx / len) * off;
  return { id: i, d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}` };
});

const clamped = computed(() => Math.min(100, Math.max(0, props.progress)));

// ── 완료 시퀀스 상태머신 ───────────────────────────
const phase = ref<"run" | "success">("run");
let outroStarted = false;
let completeTimer: number | null = null;

function runSuccess() {
  if (outroStarted) return;
  outroStarted = true;
  phase.value = "success"; // 마지막 홀드 lime + 확대 + glow + 체크
  completeTimer = window.setTimeout(() => {
    emit("complete"); // 시퀀스 끝 → 페이지가 결과 카드로 전환
  }, 1050);
}

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

onUnmounted(() => {
  if (completeTimer !== null) clearTimeout(completeTimer);
});

// ── 현재 단계 인덱스 (stage 키 우선, 없으면 진행률로 폴백) ──────────
const activeIndex = computed(() => {
  if (phase.value === "success") return STAGES.length - 1;
  const byKey = STAGES.findIndex((s) => s.key === props.stage);
  if (byKey >= 0) return byKey;
  const p = clamped.value;
  if (p >= 100) return 4;
  if (p >= 90) return 3;
  if (p >= 70) return 2;
  if (p >= 30) return 1;
  if (p >= 10) return 0;
  return -1; // 대기 중
});

// 강조(pulse) 대상: 대기 중엔 첫 홀드를 준비 상태로 점등
const highlightIndex = computed(() => (activeIndex.value < 0 ? 0 : activeIndex.value));

function holdClass(i: number): string {
  if (phase.value === "success") return i === HOLDS.length - 1 ? "is-final" : "is-done";
  const hi = highlightIndex.value;
  if (i === hi && activeIndex.value >= 0) return "is-active";
  if (i === hi) return "is-active is-waiting"; // 대기 중 첫 홀드 (옅은 pulse)
  if (i < hi) return "is-done";
  return "is-todo";
}

function segmentLit(i: number): boolean {
  return phase.value === "success" || activeIndex.value >= i + 1;
}

// ── 푸터 정보 ───────────────────────────────────────
const footer = computed(() => {
  if (phase.value === "success") {
    return { title: "완료", pct: 100, desc: "분석이 완료되었어요. 결과를 확인해 보세요." };
  }
  if (activeIndex.value < 0) {
    return { title: "분석 대기 중", pct: clamped.value, desc: props.message || "분석 대기열에 등록되었어요." };
  }
  const s = STAGES[activeIndex.value];
  return { title: s.title, pct: clamped.value, desc: props.message || s.desc };
});

const finalHold = HOLDS[HOLDS.length - 1];
</script>

<template>
  <div class="loader" role="progressbar" :aria-valuenow="footer.pct" aria-valuemin="0" aria-valuemax="100" :aria-label="`AI 분석 ${footer.pct}% — ${footer.title}`">
    <div class="wall">
      <svg class="route" viewBox="0 0 300 264" role="presentation" aria-hidden="true">
        <defs>
          <radialGradient id="arl-gloss" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stop-color="white" stop-opacity="0.5" />
            <stop offset="55%" stop-color="white" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- 연결선: 베이스(옅음) + 점등(밝게 채워짐) -->
        <g class="lines">
          <path v-for="seg in SEGMENTS" :key="`b${seg.id}`" class="line-base" :d="seg.d" />
          <path v-for="seg in SEGMENTS" v-show="segmentLit(seg.id)" :key="`l${seg.id}`" class="line-lit" :class="{ 'is-final': phase === 'success' }" :d="seg.d" pathLength="1" />
        </g>

        <!-- 완료 시 glow 확산 링 -->
        <circle v-if="phase === 'success'" class="glow-ring" :cx="finalHold.x" :cy="finalHold.y" r="30" />

        <!-- 홀드 -->
        <g v-for="(h, i) in HOLDS" :key="i" :transform="holdTransform(h)">
          <g class="hold" :class="holdClass(i)">
            <path class="pebble" :d="PEBBLE" />
            <path class="gloss" :d="PEBBLE" fill="url(#arl-gloss)" />
            <circle class="dot" cx="108" cy="92" r="6" />
            <!-- 마지막 홀드 완료 체크 -->
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
.line-lit {
  fill: none;
  stroke: var(--hold-pink);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: line-fill 0.55s var(--ease-soft) forwards;
}
.line-lit.is-final {
  stroke: var(--hold-lime-ink);
}
@keyframes line-fill {
  to {
    stroke-dashoffset: 0;
  }
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

/* 미완료(연한 회색) */
.hold.is-todo .pebble {
  fill: #dfe2ea;
}
/* 완료(연한 핑크) */
.hold.is-done .pebble {
  fill: #ffd3e4;
}
/* 현재 진행중(핑크 + glow + pulse) */
.hold.is-active .pebble {
  fill: var(--hold-pink);
}
.hold.is-active {
  filter: drop-shadow(0 0 6px rgba(255, 77, 148, 0.5));
  animation: hold-pulse 2s ease-in-out infinite;
}
/* 대기 중 첫 홀드 — 더 옅게 */
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

/* 최종 완료(lime + 확대 + glow) */
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

/* 완료 체크 표시 */
.check {
  fill: none;
  stroke: var(--hold-dark);
  stroke-width: 11;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 90;
  stroke-dashoffset: 90;
  opacity: 0;
}
.hold.is-final .check {
  opacity: 1;
  animation: check-draw 0.4s var(--ease-soft) 0.35s forwards;
}
@keyframes check-draw {
  from {
    stroke-dashoffset: 90;
  }
  to {
    stroke-dashoffset: 0;
  }
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

@media (prefers-reduced-motion: reduce) {
  .line-lit,
  .hold.is-active,
  .hold.is-final,
  .glow-ring,
  .check,
  .dot-led {
    animation: none;
  }
  .check {
    opacity: 1;
    stroke-dashoffset: 0;
  }
}
</style>
