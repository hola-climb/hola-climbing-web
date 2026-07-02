<script setup lang="ts">
// imports → props/emits → state → methods
import { ref, watch } from "vue";
import { IonModal } from "@ionic/vue";
import type { AdminGymImportRow, AdminGymImportPreviewResponse } from "@/types/api";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    preview: AdminGymImportPreviewResponse | null;
    previewing?: boolean;
    applying?: boolean;
  }>(),
  { previewing: false, applying: false },
);

const emit = defineEmits<{
  (e: "preview", rows: AdminGymImportRow[]): void;
  (e: "apply", rows: AdminGymImportRow[]): void;
  (e: "cancel"): void;
}>();

const rowsJson = ref("");
const parseError = ref("");
let parsedRows: AdminGymImportRow[] = [];

const SAMPLE = `[
  {
    "externalKey": "source-001",
    "name": "홀라 클라이밍",
    "address": "서울 ...",
    "lat": 37.123,
    "lng": 127.123,
    "regionCode": "SEOUL",
    "grades": [{ "label": "V1", "difficultyOrder": 1 }]
  }
]`;

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      rowsJson.value = "";
      parseError.value = "";
      parsedRows = [];
    }
  },
);

function parse(): AdminGymImportRow[] | null {
  parseError.value = "";
  try {
    const parsed = JSON.parse(rowsJson.value);
    if (!Array.isArray(parsed)) {
      parseError.value = "최상위는 배열(rows)이어야 해요.";
      return null;
    }
    return parsed as AdminGymImportRow[];
  } catch {
    parseError.value = "JSON 형식이 올바르지 않아요.";
    return null;
  }
}

function onPreview() {
  const rows = parse();
  if (!rows) return;
  parsedRows = rows;
  emit("preview", rows);
}

function onApply() {
  if (parsedRows.length === 0 || props.applying) return;
  emit("apply", parsedRows);
}
</script>

<template>
  <IonModal class="import-modal" :is-open="open" @did-dismiss="emit('cancel')">
    <div class="modal-card">
      <div class="modal-head">
        <h2 class="modal-title">암장 일괄 등록</h2>
        <button class="sheet-close" aria-label="닫기" @click="emit('cancel')"><AdminIcon name="x" /></button>
      </div>

      <div class="modal-body">
        <p class="hint">rows 배열(JSON)을 붙여넣고 미리보기로 검증한 뒤 등록해요. (최대 500개)</p>
        <textarea v-model="rowsJson" class="admin-textarea json-area" :placeholder="SAMPLE" spellcheck="false" />
        <p v-if="parseError" class="parse-error">{{ parseError }}</p>

        <div v-if="preview" class="preview">
          <div class="preview-counts">
            <span class="pc"><b>{{ preview.totalCount }}</b> 전체</span>
            <span class="pc pc--ok"><b>{{ preview.validCount }}</b> 유효</span>
            <span class="pc pc--err"><b>{{ preview.invalidCount }}</b> 오류</span>
          </div>
          <div v-if="preview.invalidRows.length" class="invalid-list">
            <div v-for="row in preview.invalidRows" :key="row.rowIndex" class="invalid-row">
              <span class="invalid-key">#{{ row.rowIndex }} · {{ row.externalKey || "—" }}</span>
              <span class="invalid-msg">{{ row.errors.join(", ") }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-foot">
        <button class="foot-btn foot-btn--cancel" @click="emit('cancel')">취소</button>
        <button class="foot-btn foot-btn--secondary" :disabled="previewing || !rowsJson.trim()" @click="onPreview">미리보기</button>
        <button
          class="foot-btn foot-btn--primary"
          :disabled="applying || !preview || preview.invalidCount > 0 || preview.validCount === 0"
          @click="onApply"
        >
          등록
        </button>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.import-modal {
  --width: min(560px, calc(100vw - 48px));
  --height: min(80vh, 720px);
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
  margin: 0 0 12px;
}
.json-area {
  min-height: 200px;
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-caption);
}
.parse-error {
  margin: 8px 0 0;
  font-size: var(--fs-caption);
  color: var(--hold-pink);
}
.preview {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.preview-counts {
  display: flex;
  gap: 10px;
}
.pc {
  padding: 6px 12px;
  border-radius: 10px;
  background: var(--surface-soft);
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.pc b {
  color: var(--fg);
  font-weight: var(--w-bold);
}
.pc--ok b {
  color: var(--on-tint-lime);
}
.pc--err b {
  color: var(--hold-pink);
}
.invalid-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.invalid-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--tint-pink);
}
.invalid-key {
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--on-tint-pink);
}
.invalid-msg {
  font-size: var(--fs-caption);
  color: var(--on-tint-pink);
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
.foot-btn--secondary {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
}
.foot-btn--primary {
  background: var(--hold-dark);
  color: #fff;
}
</style>
