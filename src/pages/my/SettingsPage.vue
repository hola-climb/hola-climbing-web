<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonIcon, IonSpinner, IonAlert } from "@ionic/vue";
import { chevronBackOutline } from "ionicons/icons";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

// ── Profile edit ───────────────────────────────────
const nickname = ref(authStore.user?.nickname ?? "");
const bio = ref(authStore.user?.bio ?? "");

// ── Climbing info ──────────────────────────────────
interface ExpOption {
  label: string;
  months: number;
}
const EXP_OPTIONS: ExpOption[] = [
  { label: "1개월 미만", months: 0 },
  { label: "1~3개월", months: 2 },
  { label: "3~6개월", months: 4 },
  { label: "6개월~1년", months: 9 },
  { label: "1~2년", months: 18 },
  { label: "2~3년", months: 30 },
  { label: "3~5년", months: 48 },
  { label: "5년 이상", months: 72 },
];

const climbingExperienceMonths = ref(authStore.user?.climbingExperienceMonths ?? -1);

function saveClimbingInfo() {
  if (climbingExperienceMonths.value < 0) {
    uiStore.showToast("경력을 선택해주세요.", "warning");
    return;
  }
  authStore.saveClimbingInfo(climbingExperienceMonths.value);
  uiStore.showToast("클라이밍 정보가 저장됐어요.");
}
const isSaving = ref(false);

async function saveProfile() {
  if (!nickname.value.trim()) {
    uiStore.showToast("닉네임을 입력해주세요.", "warning");
    return;
  }
  isSaving.value = true;
  try {
    await authStore.updateProfile({
      nickname: nickname.value.trim(),
      bio: bio.value.trim() || null,
    });
    uiStore.showToast("프로필이 저장됐어요.");
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    uiStore.showToast(msg ?? "저장에 실패했어요.", "danger");
  } finally {
    isSaving.value = false;
  }
}

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

const deleteAlertButtons = [
  {
    text: "취소",
    role: "cancel",
    handler: () => {
      showDeleteAlert.value = false;
      deletePassword.value = "";
    },
  },
  {
    text: "탈퇴",
    role: "confirm",
    cssClass: "alert-danger",
    handler: (data: Record<string, string>) => {
      deletePassword.value = data.password ?? "";
      handleDelete();
    },
  },
];

async function handleDelete() {
  if (!deletePassword.value) {
    uiStore.showToast("비밀번호를 입력해주세요.", "warning");
    return;
  }
  isDeleting.value = true;
  try {
    await authStore.deleteAccount(deletePassword.value);
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
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <button class="back-btn" @click="router.back()" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <span class="toolbar-title">설정</span>
          <div />
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div class="settings-content page-padding">
        <!-- Profile section -->
        <section class="settings-section">
          <h2 class="section-title">프로필 편집</h2>

          <div class="hola-card form-card">
            <div class="form-field">
              <label class="field-label" for="s-nickname">닉네임</label>
              <input id="s-nickname" v-model="nickname" class="field-input" type="text" placeholder="닉네임" maxlength="20" aria-label="닉네임" />
            </div>
            <div class="form-divider" />
            <div class="form-field">
              <label class="field-label" for="s-bio">소개</label>
              <textarea id="s-bio" v-model="bio" class="field-input field-textarea" placeholder="클라이머 소개 (선택)" maxlength="200" rows="3" aria-label="소개" />
            </div>
          </div>

          <button class="save-btn" :disabled="isSaving" @click="saveProfile" aria-label="프로필 저장">
            <IonSpinner v-if="isSaving" name="crescent" style="width: 16px; height: 16px; --color: #fff" />
            <span v-else>저장</span>
          </button>
        </section>

        <!-- Climbing info section -->
        <section class="settings-section">
          <h2 class="section-title">클라이밍 정보</h2>

          <div class="hola-card form-card">
            <div class="form-field">
              <label class="field-label">클라이밍 경력</label>
              <div class="exp-grid" role="radiogroup" aria-label="클라이밍 경력">
                <button
                  v-for="opt in EXP_OPTIONS"
                  :key="opt.months"
                  class="exp-chip"
                  :class="{ selected: climbingExperienceMonths === opt.months }"
                  :aria-checked="climbingExperienceMonths === opt.months"
                  role="radio"
                  @click="climbingExperienceMonths = opt.months"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>

          <button class="save-btn" @click="saveClimbingInfo" aria-label="클라이밍 정보 저장">저장</button>
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

    <!-- Logout alert -->
    <IonAlert
      :is-open="showLogoutAlert"
      header="로그아웃"
      message="정말 로그아웃하시겠어요?"
      :buttons="[
        {
          text: '취소',
          role: 'cancel',
          handler: () => {
            showLogoutAlert = false;
          },
        },
        { text: '로그아웃', role: 'confirm', handler: handleLogout },
      ]"
      @did-dismiss="showLogoutAlert = false"
    />

    <!-- Delete account alert -->
    <IonAlert
      :is-open="showDeleteAlert"
      header="회원 탈퇴"
      message="탈퇴하면 모든 데이터가 삭제됩니다. 비밀번호를 입력해 확인해주세요."
      :inputs="[{ name: 'password', type: 'password', placeholder: '비밀번호' }]"
      :buttons="deleteAlertButtons"
      @did-dismiss="showDeleteAlert = false"
    />
  </IonPage>
</template>

<style scoped>
.toolbar-inner {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  padding: 0 12px;
  height: 52px;
}
.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  font-size: 22px;
  display: grid;
  place-items: center;
  padding: 6px;
}
.toolbar-title {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
}

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
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  margin: 0 4px;
}

/* Form card */
.form-card {
  padding: 0;
}
.form-field {
  padding: 14px 18px;
}
.field-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  display: block;
  margin-bottom: 6px;
}
.field-input {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 600;
  color: var(--fg);
  outline: none;
}
.field-input::placeholder {
  color: var(--fg-muted);
  font-weight: 400;
}
.field-textarea {
  resize: none;
  line-height: 1.45;
}
.form-divider {
  height: 1px;
  background: var(--border);
  margin: 0 18px;
}

.save-btn {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: var(--r-button);
  background: var(--hold-dark);
  color: #fff;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: opacity var(--dur-fast) var(--ease-state);
}
.save-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Climbing info */
.exp-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding-top: 8px;
}
.exp-chip {
  height: 44px;
  border-radius: var(--r-button);
  border: 1.5px solid var(--border);
  background: var(--surface);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-state);
  color: var(--fg);
}
.exp-chip.selected {
  background: var(--hold-dark);
  border-color: var(--hold-dark);
  color: #fff;
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
  font-size: 15px;
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
