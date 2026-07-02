<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, watch, computed } from "vue";
import { IonModal } from "@ionic/vue";
import type { AdminReportResponse, AdminReportStatus, ReportResolutionAction, AdminReportStatusRequest } from "@/types/api";
import { reportStatusOptions, resolutionActionLabels, getAllowedActions, getReportTargetTypeMeta } from "@/utils/adminLabels";

const props = withDefaults(
  defineProps<{
    open: boolean;
    report: AdminReportResponse | null;
    loading?: boolean;
  }>(),
  { loading: false },
);

const emit = defineEmits<{
  (e: "confirm", body: AdminReportStatusRequest): void;
  (e: "cancel"): void;
}>();

const status = ref<AdminReportStatus>("resolved");
const action = ref<ReportResolutionAction>("none");
const reason = ref("");

// 대상 타입에 따라 허용되는 조치만 노출 (백엔드 검증과 일치).
const actionOptions = computed(() => {
  const allowed = props.report ? getAllowedActions(props.report.targetType) : (["none"] as ReportResolutionAction[]);
  return allowed.map((v) => ({ value: v, label: resolutionActionLabels[v] }));
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      status.value = "resolved";
      action.value = "none";
      reason.value = "";
    }
  },
);

// 상태가 반려면 조치는 없음으로 강제.
watch(status, (s) => {
  if (s === "rejected") action.value = "none";
});

function onConfirm() {
  if (props.loading) return;
  emit("confirm", {
    status: status.value,
    resolutionAction: action.value,
    reason: reason.value.trim() || undefined,
  });
}
</script>

<template>
  <IonModal class="confirm-dialog" :is-open="open" @did-dismiss="emit('cancel')">
    <div class="dialog-card" role="alertdialog" aria-modal="true" aria-label="신고 처리">
      <h2 class="dialog-title">신고 처리</h2>
      <p v-if="report" class="dialog-message">
        {{ getReportTargetTypeMeta(report.targetType).label }} · 신고 #{{ report.id }}
      </p>

      <div class="dialog-field">
        <label class="admin-field-label">처리 상태</label>
        <select v-model="status" class="admin-select">
          <option v-for="opt in reportStatusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div class="dialog-field">
        <label class="admin-field-label">조치</label>
        <select v-model="action" class="admin-select" :disabled="status === 'rejected'">
          <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div class="dialog-field">
        <label class="admin-field-label">사유 (선택)</label>
        <textarea v-model="reason" class="admin-textarea" placeholder="처리 사유" maxlength="500" />
      </div>

      <div class="dialog-actions">
        <button class="dialog-btn dialog-btn--cancel" @click="emit('cancel')">취소</button>
        <button class="dialog-btn dialog-btn--primary" :disabled="loading" @click="onConfirm">처리</button>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.confirm-dialog {
  --width: min(420px, calc(100vw - 48px));
  --height: auto;
  --border-radius: var(--r-sheet);
  --box-shadow: var(--shadow-float);
  --backdrop-opacity: 0.45;
}
.dialog-card {
  background: var(--surface);
  padding: 24px 22px 18px;
}
.dialog-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.dialog-message {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 6px 0 0;
}
.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
}
.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 22px;
}
.dialog-btn {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: var(--r-button);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  cursor: pointer;
}
.dialog-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dialog-btn--cancel {
  background: var(--surface-soft);
  color: var(--fg);
}
.dialog-btn--primary {
  background: var(--hold-dark);
  color: #fff;
}
</style>
