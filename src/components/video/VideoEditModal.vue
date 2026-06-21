<script setup lang="ts">
// imports → props/emits → state → computed → methods
import { ref, watch } from "vue";
import BaseSheet from "@/components/common/BaseSheet.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import type { Video } from "@/types/api";

const props = defineProps<{
  open: boolean;
  video: Video | null;
}>();

const emit = defineEmits<{
  (e: "save", payload: { title: string | null; description: string | null; isPublic: boolean }): void;
  (e: "cancel"): void;
}>();

const title = ref("");
const description = ref("");
const isPublic = ref(true);
const isSaving = ref(false);

watch(
  () => [props.open, props.video] as const,
  ([open, video]) => {
    if (open && video) {
      title.value = video.title ?? "";
      description.value = video.description ?? "";
      isPublic.value = video.isPublic;
    }
  },
  { immediate: true },
);

async function onSave() {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    emit("save", {
      title: title.value.trim() || null,
      description: description.value.trim() || null,
      isPublic: isPublic.value,
    });
  } finally {
    isSaving.value = false;
  }
}

function onCancel() {
  if (!isSaving.value) emit("cancel");
}
</script>

<template>
  <BaseSheet class="edit-modal" :open="open" @close="onCancel">
    <div class="edit-body">
      <header class="edit-head">
        <div class="micro-label">EDIT</div>
        <h2 class="edit-title">영상 정보 수정</h2>
      </header>

      <div class="field-list">
        <!-- 제목 -->
        <div class="field-block">
          <label class="field-label" for="edit-title">제목</label>
          <input
            id="edit-title"
            v-model="title"
            class="field-input"
            type="text"
            placeholder="제목 없음"
            :maxlength="60"
            :disabled="isSaving"
            aria-label="영상 제목"
          />
        </div>

        <!-- 설명 -->
        <div class="field-block">
          <label class="field-label" for="edit-desc">설명</label>
          <textarea
            id="edit-desc"
            v-model="description"
            class="field-input field-textarea"
            placeholder="설명 없음"
            :maxlength="300"
            :disabled="isSaving"
            aria-label="영상 설명"
            rows="3"
          />
        </div>

        <!-- 공개 여부 -->
        <div class="field-block vis-block">
          <span class="field-label">공개 여부</span>
          <button
            class="vis-toggle"
            :class="{ on: isPublic }"
            role="switch"
            :aria-checked="isPublic"
            :disabled="isSaving"
            aria-label="공개 여부 토글"
            @click="isPublic = !isPublic"
          >
            <span class="vis-thumb" />
          </button>
          <span class="vis-label">{{ isPublic ? "전체 공개" : "비공개" }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="edit-actions">
        <BaseButton variant="secondary" class="action-cancel" :disabled="isSaving" @click="onCancel">취소</BaseButton>
        <BaseButton variant="accent" class="action-save" :loading="isSaving" @click="onSave">저장</BaseButton>
      </div>
    </template>
  </BaseSheet>
</template>

<style scoped>
.edit-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.edit-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.edit-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.field-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 10px 14px;
}
.field-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-bottom: 4px;
}
.field-input {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--fg);
  outline: none;
  resize: none;
}
.field-input::placeholder {
  color: var(--fg-muted);
  font-weight: 400;
}
.field-textarea {
  line-height: 1.5;
  padding: 0;
}

.vis-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}
.vis-block .field-label {
  flex: 1;
  margin: 0;
}
.vis-toggle {
  width: 44px;
  height: 26px;
  background: var(--surface-soft);
  border: none;
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-base) var(--ease-state);
}
.vis-toggle.on { background: var(--hold-lime); }
.vis-toggle:disabled { opacity: 0.4; cursor: not-allowed; }
.vis-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  transition: left var(--dur-base) var(--ease-state);
}
.vis-toggle.on .vis-thumb { left: 21px; }
.vis-label {
  font-size: var(--fs-caption);
  font-weight: 600;
  color: var(--fg-muted);
  min-width: 48px;
}

.edit-actions {
  display: flex;
  gap: 8px;
}
.action-cancel { flex: 1; }
.action-save { flex: 1.4; }
</style>
