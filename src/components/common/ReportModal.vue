<script setup lang="ts">
// imports → props/emits → composables → state → methods
import { ref, watch } from "vue";
import { IonModal } from "@ionic/vue";
import { videoService } from "@/services/video";
import { useUIStore } from "@/stores/ui";
import { ReportCategory, REPORT_CATEGORY_LABELS, type ReportTargetType } from "@/types/api";

const props = defineProps<{
  open: boolean;
  targetType: ReportTargetType;
  targetId: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "reported"): void;
}>();

const uiStore = useUIStore();

const categories = Object.values(ReportCategory);
const selectedCategory = ref<ReportCategory | null>(null);
const reason = ref("");
const isSubmitting = ref(false);

const TARGET_LABELS: Record<ReportTargetType, string> = {
  video: "영상",
  comment: "댓글",
  user: "사용자",
};

// 모달이 열릴 때마다 입력 초기화
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selectedCategory.value = null;
      reason.value = "";
    }
  },
);

async function submit() {
  if (!selectedCategory.value) {
    uiStore.showToast("신고 사유를 선택해주세요.", "warning");
    return;
  }
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    await videoService.report(props.targetType, props.targetId, selectedCategory.value, reason.value.trim() || undefined);
    uiStore.showToast("신고가 접수되었어요.");
    emit("reported");
    emit("close");
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error("[ReportModal]", err);
    uiStore.showToast("신고 접수에 실패했어요.", "danger");
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <IonModal class="report-modal" :is-open="open" :initial-breakpoint="0.65" :breakpoints="[0, 1]" @did-dismiss="emit('close')">
    <div class="sheet">
      <h2 class="sheet-title">{{ TARGET_LABELS[targetType] }} 신고</h2>
      <p class="sheet-sub">신고 사유를 선택해주세요.</p>

      <div class="cat-list" role="radiogroup" aria-label="신고 사유">
        <button
          v-for="cat in categories"
          :key="cat"
          class="cat-row"
          :class="{ selected: selectedCategory === cat }"
          role="radio"
          :aria-checked="selectedCategory === cat"
          @click="selectedCategory = cat"
        >
          <span class="cat-label">{{ REPORT_CATEGORY_LABELS[cat] }}</span>
          <span class="cat-radio" aria-hidden="true" />
        </button>
      </div>

      <textarea v-model="reason" class="reason-textarea" rows="3" maxlength="500" placeholder="상세 사유를 입력해주세요 (선택)" aria-label="상세 신고 사유" />

      <div class="sheet-actions">
        <button class="sheet-btn sheet-btn--cancel" :disabled="isSubmitting" @click="emit('close')">취소</button>
        <button class="sheet-btn sheet-btn--submit" :disabled="!selectedCategory || isSubmitting" @click="submit">
          {{ isSubmitting ? "접수 중..." : "신고하기" }}
        </button>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.report-modal {
  --border-radius: var(--r-sheet);
}
.sheet {
  padding: 24px 20px calc(20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sheet-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.sheet-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: -8px 0 0;
}

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: var(--r-button);
  cursor: pointer;
  font-family: var(--font-sans);
  text-align: left;
}
.cat-row.selected {
  border-color: var(--fg);
  background: var(--surface);
}
.cat-label {
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  color: var(--fg);
}
.cat-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border);
  flex-shrink: 0;
}
.cat-row.selected .cat-radio {
  border-color: var(--fg);
  background: radial-gradient(circle, var(--fg) 0 5px, transparent 6px);
}

.reason-textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--r-button);
  background: var(--surface-soft);
  padding: 12px 14px;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--fg);
  resize: none;
  outline: none;
}
.reason-textarea:focus {
  border-color: var(--fg);
}

.sheet-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.sheet-btn {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: var(--r-button);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  cursor: pointer;
}
.sheet-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.sheet-btn--cancel {
  background: var(--surface-soft);
  color: var(--fg);
}
.sheet-btn--submit {
  background: var(--hold-pink);
  color: #fff;
}
</style>
