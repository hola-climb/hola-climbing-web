<script setup lang="ts">
// imports → state → methods
import { ref, onMounted } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import AppHeader from "@/components/common/AppHeader.vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { getErrorMessage } from "@/utils/apiError";
import { notificationService } from "@/services/notification";
import type { NotificationSettings } from "@/services/notification";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

// ── Notification settings ──────────────────────────
const notiSettings = ref<NotificationSettings>({
  notifyComment: true,
  notifyReply: true,
  notifyLike: true,
  notifyFollow: true,
  notifyChat: true,
  notifySystem: true,
});
const notiLoading = ref(true);

const notiItems: { key: keyof NotificationSettings; label: string }[] = [
  { key: "notifyComment", label: "댓글" },
  { key: "notifyReply", label: "답글" },
  { key: "notifyLike", label: "좋아요" },
  { key: "notifyFollow", label: "팔로우" },
  { key: "notifyChat", label: "채팅" },
  { key: "notifySystem", label: "공지 및 시스템" },
];

async function toggleNoti(key: keyof NotificationSettings) {
  const prev = notiSettings.value[key];
  notiSettings.value[key] = !prev;
  try {
    const { data } = await notificationService.updateSettings({ [key]: !prev });
    notiSettings.value = data;
  } catch (err: unknown) {
    notiSettings.value[key] = prev;
    uiStore.showToast(getErrorMessage(err, "알림 설정 변경에 실패했어요."), "danger");
  }
}

// ── Management entries ─────────────────────────────
const manageItems = [
  { label: "즐겨찾기 암장", action: () => router.push("/my/favorites") },
  { label: "차단 관리", action: () => router.push("/my/blocks") },
  { label: "약관 동의 현황", action: () => router.push("/my/terms") },
];

// ── Logout ─────────────────────────────────────────
const showLogoutAlert = ref(false);

onMounted(async () => {
  try {
    const { data } = await notificationService.getSettings();
    notiSettings.value = data;
  } catch {
    // 조회 실패 시 기본값(전부 true) 유지
  } finally {
    notiLoading.value = false;
  }
});

async function handleLogout() {
  await authStore.logout();
  router.replace("/feed");
  uiStore.showToast("로그아웃되었어요.");
}

// ── Account deletion ───────────────────────────────
const showDeleteAlert = ref(false);
const deletePassword = ref("");
const isDeleting = ref(false);

async function handleDelete(password: string) {
  deletePassword.value = password;
  if (!password) {
    uiStore.showToast("비밀번호를 입력해주세요.", "warning");
    return;
  }
  isDeleting.value = true;
  try {
    await authStore.deleteAccount(password);
    router.replace("/auth/login");
    uiStore.showToast("계정이 삭제됐어요.");
  } catch (err: unknown) {
    uiStore.showToast(getErrorMessage(err, "계정 삭제에 실패했어요."), "danger");
  } finally {
    isDeleting.value = false;
    showDeleteAlert.value = false;
    deletePassword.value = "";
  }
}
</script>

<template>
  <IonPage>
    <AppHeader title="설정" />

    <IonContent>
      <div class="settings-content page-padding">
        <!-- Notification settings section -->
        <section class="settings-section">
          <h2 class="section-title">알림</h2>
          <div class="hola-card action-card" :class="{ loading: notiLoading }">
            <template v-for="(item, i) in notiItems" :key="item.key">
              <div v-if="i > 0" class="action-divider" />
              <div class="toggle-row">
                <span class="action-label">{{ item.label }}</span>
                <button
                  class="toggle"
                  :class="{ on: notiSettings[item.key] }"
                  role="switch"
                  :aria-checked="notiSettings[item.key]"
                  :aria-label="`${item.label} 알림 ${notiSettings[item.key] ? '켜짐' : '꺼짐'}`"
                  :disabled="notiLoading"
                  @click="toggleNoti(item.key)"
                >
                  <span class="toggle-thumb" />
                </button>
              </div>
            </template>
          </div>
        </section>

        <!-- Management section -->
        <section class="settings-section">
          <h2 class="section-title">관리</h2>

          <div class="hola-card action-card">
            <template v-for="(item, i) in manageItems" :key="item.label">
              <div v-if="i > 0" class="action-divider" />
              <button class="action-row" :aria-label="item.label" @click="item.action()">
                <span class="action-label">{{ item.label }}</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </button>
            </template>
          </div>
        </section>

        <!-- Account section -->
        <section class="settings-section">
          <h2 class="section-title">계정</h2>

          <div class="hola-card action-card">
            <button class="action-row" @click="showLogoutAlert = true" aria-label="로그아웃">
              <span class="action-label">로그아웃</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
            <div class="action-divider" />
            <button class="action-row danger" @click="showDeleteAlert = true" aria-label="회원 탈퇴">
              <span class="action-label">회원 탈퇴</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>
      </div>
    </IonContent>

    <!-- Logout confirm -->
    <ConfirmDialog :open="showLogoutAlert" title="로그아웃" message="정말 로그아웃하시겠어요?" confirm-text="로그아웃" @confirm="handleLogout" @cancel="showLogoutAlert = false" />

    <!-- Delete account confirm -->
    <ConfirmDialog
      :open="showDeleteAlert"
      title="회원 탈퇴"
      message="탈퇴하면 모든 데이터가 삭제됩니다. 비밀번호를 입력해 확인해주세요."
      confirm-text="탈퇴"
      danger
      with-password
      @confirm="handleDelete"
      @cancel="
        showDeleteAlert = false;
        deletePassword = '';
      "
    />
  </IonPage>
</template>

<style scoped>
.settings-content {
  padding-top: 20px;
  padding-bottom: 60px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  font-size: var(--fs-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  margin: 0 4px;
}

/* Action card */
.action-card {
  padding: 0;
}
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 18px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: opacity var(--dur-fast) var(--ease-state);
}
.action-row:active {
  opacity: 0.6;
}
.action-label {
  font-size: var(--fs-body);
  font-weight: 500;
  color: var(--fg);
}
.action-row.danger .action-label {
  color: var(--hold-pink);
}
.action-divider {
  height: 1px;
  background: var(--border);
  margin: 0 18px;
}

/* Toggle row */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
}
.toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: var(--surface-soft);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-fast) var(--ease-state);
}
.toggle.on {
  background: var(--hold-lime);
}
.toggle:disabled {
  opacity: 0.4;
  cursor: default;
}
.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--dur-fast) var(--ease-state);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle.on .toggle-thumb {
  transform: translateX(18px);
}
.action-card.loading {
  opacity: 0.6;
  pointer-events: none;
}
</style>
