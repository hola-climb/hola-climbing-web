<script setup lang="ts">
// imports → props/emits → state → methods
import { ref, watch, computed } from "vue";
import { IonModal } from "@ionic/vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    /** 파괴적 액션 — 확인 버튼 핑크 강조 */
    danger?: boolean;
    /** 사유 필수 여부 (미입력 시 확인 비활성) */
    reasonRequired?: boolean;
    reasonPlaceholder?: string;
    loading?: boolean;
  }>(),
  {
    message: "",
    confirmText: "확인",
    cancelText: "취소",
    danger: false,
    reasonRequired: false,
    reasonPlaceholder: "사유 (선택)",
    loading: false,
  },
);

const emit = defineEmits<{
  (e: "confirm", reason: string): void;
  (e: "cancel"): void;
}>();

const reason = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reason.value = "";
  },
);

const canConfirm = computed(() => !props.loading && (!props.reasonRequired || reason.value.trim().length > 0));

function onConfirm() {
  if (!canConfirm.value) return;
  emit("confirm", reason.value.trim());
}
</script>

<template>
  <IonModal class="confirm-dialog" :is-open="open" @did-dismiss="emit('cancel')">
    <div class="dialog-card" role="alertdialog" aria-modal="true" :aria-label="title">
      <h2 class="dialog-title">{{ title }}</h2>
      <p v-if="message" class="dialog-message">{{ message }}</p>

      <textarea
        v-model="reason"
        class="admin-textarea dialog-reason"
        :placeholder="reasonPlaceholder"
        :aria-label="reasonPlaceholder"
        maxlength="500"
      />

      <div class="dialog-actions">
        <button class="dialog-btn dialog-btn--cancel" @click="emit('cancel')">{{ cancelText }}</button>
        <button
          class="dialog-btn"
          :class="danger ? 'dialog-btn--danger' : 'dialog-btn--primary'"
          :disabled="!canConfirm"
          @click="onConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.confirm-dialog {
  --width: min(380px, calc(100vw - 48px));
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
  font-size: var(--fs-body);
  line-height: 1.5;
  color: var(--fg-muted);
  margin: 8px 0 0;
}
.dialog-reason {
  margin-top: 16px;
}
.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
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
  transition: opacity var(--dur-fast) var(--ease-state);
}
.dialog-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dialog-btn:active:not(:disabled) {
  opacity: 0.85;
}
.dialog-btn--cancel {
  background: var(--surface-soft);
  color: var(--fg);
}
.dialog-btn--primary {
  background: var(--hold-dark);
  color: #fff;
}
.dialog-btn--danger {
  background: var(--hold-pink);
  color: #fff;
}
</style>
