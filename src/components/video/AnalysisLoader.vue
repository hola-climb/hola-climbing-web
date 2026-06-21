<script setup lang="ts">
// imports → props → computed
import { computed } from "vue";
import HoldPebble from "@/components/common/HoldPebble.vue";

const props = withDefaults(
  defineProps<{
    progress: number;
    stage: string;
    message?: string;
  }>(),
  { message: "" },
);

// 분석 5단계 = 클라이밍 루트의 홀드 5개 (아래→위)
const STEPS = [
  { stage: "started", label: "분석 시작" },
  { stage: "downloaded", label: "영상 다운로드" },
  { stage: "pose_estimation", label: "포즈 추정" },
  { stage: "classification", label: "기술 분류" },
  { stage: "completed", label: "분석 완료" },
] as const;

const clamped = computed(() => Math.min(100, Math.max(0, props.progress)));

// 진행률 0~100 → 벽 안쪽(6%~94%) 세로 위치로 매핑
function yFor(ratio: number): number {
  return 6 + ratio * (94 - 6);
}

const climberBottom = computed(() => yFor(clamped.value / 100));

// 각 홀드의 위치/도달 상태
const holds = computed(() =>
  STEPS.map((step, i) => {
    const ratio = i / (STEPS.length - 1);
    const threshold = ratio * 100;
    return {
      ...step,
      bottom: yFor(ratio),
      left: 50 + (i % 2 === 0 ? -19 : 19), // 중앙 기준 지그재그
      reached: clamped.value >= threshold - 2,
    };
  }),
);

const activeStageLabel = computed(() => {
  const found = STEPS.find((s) => s.stage === props.stage);
  return found?.label ?? "분석 준비 중";
});
</script>

<template>
  <div class="loader" role="progressbar" :aria-valuenow="clamped" aria-valuemin="0" aria-valuemax="100" :aria-label="`AI 분석 ${clamped}% — ${activeStageLabel}`">
    <div class="wall">
      <!-- 루트 라인 -->
      <span class="route" aria-hidden="true" />
      <span class="route route--filled" :style="{ height: clamped + '%' }" aria-hidden="true" />

      <!-- 홀드 5개 (단계) -->
      <span v-for="hold in holds" :key="hold.stage" class="hold" :class="{ lit: hold.reached }" :style="{ bottom: hold.bottom + '%', left: hold.left + '%' }" aria-hidden="true">
        <HoldPebble :color="hold.reached ? 'lime' : 'dark'" :size="30" />
      </span>

      <!-- 클라이머 (홀드를 타고 오르는 실루엣) -->
      <span class="climber" :style="{ bottom: climberBottom + '%' }" aria-hidden="true">
        <span class="climber-glow" />
        <svg class="figure" viewBox="0 0 40 52" width="34" height="44" role="presentation">
          <!-- 다리 (뒤) -->
          <path class="limb leg leg-l" d="M17.5 30 L13 44" />
          <path class="limb leg leg-r" d="M22.5 30 L27 44" />
          <!-- 몸통 + 머리 -->
          <circle class="body" cx="20" cy="8" r="5" />
          <rect class="body" x="15" y="13" width="10" height="18" rx="5" />
          <!-- 분필 가방 악센트 -->
          <!-- <circle class="chalk" cx="20" cy="29" r="2" /> -->
          <!-- 팔 (앞) -->
          <path class="limb arm arm-l" d="M16 15 L9 5" />
          <path class="limb arm arm-r" d="M24 15 L31 5" />
        </svg>
      </span>
    </div>

    <div class="loader-footer">
      <div class="footer-head">
        <span class="ai-dot" aria-hidden="true" />
        <span class="stage-label">{{ message || activeStageLabel }}</span>
        <span class="pct">{{ clamped }}%</span>
      </div>
      <p class="footer-sub">기술을 한 동작씩 짚어보는 중이에요.</p>
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

/* 가운데 루트 라인 */
.route {
  position: absolute;
  left: 50%;
  bottom: 6%;
  transform: translateX(-50%);
  width: 2px;
  height: 88%;
  background: var(--border);
  border-radius: 999px;
}
.route--filled {
  background: var(--hold-lime);
  opacity: 0.5;
  transition: height 0.5s var(--ease-soft);
}

/* 홀드 */
.hold {
  position: absolute;
  transform: translate(-50%, 50%);
  display: grid;
  place-items: center;
  opacity: 0.45;
  transition:
    opacity 0.4s var(--ease-state),
    transform 0.4s var(--ease-state);
}
.hold.lit {
  opacity: 1;
  transform: translate(-50%, 50%) scale(1.05);
}

/* 클라이머 (실루엣 피겨) */
.climber {
  position: absolute;
  left: 50%;
  transform: translate(-50%, 50%);
  display: grid;
  place-items: center;
  transition: bottom 0.5s var(--ease-soft);
  z-index: 2;
}
.climber-glow {
  position: absolute;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--hold-cyan);
  opacity: 0.25;
  filter: blur(8px);
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.18;
    transform: scale(0.9);
  }
  50% {
    opacity: 0.34;
    transform: scale(1.06);
  }
}

/* 피겨 — 몸통 bob/sway */
.figure {
  position: relative;
  overflow: visible;
  animation: climb-body 1.6s ease-in-out infinite;
}
.body {
  fill: var(--hold-dark);
}
.chalk {
  fill: var(--hold-lime);
}
.limb {
  fill: none;
  stroke: var(--hold-dark);
  stroke-width: 3.4;
  stroke-linecap: round;
  /* 관절(어깨/엉덩이)을 회전 피벗으로 */
  transform-box: view-box;
}
.arm-l {
  transform-origin: 16px 15px;
  animation: arm-l 1.6s ease-in-out infinite;
}
.arm-r {
  transform-origin: 24px 15px;
  animation: arm-r 1.6s ease-in-out infinite;
}
.leg-l {
  transform-origin: 17.5px 30px;
  animation: leg-l 1.6s ease-in-out infinite;
}
.leg-r {
  transform-origin: 22.5px 30px;
  animation: leg-r 1.6s ease-in-out infinite;
}

/* 대각선 교차: 왼팔+오른다리 / 오른팔+왼다리 가 같은 위상 */
@keyframes arm-l {
  0%,
  100% {
    transform: rotate(-24deg);
  }
  50% {
    transform: rotate(8deg);
  }
}
@keyframes arm-r {
  0%,
  100% {
    transform: rotate(22deg);
  }
  50% {
    transform: rotate(-8deg);
  }
}
@keyframes leg-l {
  0%,
  100% {
    transform: rotate(12deg);
  }
  50% {
    transform: rotate(-9deg);
  }
}
@keyframes leg-r {
  0%,
  100% {
    transform: rotate(-12deg);
  }
  50% {
    transform: rotate(9deg);
  }
}
@keyframes climb-body {
  0%,
  100% {
    transform: translateY(0) rotate(-1.5deg);
  }
  50% {
    transform: translateY(-2px) rotate(1.5deg);
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
  .figure,
  .limb,
  .climber-glow,
  .ai-dot {
    animation: none;
  }
  /* 정적인 리치 자세로 고정 */
  .arm-l {
    transform: rotate(-24deg);
  }
  .arm-r {
    transform: rotate(22deg);
  }
  .leg-l {
    transform: rotate(12deg);
  }
  .leg-r {
    transform: rotate(-12deg);
  }
}
</style>
