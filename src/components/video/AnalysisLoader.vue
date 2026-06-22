<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, computed, watch } from "vue";
import HoldPebble from "@/components/common/HoldPebble.vue";

const props = withDefaults(
  defineProps<{
    progress: number;
    stage: string;
    message?: string;
    /** 분석 done → 아웃트로(홀드 잡기 + 완료 플로리시) 재생 트리거 */
    finishing?: boolean;
  }>(),
  { message: "", finishing: false },
);

const emit = defineEmits<{ (e: "complete"): void }>();

// 분석 단계 라벨 (진행률은 푸터로만 표기)
const STEPS = [
  { stage: "started", label: "분석 시작" },
  { stage: "downloaded", label: "영상 다운로드" },
  { stage: "pose_estimation", label: "포즈 추정" },
  { stage: "classification", label: "기술 분류" },
  { stage: "completed", label: "분석 완료" },
] as const;

const clamped = computed(() => Math.min(100, Math.max(0, props.progress)));

// 트레드밀 홀드 — 아래로 흐르는 무한 스크롤.
// 간격 GAP, 좌우 지그재그. 2행(=2*GAP) 주기로 평행이동하면 패턴이 자기 자신과 겹쳐 이음매가 없다.
// 좌우 오프셋(REACH)은 클라이머 손끝 x와 동일하게 맞춰, 홀드가 손이 지나가는 자리로 흐르게 한다.
const GAP = 72;
const REACH = 46; // px — 중앙에서 손끝까지의 가로 거리(확대된 피겨 손 위치에 맞춤)
const trackHolds = Array.from({ length: 7 }, (_, i) => {
  const k = i - 2; // -2..4 (위/아래로 한 화면 이상 덮음)
  return { id: k, top: k * GAP, dx: Math.abs(k % 2) === 0 ? -REACH : REACH };
});

// ── 아웃트로 상태머신 ──────────────────────────────
const phase = ref<"climbing" | "grab" | "celebrate" | "done">("climbing");
let outroStarted = false;

function runOutro() {
  if (outroStarted) return;
  outroStarted = true;
  phase.value = "grab"; // 마지막 홀드 잡기
  window.setTimeout(() => {
    phase.value = "celebrate"; // 라임 버스트 + 펌프
  }, 600);
  window.setTimeout(() => {
    phase.value = "done";
    emit("complete"); // 플로리시 끝 → 페이지가 결과 카드로 전환
  }, 1600);
}

watch(
  () => props.finishing,
  (f) => {
    if (f) runOutro();
  },
  { immediate: true },
);
watch(clamped, (v) => {
  if (v >= 100) runOutro();
});

const activeStageLabel = computed(() => STEPS.find((s) => s.stage === props.stage)?.label ?? "분석 준비 중");
const isFinishing = computed(() => phase.value !== "climbing");
const footerLabel = computed(() => (isFinishing.value ? "분석 완료!" : props.message || activeStageLabel.value));
const footerPct = computed(() => (isFinishing.value ? 100 : clamped.value));
</script>

<template>
  <div class="loader" role="progressbar" :aria-valuenow="footerPct" aria-valuemin="0" aria-valuemax="100" :aria-label="`AI 분석 ${footerPct}% — ${footerLabel}`">
    <div class="wall">
      <!-- 트레드밀 홀드 (아래로 흐름) — x는 손끝 위치(중앙 ±REACH)에 정렬 -->
      <div class="holds-track" :class="{ paused: isFinishing }" aria-hidden="true">
        <span v-for="h in trackHolds" :key="h.id" class="hold" :style="{ top: h.top + 'px', left: `calc(50% + ${h.dx}px)` }">
          <HoldPebble color="dark" :size="32" />
        </span>
      </div>

      <!-- 마지막 정상 홀드 (완료 시 등장) — 오른손 x에 정렬 -->
      <span v-if="isFinishing" class="final-hold" :style="{ left: `calc(50% + ${REACH}px)` }" aria-hidden="true">
        <HoldPebble color="lime" :size="40" />
      </span>

      <!-- 클라이머 (상단 고정, 하반신은 벽 아래로 잘림) -->
      <span class="climber" :data-phase="phase" aria-hidden="true">
        <span v-if="phase === 'celebrate'" class="burst" />
        <svg class="figure" viewBox="0 0 40 52" width="154" height="200" role="presentation">
          <!-- 다리 (뒤) — viewBox 밖으로 길게 뻗어 벽 하단에서 잘림 -->
          <path class="limb leg leg-l" d="M17.5 31 L11 58" />
          <path class="limb leg leg-r" d="M22.5 31 L29 58" />
          <!-- 몸통 + 머리 (compress/stretch) -->
          <g class="torso">
            <circle class="body" cx="20" cy="8" r="5" />
            <rect class="body" x="15" y="13" width="10" height="18" rx="5" />
          </g>
          <!-- 팔 (앞) — 손끝이 양옆 홀드 x로 뻗음 -->
          <path class="limb arm arm-l" d="M15 16 L8 4" />
          <path class="limb arm arm-r" d="M25 16 L32 4" />
        </svg>
      </span>
    </div>

    <div class="loader-footer">
      <div class="footer-head">
        <span class="ai-dot" :class="{ done: isFinishing }" aria-hidden="true" />
        <span class="stage-label">{{ footerLabel }}</span>
        <span class="pct">{{ footerPct }}%</span>
      </div>
      <p class="footer-sub">{{ isFinishing ? "정상에 도착했어요." : "기술을 한 동작씩 짚어보는 중이에요." }}</p>
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
  height: 220px;
  border-radius: var(--r-card);
  background: radial-gradient(120% 80% at 50% 0%, var(--surface-soft) 0%, var(--surface) 70%);
  border: 1px solid var(--border);
  overflow: hidden;
}

/* ── 트레드밀 홀드 ─────────────────────────────── */
.holds-track {
  position: absolute;
  inset: 0;
  animation: scroll-holds 2.6s linear infinite;
}
.holds-track.paused {
  animation-play-state: paused;
}
.hold {
  position: absolute;
  transform: translateX(-50%);
  opacity: 0.5;
}
@keyframes scroll-holds {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(144px);
  } /* 2*GAP — 한 주기 */
}

/* 마지막 정상 홀드 (left는 인라인으로 오른손 x에 정렬) */
.final-hold {
  position: absolute;
  top: 9%;
  transform: translateX(-50%);
  z-index: 1;
  animation: hold-reveal 0.4s var(--ease-soft) both;
}
@keyframes hold-reveal {
  from {
    opacity: 0;
    transform: translateX(-50%) scale(0.4);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

/* ── 클라이머 (가로 중앙 + 상단 고정, 하반신은 벽 아래로 잘림) ── */
.climber {
  position: absolute;
  top: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}
.burst {
  position: absolute;
  top: 22%;
  left: 50%;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  border-radius: 50%;
  border: 3px solid var(--hold-lime);
  animation: burst 0.6s var(--ease-soft) forwards;
}
@keyframes burst {
  from {
    opacity: 0.7;
    transform: scale(0.3);
  }
  to {
    opacity: 0;
    transform: scale(2.3);
  }
}

.figure {
  overflow: visible;
}
.body {
  fill: var(--hold-dark);
}
.chalk {
  fill: var(--hold-lime);
}
.torso {
  transform-box: view-box;
  transform-origin: 20px 31px; /* 엉덩이 기준으로 압축/신장 */
}
.limb {
  fill: none;
  stroke: var(--hold-dark);
  stroke-width: 3.4;
  stroke-linecap: round;
  transform-box: view-box;
}
.arm-l {
  transform-origin: 15px 16px;
}
.arm-r {
  transform-origin: 25px 16px;
}
.leg-l {
  transform-origin: 17.5px 31px;
}
.leg-r {
  transform-origin: 22.5px 31px;
}

/* ── 클라이밍 게이트 (대각선 교차 수축/신장) ──── */
/* 왼팔+오른다리 / 오른팔+왼다리 가 반대 위상 */
.climber[data-phase="climbing"] .arm-l,
.climber[data-phase="climbing"] .leg-r {
  animation: limb-flex 1.4s ease-in-out infinite;
}
.climber[data-phase="climbing"] .arm-r,
.climber[data-phase="climbing"] .leg-l {
  animation: limb-flex 1.4s ease-in-out infinite;
  animation-delay: -0.7s;
}
.climber[data-phase="climbing"] .torso {
  animation: torso-flex 1.4s ease-in-out infinite;
}
@keyframes limb-flex {
  0%,
  100% {
    transform: scaleY(1.06);
  }
  50% {
    transform: scaleY(0.78);
  }
}
@keyframes torso-flex {
  0%,
  100% {
    transform: scaleY(1.03);
  }
  50% {
    transform: scaleY(0.93);
  }
}

/* ── 아웃트로 포즈 ─────────────────────────────── */
/* grab: 오른팔이 정상 홀드로 쭉 뻗음 */
.climber[data-phase="grab"] .arm-r {
  transform: scaleY(1.55);
}
.climber[data-phase="grab"] .torso {
  transform: scaleY(1.05);
}
/* celebrate: 양팔 번쩍 (펌프) */
.climber[data-phase="celebrate"] .arm-l {
  transform: scaleY(1.16) rotate(-14deg);
}
.climber[data-phase="celebrate"] .arm-r {
  transform: scaleY(1.16) rotate(14deg);
}
.climber[data-phase="celebrate"] .figure,
.climber[data-phase="done"] .figure {
  animation: pump 0.5s var(--ease-soft);
}
.climber[data-phase="done"] .arm-l {
  transform: scaleY(1.16) rotate(-14deg);
}
.climber[data-phase="done"] .arm-r {
  transform: scaleY(1.16) rotate(14deg);
}
@keyframes pump {
  0% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-6px);
  }
  100% {
    transform: translateY(0);
  }
}

/* ── 푸터 (단계/진행률) ────────────────────────── */
.loader-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.footer-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hold-lime);
  flex-shrink: 0;
  animation: blink 1.2s ease-in-out infinite;
}
.ai-dot.done {
  animation: none;
}
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
.stage-label {
  flex: 1;
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  color: var(--fg);
}
.pct {
  font-size: var(--fs-caption);
  font-weight: var(--w-bold);
  color: var(--hold-lime-ink);
  min-width: 36px;
  text-align: right;
}
.footer-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0;
  padding-left: 15px;
}

@media (prefers-reduced-motion: reduce) {
  .holds-track,
  .figure,
  .limb,
  .torso,
  .burst,
  .ai-dot {
    animation: none;
  }
}
</style>
