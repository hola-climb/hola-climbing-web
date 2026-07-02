<script setup lang="ts">
// imports → composables → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminService } from "@/services/admin";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import type { AdminUserDetailResponse, AdminUserStatus, UserRole } from "@/types/api";
import { getUserStatusMeta, getUserRoleMeta } from "@/utils/adminLabels";
import { formatDateTime, formatDate } from "@/utils/adminFormat";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge.vue";
import AdminReasonDialog from "@/components/admin/AdminReasonDialog.vue";
import AdminIcon from "@/components/admin/AdminIcon.vue";
import LoadingState from "@/components/common/LoadingState.vue";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

const userId = Number(route.params.id);
const user = ref<AdminUserDetailResponse | null>(null);
const loading = ref(true);

// 자기 자신은 상태/역할 변경 불가 (백엔드도 거부).
const isSelf = computed(() => String(userId) === authStore.user?.id);

interface DialogConfig {
  title: string;
  message?: string;
  danger?: boolean;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  run: (reason: string) => Promise<AdminUserDetailResponse>;
}
const dialog = ref<DialogConfig | null>(null);
const dialogOpen = ref(false);
const submitting = ref(false);

async function load() {
  loading.value = true;
  try {
    const { data } = await adminService.getUser(userId);
    user.value = data;
  } catch {
    uiStore.showToast("회원 정보를 불러오지 못했어요.", "danger");
  } finally {
    loading.value = false;
  }
}

function openDialog(cfg: DialogConfig) {
  dialog.value = cfg;
  dialogOpen.value = true;
}

async function onConfirm(reason: string) {
  if (!dialog.value) return;
  submitting.value = true;
  try {
    const updated = await dialog.value.run(reason);
    user.value = updated;
    dialogOpen.value = false;
    uiStore.showToast("변경되었어요.", "success");
  } catch {
    uiStore.showToast("변경에 실패했어요.", "danger");
  } finally {
    submitting.value = false;
  }
}

function changeStatus(status: AdminUserStatus) {
  openDialog({
    title: `${getUserStatusMeta(status).label}(으)로 변경`,
    message: status === "ACTIVE" ? "이 회원을 다시 활성화해요." : "비활성 상태로 바꾸면 refresh/device 토큰이 폐기돼요.",
    danger: status !== "ACTIVE",
    run: async (reason) => (await adminService.changeUserStatus(userId, { status, reason: reason || undefined })).data,
  });
}

function changeRole(roleTarget: UserRole) {
  openDialog({
    title: roleTarget === "ADMIN" ? "관리자로 승격" : "일반 회원으로 강등",
    message: "역할 변경은 사유가 필요해요.",
    reasonRequired: true,
    reasonPlaceholder: "변경 사유 (필수)",
    run: async (reason) => (await adminService.changeUserRole(userId, { role: roleTarget, reason })).data,
  });
}

function revokeTokens() {
  openDialog({
    title: "토큰 강제 폐기",
    message: "이 회원의 모든 세션이 즉시 로그아웃돼요.",
    danger: true,
    run: async (reason) => (await adminService.revokeUserTokens(userId, { reason: reason || undefined })).data,
  });
}

onMounted(load);
</script>

<template>
  <section class="admin-page">
    <button class="back" @click="router.push('/admin/users')"><AdminIcon name="back" :size="16" /> 회원 목록</button>

    <LoadingState v-if="loading" variant="list" :count="4" />

    <template v-else-if="user">
      <div class="admin-page-head">
        <div class="head-user">
          <div class="avatar">{{ user.nickname.slice(0, 1).toUpperCase() }}</div>
          <div>
            <h1 class="admin-page-title">{{ user.nickname }}</h1>
            <p class="admin-page-sub">{{ user.email }}</p>
          </div>
        </div>
        <div class="badges">
          <AdminStatusBadge :label="getUserRoleMeta(user.role).label" :tone="getUserRoleMeta(user.role).tone" />
          <AdminStatusBadge :label="getUserStatusMeta(user.status).label" :tone="getUserStatusMeta(user.status).tone" />
        </div>
      </div>

      <div class="grid">
        <div class="admin-card">
          <h2 class="card-title">기본 정보</h2>
          <dl class="info">
            <div><dt>ID</dt><dd>{{ user.id }}</dd></div>
            <div><dt>이메일 인증</dt><dd>{{ user.emailVerified ? "완료" : "미인증" }}</dd></div>
            <div><dt>소개</dt><dd>{{ user.bio || "—" }}</dd></div>
            <div><dt>최근 로그인</dt><dd>{{ formatDateTime(user.lastLoginAt) }}</dd></div>
            <div><dt>가입일</dt><dd>{{ formatDate(user.createdAt) }}</dd></div>
            <div><dt>수정일</dt><dd>{{ formatDateTime(user.updatedAt) }}</dd></div>
          </dl>
        </div>

        <div class="admin-card">
          <h2 class="card-title">관리 조치</h2>
          <p v-if="isSelf" class="self-note">본인 계정은 상태·역할을 변경할 수 없어요.</p>

          <div class="action-group">
            <span class="action-label">상태</span>
            <div class="action-btns">
              <button v-if="user.status !== 'ACTIVE'" class="admin-btn" :disabled="isSelf" @click="changeStatus('ACTIVE')">활성화</button>
              <button v-if="user.status !== 'SUSPENDED'" class="admin-btn admin-btn--danger" :disabled="isSelf" @click="changeStatus('SUSPENDED')">정지</button>
              <button v-if="user.status !== 'DELETED'" class="admin-btn admin-btn--danger" :disabled="isSelf" @click="changeStatus('DELETED')">탈퇴 처리</button>
            </div>
          </div>

          <div class="action-group">
            <span class="action-label">역할</span>
            <div class="action-btns">
              <button v-if="user.role === 'USER'" class="admin-btn" :disabled="isSelf" @click="changeRole('ADMIN')">관리자로 승격</button>
              <button v-else class="admin-btn" :disabled="isSelf" @click="changeRole('USER')">일반으로 강등</button>
            </div>
          </div>

          <div class="action-group">
            <span class="action-label">보안</span>
            <div class="action-btns">
              <button class="admin-btn admin-btn--danger" @click="revokeTokens">토큰 강제 폐기</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <AdminReasonDialog
      v-if="dialog"
      :open="dialogOpen"
      :title="dialog.title"
      :message="dialog.message"
      :danger="dialog.danger"
      :reason-required="dialog.reasonRequired"
      :reason-placeholder="dialog.reasonPlaceholder ?? '사유 (선택)'"
      :loading="submitting"
      @confirm="onConfirm"
      @cancel="dialogOpen = false"
    />
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 900px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 18px;
  border: 0;
  background: transparent;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
}
.back:hover {
  color: var(--fg);
}
.head-user {
  display: flex;
  align-items: center;
  gap: 14px;
}
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--tint-cyan);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-h3);
  font-weight: var(--w-bold);
  color: var(--on-tint-cyan);
}
.badges {
  display: flex;
  gap: 8px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.card-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
  margin: 0 0 16px;
}
.info {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.info div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.info dt {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  flex-shrink: 0;
}
.info dd {
  font-size: var(--fs-body);
  font-weight: var(--w-medium);
  margin: 0;
  text-align: right;
  word-break: break-word;
}
.self-note {
  font-size: var(--fs-caption);
  color: var(--hold-orange);
  margin: 0 0 14px;
}
.action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 0;
  border-top: 1px solid var(--border);
}
.action-group:first-of-type {
  border-top: 0;
  padding-top: 0;
}
.action-label {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.action-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
