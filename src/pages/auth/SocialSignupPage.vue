<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { IonPage, IonContent, IonInput, IonCheckbox, IonIcon } from "@ionic/vue";
import { chevronBackOutline } from "ionicons/icons";
import BaseButton from "@/components/common/BaseButton.vue";
import TermViewModal from "@/components/common/TermViewModal.vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { authService } from "@/services/auth";
import { loadSocialSignupContext, clearSocialSignupContext } from "@/composables/useOAuth";
import type { Term } from "@/types/api";
import { getErrorMessage } from "@/utils/apiError";

// 소셜 최초 로그인 시 닉네임 입력 + 필수 약관 동의 (F-01-05).
// 컨텍스트(signupToken·프리필)는 exchange 단계에서 sessionStorage 에 저장돼 있다.
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

const ctx = loadSocialSignupContext();

const nickname = ref(ctx?.suggestedNickname ?? "");
const isLoading = ref(false);

const terms = ref<Term[]>([]);
const agreed = ref<Record<number, boolean>>({});
const viewingTerm = ref<Term | null>(null);

const allRequiredAgreed = computed(() => terms.value.filter((t) => t.required).every((t) => agreed.value[t.termId]));

async function loadTerms() {
  try {
    const { data } = await authService.getTerms();
    terms.value = [...data].sort((a, b) => a.termId - b.termId);
    agreed.value = Object.fromEntries(data.map((t) => [t.termId, false]));
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("약관을 불러오지 못했어요.", "danger");
  }
}

async function handleSubmit() {
  const name = nickname.value.trim();
  if (name.length < 2 || name.length > 20) {
    uiStore.showToast("닉네임은 2~20자로 입력해주세요.", "warning");
    return;
  }
  if (!allRequiredAgreed.value) {
    uiStore.showToast("필수 약관에 동의해주세요.", "warning");
    return;
  }
  if (!ctx?.signupToken) {
    uiStore.showToast("가입 정보가 만료됐어요. 다시 로그인해주세요.", "danger");
    router.replace("/auth/login");
    return;
  }

  isLoading.value = true;
  try {
    const termsAgreed = terms.value.map((t) => ({ termId: t.termId, agreed: !!agreed.value[t.termId] }));
    await authStore.oauthSignup({ signupToken: ctx.signupToken, nickname: name, termsAgreed });
    clearSocialSignupContext();
    uiStore.showToast("환영해요! 가입이 완료됐어요.");
    router.replace("/feed");
  } catch (err: unknown) {
    uiStore.showToast(getErrorMessage(err, "가입에 실패했어요."), "danger");
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  // 직접 접근(컨텍스트 없음) → 로그인으로
  if (!ctx) {
    router.replace("/auth/login");
    return;
  }
  loadTerms();
});
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="auth-content">
        <div class="auth-header">
          <button class="back-btn" @click="router.replace('/auth/login')" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <h1 class="auth-title">프로필 설정</h1>
          <p class="auth-subtitle">닉네임만 정하면 바로 시작해요.</p>
        </div>

        <div class="auth-form">
          <div v-if="ctx?.email" class="linked-account">
            <span class="linked-label">연결된 계정</span>
            <span class="linked-email">{{ ctx.email }}</span>
          </div>

          <div class="field">
            <label class="field-label" for="social-nickname">닉네임</label>
            <IonInput id="social-nickname" v-model="nickname" placeholder="클라이머" class="hola-input" :maxlength="20" />
          </div>

          <div class="terms-group">
            <div v-for="term in terms" :key="term.termId" class="terms-row">
              <IonCheckbox v-model="agreed[term.termId]" />
              <span class="terms-text">({{ term.required ? "필수" : "선택" }}) {{ term.title }}</span>
              <button type="button" class="terms-view" :aria-label="`${term.title} 약관 보기`" @click="viewingTerm = term">보기</button>
            </div>
          </div>

          <BaseButton variant="primary" block :loading="isLoading" :disabled="!nickname" class="submit-btn" @click="handleSubmit">올라 시작하기</BaseButton>
        </div>
      </div>

      <TermViewModal :term="viewingTerm" @close="viewingTerm = null" />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.auth-content {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}
.auth-header {
  padding-top: 60px;
  padding-bottom: 32px;
}
.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  font-size: 24px;
  display: grid;
  place-items: center;
  margin-bottom: 20px;
  padding: 0;
}
.auth-title {
  font-size: var(--fs-h1);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.015em;
  margin: 0 0 8px;
}
.auth-subtitle {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  margin: 0;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.linked-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-input);
  background: var(--surface);
}
.linked-label {
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg-muted);
}
.linked-email {
  font-size: var(--fs-caption);
  color: var(--fg);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
}
.hola-input {
  --background: var(--surface);
  --border-radius: var(--r-input);
  --padding-start: 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-input);
  background: var(--surface);
  height: 50px;
}
.terms-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.terms-text {
  font-size: var(--fs-caption);
  line-height: 1.4;
}
.terms-view {
  margin-left: auto;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px 2px;
  font-family: var(--font-sans);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.submit-btn {
  margin-top: 4px;
}
</style>
