<script setup lang="ts">
// imports → props/emits → composables → state → computed → methods
import { ref, computed, watch, onBeforeUnmount } from "vue";
import BaseSheet from "@/components/common/BaseSheet.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: "saved"): void;
  (e: "cancel"): void;
}>();

const authStore = useAuthStore();
const uiStore = useUIStore();

// 명세 제약 — nickname 2~20자, bio 최대 50자, 이미지 jpg/png ≤5MB
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const BIO_MAX = 50;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

const fileInput = ref<HTMLInputElement | null>(null);

// 편집 입력값
const nickname = ref("");
const bio = ref("");

// 이미지 staged 상태 — 저장 시점에 한 번에 반영한다.
const pendingFile = ref<File | null>(null); // 새로 고른 파일
const previewUrl = ref<string | null>(null); // pendingFile 미리보기 objectURL
const removeImage = ref(false); // 삭제 눌렀는지

// 변경 감지용 스냅샷 (열 때 고정)
const origNickname = ref("");
const origBio = ref("");
const origHasImage = ref(false);

const isSaving = ref(false);

const avatarInitial = computed(() => nickname.value.charAt(0).toUpperCase() || "?");

// 표시할 이미지: 새 파일 > 삭제예정(없음) > 기존 이미지
const displayImage = computed<string | null>(() => {
  if (previewUrl.value) return previewUrl.value;
  if (removeImage.value) return null;
  return authStore.user?.profileImageUrl ?? null;
});
const canRemove = computed(() => !!displayImage.value);

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
}

function resetForm() {
  const u = authStore.user;
  nickname.value = u?.nickname ?? "";
  bio.value = u?.bio ?? "";
  origNickname.value = nickname.value;
  origBio.value = bio.value;
  origHasImage.value = !!u?.profileImageUrl;
  pendingFile.value = null;
  removeImage.value = false;
  revokePreview();
}

watch(
  () => props.open,
  (open) => {
    if (open) resetForm();
  },
  { immediate: true },
);

onBeforeUnmount(revokePreview);

function onPickClick() {
  if (!isSaving.value) fileInput.value?.click();
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  // 같은 파일 재선택도 인식되도록 value 비우기
  input.value = "";
  if (!file) return;

  if (!ALLOWED_TYPES.includes(file.type)) {
    uiStore.showToast("JPG 또는 PNG 이미지만 올릴 수 있어요.", "warning");
    return;
  }
  if (file.size > IMAGE_MAX_BYTES) {
    uiStore.showToast("이미지는 5MB 이하만 올릴 수 있어요.", "warning");
    return;
  }

  revokePreview();
  pendingFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
  removeImage.value = false;
}

function onRemoveImage() {
  revokePreview();
  pendingFile.value = null;
  removeImage.value = true;
}

function mapError(err: unknown): string {
  const e = err as { response?: { data?: { code?: string; message?: string } } };
  const code = e.response?.data?.code;
  if (code === "U008") return "이미 사용 중인 닉네임이에요.";
  return e.response?.data?.message ?? "저장에 실패했어요.";
}

async function onSave() {
  if (isSaving.value) return;

  const trimmed = nickname.value.trim();
  if (trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX) {
    uiStore.showToast(`닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요.`, "warning");
    return;
  }

  isSaving.value = true;
  try {
    // 1) 이미지 먼저 반영 (업로드/교체 또는 삭제)
    if (pendingFile.value) {
      await authStore.uploadProfileImage(pendingFile.value);
    } else if (removeImage.value && origHasImage.value) {
      await authStore.removeProfileImage();
    }

    // 2) 닉네임/소개 — 변경된 필드만 PATCH (bio "" 는 비우기)
    const patch: { nickname?: string; bio?: string } = {};
    if (trimmed !== origNickname.value) patch.nickname = trimmed;
    if (bio.value.trim() !== origBio.value.trim()) patch.bio = bio.value.trim();
    if (Object.keys(patch).length > 0) {
      await authStore.updateProfile(patch);
    }

    emit("saved");
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast(mapError(err), "danger");
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
        <h2 class="edit-title">프로필 수정</h2>
      </header>

      <!-- 프로필 사진 -->
      <div class="avatar-row">
        <div class="avatar-preview" aria-hidden="true">
          <img v-if="displayImage" :src="displayImage" alt="" class="avatar-img" />
          <span v-else>{{ avatarInitial }}</span>
        </div>
        <div class="avatar-actions">
          <button type="button" class="ava-btn" :disabled="isSaving" @click="onPickClick">
            {{ canRemove ? "사진 변경" : "사진 추가" }}
          </button>
          <button v-if="canRemove" type="button" class="ava-btn ava-btn--danger" :disabled="isSaving" @click="onRemoveImage">삭제</button>
        </div>
        <input ref="fileInput" type="file" accept="image/jpeg,image/png" class="file-hidden" tabindex="-1" aria-hidden="true" @change="onFileChange" />
      </div>

      <div class="field-list">
        <!-- 닉네임 -->
        <div class="field-block">
          <label class="field-label" for="profile-nickname">닉네임</label>
          <input id="profile-nickname" v-model="nickname" class="field-input" type="text" placeholder="닉네임" :maxlength="NICKNAME_MAX" :disabled="isSaving" aria-label="닉네임" />
        </div>

        <!-- 한줄소개 -->
        <div class="field-block">
          <label class="field-label" for="profile-bio">소개</label>
          <textarea id="profile-bio" v-model="bio" class="field-input field-textarea" placeholder="클라이머 소개 (선택)" :maxlength="BIO_MAX" :disabled="isSaving" aria-label="소개" rows="3" />
          <span class="field-count">{{ bio.length }}/{{ BIO_MAX }}</span>
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

/* ── Avatar ─────────────────────────────────────── */
.avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.avatar-preview {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--hold-dark);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 30px;
  font-weight: 800;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.ava-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--r-button);
  padding: 8px 16px;
  font-family: var(--font-sans);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg);
  cursor: pointer;
}
.ava-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ava-btn--danger {
  color: var(--hold-pink);
  border-color: transparent;
  background: none;
  padding-inline: 4px;
}
.file-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ── Fields (mirrors VideoEditModal) ────────────── */
.field-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.field-block {
  position: relative;
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
.field-count {
  display: block;
  text-align: right;
  font-size: 10px;
  color: var(--fg-muted);
  margin-top: 4px;
}

.edit-actions {
  display: flex;
  gap: 8px;
}
.action-cancel {
  flex: 1;
}
.action-save {
  flex: 1.4;
}
</style>
