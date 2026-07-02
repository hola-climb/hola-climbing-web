<script setup lang="ts">
// imports → props/emits → state → methods
import { ref, watch } from "vue";
import { IonModal } from "@ionic/vue";
import type { GymGrade, AdminGymGradeReplaceRequest } from "@/types/api";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    grades: GymGrade[];
    loading?: boolean;
  }>(),
  { loading: false },
);

const emit = defineEmits<{
  (e: "submit", body: AdminGymGradeReplaceRequest): void;
  (e: "cancel"): void;
}>();

interface Row {
  label: string;
  difficultyOrder: number;
}

const rows = ref<Row[]>([]);
const reason = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    reason.value = "";
    rows.value = props.grades.length
      ? props.grades.map((g) => ({ label: g.label, difficultyOrder: g.difficultyOrder }))
      : [{ label: "", difficultyOrder: 0 }];
  },
);

function addRow() {
  rows.value.push({ label: "", difficultyOrder: rows.value.length });
}
function removeRow(i: number) {
  rows.value.splice(i, 1);
}

function onSubmit() {
  if (props.loading) return;
  const valid = rows.value.filter((r) => r.label.trim());
  if (valid.length === 0) return;
  emit("submit", {
    grades: valid.map((r) => ({ label: r.label.trim(), difficultyOrder: Number(r.difficultyOrder) })),
    reason: reason.value.trim() || undefined,
  });
}
</script>

<template>
  <IonModal class="grade-modal" :is-open="open" @did-dismiss="emit('cancel')">
    <div class="modal-card">
      <div class="modal-head">
        <h2 class="modal-title">등급 교체</h2>
        <button class="sheet-close" aria-label="닫기" @click="emit('cancel')"><AdminIcon name="x" /></button>
      </div>

      <div class="modal-body">
        <p class="hint">기존 등급을 모두 비활성화하고 아래 목록으로 교체해요.</p>
        <div class="grade-head">
          <span>난이도 라벨</span>
          <span>정렬값</span>
          <span></span>
        </div>
        <div v-for="(row, i) in rows" :key="i" class="grade-row">
          <input v-model="row.label" class="admin-input" placeholder="V0" maxlength="50" />
          <input v-model.number="row.difficultyOrder" class="admin-input" type="number" />
          <button class="row-del" aria-label="삭제" @click="removeRow(i)"><AdminIcon name="trash" /></button>
        </div>
        <button class="add-btn" @click="addRow"><AdminIcon name="plus" :size="15" /> 등급 추가</button>

        <div class="admin-field reason-field">
          <label class="admin-field-label">사유 (선택)</label>
          <input v-model="reason" class="admin-input" placeholder="등급표 업데이트" maxlength="500" />
        </div>
      </div>

      <div class="modal-foot">
        <button class="foot-btn foot-btn--cancel" @click="emit('cancel')">취소</button>
        <button class="foot-btn foot-btn--primary" :disabled="loading" @click="onSubmit">교체</button>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.grade-modal {
  --width: min(460px, calc(100vw - 48px));
  --height: min(76vh, 640px);
  --border-radius: var(--r-sheet);
  --box-shadow: var(--shadow-float);
}
.modal-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 12px;
}
.modal-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 22px 20px;
}
.hint {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0 0 14px;
}
.grade-head {
  display: grid;
  grid-template-columns: 1fr 100px 34px;
  gap: 10px;
  padding: 0 2px 6px;
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.05em;
  color: var(--fg-muted);
  text-transform: uppercase;
}
.grade-row {
  display: grid;
  grid-template-columns: 1fr 100px 34px;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}
.row-del {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--fg-muted);
  font-size: 16px;
  cursor: pointer;
}
.row-del:hover {
  color: var(--hold-pink);
}
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 8px 14px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: transparent;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
}
.add-btn:hover {
  color: var(--fg);
  border-color: var(--fg-muted);
}
.reason-field {
  margin-top: 20px;
}
.modal-foot {
  display: flex;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
}
.foot-btn {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: var(--r-button);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  cursor: pointer;
}
.foot-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.foot-btn--cancel {
  background: var(--surface-soft);
  color: var(--fg);
}
.foot-btn--primary {
  background: var(--hold-dark);
  color: #fff;
}
</style>
