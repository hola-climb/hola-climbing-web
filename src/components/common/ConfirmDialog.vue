<script setup lang="ts">
// imports → props/emits → state → methods
import { ref, watch } from "vue";
import { IonModal } from "@ionic/vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    /** danger styling for destructive actions (delete, withdraw) */
    danger?: boolean;
    /** show a password field; confirm emits the entered value */
    withPassword?: boolean;
    passwordPlaceholder?: string;
  }>(),
  {
    message: "",
    confirmText: "확인",
    cancelText: "취소",
    danger: false,
    withPassword: false,
    passwordPlaceholder: "비밀번호",
  },
);

const emit = defineEmits<{
  (e: "confirm", password: string): void;
  (e: "cancel"): void;
}>();

const password = ref("");

// Reset the field whenever the dialog opens.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) password.value = "";
  },
);

function onConfirm() {
  emit("confirm", password.value);
}
function onCancel() {
  emit("cancel");
}
</script>

<template>
  <IonModal
    class="confirm-dialog"
    :is-open="open"
    @did-dismiss="onCancel"
  >
    <div class="dialog-card" role="alertdialog" aria-modal="true" :aria-label="title">
      <h2 class="dialog-title">{{ title }}</h2>
      <p v-if="message" class="dialog-message">{{ message }}</p>

      <input
        v-if="withPassword"
        v-model="password"
        type="password"
        class="dialog-input"
        :placeholder="passwordPlaceholder"
        :aria-label="passwordPlaceholder"
        @keydown.enter="onConfirm"
      />

      <div class="dialog-actions">
        <button class="dialog-btn dialog-btn--cancel" @click="onCancel">{{ cancelText }}</button>
        <button
          class="dialog-btn"
          :class="danger ? 'dialog-btn--danger' : 'dialog-btn--primary'"
          @click="onConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
/* Centered dialog (override Ionic's default sheet sizing) */
.confirm-dialog {
  --width: min(340px, calc(100vw - 48px));
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

.dialog-input {
  width: 100%;
  height: 46px;
  margin-top: 16px;
  border: 1px solid var(--border);
  border-radius: var(--r-input);
  background: var(--surface-soft);
  padding: 0 14px;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--fg);
  outline: none;
}
.dialog-input:focus {
  border-color: var(--fg);
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
  transition: opacity var(--dur-fast) var(--ease-state);
}
.dialog-btn:active {
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
