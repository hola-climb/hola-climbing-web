<script setup lang="ts">
// imports → state → methods
import { ref } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import AppHeader from "@/components/common/AppHeader.vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

// ── Management entries ─────────────────────────────
const manageItems = [
  { label: "즐겨찾기 암장", action: () => router.push("/my/favorites") },
  { label: "차단 관리", action: () => router.push("/my/blocks") },
];

// ── Logout ─────────────────────────────────────────
const showLogoutAlert = ref(false);

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
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    uiStore.showToast(msg ?? "계정 삭제에 실패했어요.", "danger");
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
</style>
