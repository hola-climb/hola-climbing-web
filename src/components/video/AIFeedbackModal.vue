<script setup lang="ts">
import { ref, computed } from "vue";
import { IonIcon } from "@ionic/vue";
import { closeOutline, checkmarkOutline, closeCircleOutline, addOutline } from "ionicons/icons";
import BaseSheet from "@/components/common/BaseSheet.vue";
import type { TechniqueTag } from "@/types/api";
import tagLabels, { getTagLabel } from "@/utils/tagLabels";
import { useVideoStore } from "@/stores/video";
import { useUIStore } from "@/stores/ui";

const props = defineProps<{
  isOpen: boolean;
  videoId: string;
  techniques: TechniqueTag[];
  isDynamic?: boolean | null;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const videoStore = useVideoStore();
const uiStore = useUIStore();
const submitting = ref(false);

// 로컬 선택 상태 — API 호출 없이 누적
const pendingFeedback = ref<Record<string, "correct" | "incorrect">>({});
const pendingDynamic = ref<"correct" | "incorrect" | null>(null);
const pendingAdded = ref<Set<string>>(new Set());

// 움직임 유형 — 기술 추가 후보에서 제외
const MOVEMENT_KEYS = ["dynamic", "static"];

// AI가 놓친 기술 후보 = 전체 기술 - 이미 감지된 기술 - 움직임 유형
const availableToAdd = computed(() => {
  const detected = new Set(allTechniqueKeys());
  return Object.keys(tagLabels).filter((key) => !MOVEMENT_KEYS.includes(key) && !detected.has(key));
});

function selectFeedback(tag: TechniqueTag, feedback: "correct" | "incorrect") {
  pendingFeedback.value[tag.key] = feedback;
}

function selectDynamicFeedback(feedback: "correct" | "incorrect") {
  pendingDynamic.value = feedback;
}

function toggleAdded(key: string) {
  const next = new Set(pendingAdded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  pendingAdded.value = next;
}

function allTechniqueKeys() {
  return props.techniques
    .map((t) => (typeof t === "string" ? t : t?.key))
    .filter((k): k is string => typeof k === "string" && k.trim() !== "");
}

// isDynamic: 유저 피드백 반영 (incorrect → 반전, correct → 원값 유지)
function resolvedIsDynamic() {
  if (pendingDynamic.value === "incorrect") return !(props.isDynamic ?? false);
  return props.isDynamic ?? false;
}

async function flushPending(): Promise<boolean> {
  const verdicts = { ...pendingFeedback.value };
  const hasDynamic = pendingDynamic.value !== null;
  const added = [...pendingAdded.value];
  if (Object.keys(verdicts).length === 0 && !hasDynamic && added.length === 0) return false;

  // 사용자가 "틀렸다"고 한 기술만 제외 — 미피드백은 맞은 것으로 간주
  // 사용자가 추가한 기술은 최종 보정 집합(techniques)에 병합
  const kept = allTechniqueKeys().filter((key) => verdicts[key] !== "incorrect");
  const techniques = [...new Set([...kept, ...added])];

  // 최종 한 번만 전송 ({ isDynamic, techniques })
  await videoStore.submitFeedback(
    props.videoId,
    { isDynamic: resolvedIsDynamic(), techniques },
    verdicts,
    added,
  );

  pendingFeedback.value = {};
  pendingDynamic.value = null;
  pendingAdded.value = new Set();
  return true;
}

// X 버튼 또는 외부 탭으로 닫힐 때 공통 처리
let flushedBeforeClose = false;

async function handleClose() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const hadPending = await flushPending();
    if (hadPending) uiStore.showToast("피드백 감사해요!", "success");
    flushedBeforeClose = true;
  } catch {
    uiStore.showToast("피드백 처리에 실패했어요.", "danger");
    flushedBeforeClose = true;
  } finally {
    submitting.value = false;
    emit("close");
  }
}

async function handleDidDismiss() {
  if (!flushedBeforeClose) {
    // 외부 탭·스와이프로 닫힌 경우
    try {
      const hadPending = await flushPending();
      if (hadPending) uiStore.showToast("피드백 감사해요!", "success");
    } catch {
      uiStore.showToast("피드백 처리에 실패했어요.", "danger");
    }
  }
  flushedBeforeClose = false;
  emit("close");
}
</script>

<template>
  <BaseSheet :open="isOpen" @close="handleDidDismiss">
    <template #header>
      <div class="modal-header">
        <span class="modal-title">AI 분석 피드백</span>
        <button class="sheet-close" :class="{ loading: submitting }" @click="handleClose" aria-label="닫기">
          <IonIcon :icon="closeOutline" />
        </button>
      </div>

      <p class="modal-desc">
        AI가 인식한 기술이 맞는지 알려주세요.
        <br />
        피드백은 AI 개선에 사용됩니다.
      </p>
    </template>

    <div class="tag-list">
        <!-- 다이나믹/스태틱 분류 피드백 -->
        <div v-if="isDynamic != null" class="tag-row">
          <span class="tag-label">
            {{ isDynamic ? '다이나믹' : '스태틱' }}
            <span class="tag-sub">움직임 유형</span>
          </span>
          <div class="feedback-btns">
            <button
              class="fb-btn"
              :class="{ active: pendingDynamic === 'correct' }"
              aria-label="맞아요"
              @click="selectDynamicFeedback('correct')"
            >
              <IonIcon :icon="checkmarkOutline" />
              맞아요
            </button>
            <button
              class="fb-btn wrong"
              :class="{ active: pendingDynamic === 'incorrect' }"
              aria-label="틀렸어요"
              @click="selectDynamicFeedback('incorrect')"
            >
              <IonIcon :icon="closeCircleOutline" />
              틀렸어요
            </button>
          </div>
        </div>

        <div v-for="tag in techniques" :key="tag.key" class="tag-row">
          <span class="tag-label">{{ getTagLabel(tag.key) }}</span>

          <div class="feedback-btns">
            <button
              class="fb-btn"
              :class="{ active: pendingFeedback[tag.key] === 'correct' }"
              aria-label="맞아요"
              @click="selectFeedback(tag, 'correct')"
            >
              <IonIcon :icon="checkmarkOutline" />
              맞아요
            </button>
            <button
              class="fb-btn wrong"
              :class="{ active: pendingFeedback[tag.key] === 'incorrect' }"
              aria-label="틀렸어요"
              @click="selectFeedback(tag, 'incorrect')"
            >
              <IonIcon :icon="closeCircleOutline" />
              틀렸어요
            </button>
          </div>
        </div>

        <p v-if="!techniques.length" class="empty">감지된 기술이 없어요.</p>
      </div>

      <!-- 더 사용한 기술 추가 -->
      <div v-if="availableToAdd.length" class="add-section">
        <div class="add-head">
          <span class="add-title">더 사용한 기술이 있나요?</span>
          <span class="add-sub">AI가 놓친 기술을 알려주세요.</span>
        </div>
        <div class="add-chips">
          <button
            v-for="key in availableToAdd"
            :key="key"
            class="add-chip"
            :class="{ active: pendingAdded.has(key) }"
            :aria-pressed="pendingAdded.has(key)"
            :aria-label="getTagLabel(key) + (pendingAdded.has(key) ? ' 선택됨' : ' 추가')"
            @click="toggleAdded(key)"
          >
            <IonIcon :icon="addOutline" />
            {{ getTagLabel(key) }}
          </button>
        </div>
      </div>
  </BaseSheet>
</template>

<style scoped>
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.modal-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
}
.modal-desc {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  line-height: 1.5;
  margin: 0;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 8px;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
}

.tag-label {
  flex: 1;
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tag-sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--fg-muted);
}
.confidence {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  min-width: 36px;
  text-align: right;
}

.feedback-btns {
  display: flex;
  gap: 6px;
}

.fb-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--r-chip);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-state);
  color: var(--fg-muted);
}
.fb-btn.active {
  background: var(--tint-lime);
  border-color: var(--hold-lime-ink);
  color: var(--on-tint-lime);
}
.fb-btn.wrong.active {
  background: var(--tint-pink);
  border-color: var(--hold-pink);
  color: var(--on-tint-pink);
}
.fb-btn.loading {
  opacity: 0.6;
  pointer-events: none;
}

.empty {
  text-align: center;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
  padding: 20px 0;
}

/* ── 더 사용한 기술 추가 ───────────────────────── */
.add-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}
.add-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}
.add-title {
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
}
.add-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.add-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.add-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 13px;
  border-radius: var(--r-chip);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-state);
}
.add-chip ion-icon {
  font-size: 15px;
  transition: transform var(--dur-fast) var(--ease-state);
}
.add-chip.active {
  background: var(--tint-lime);
  border-color: var(--hold-lime-ink);
  color: var(--on-tint-lime);
}
.add-chip.active ion-icon {
  transform: rotate(45deg);
}
</style>
