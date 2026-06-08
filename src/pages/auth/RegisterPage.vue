<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { IonPage, IonContent, IonButton, IonInput, IonCheckbox, IonSpinner, IonIcon } from "@ionic/vue";
import { chevronBackOutline } from "ionicons/icons";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { authService } from "@/services/auth";
import type { Term } from "@/types/api";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

const nickname = ref("");
const email = ref("");
const password = ref("");
const isLoading = ref(false);

// Active terms loaded from API. agreed map keyed by termId.
const terms = ref<Term[]>([]);
const agreed = ref<Record<number, boolean>>({});

const allRequiredAgreed = computed(() =>
  terms.value.filter((t) => t.required).every((t) => agreed.value[t.termId]),
);

const pwErrors = ref<string[]>([]);

function validatePassword(pw: string) {
  const errs: string[] = [];
  if (pw.length < 8) errs.push("8자 이상이어야 해요");
  if (!/[a-zA-Z]/.test(pw)) errs.push("영문자 포함 필요");
  if (!/\d/.test(pw)) errs.push("숫자 포함 필요");
  if (!/[^a-zA-Z0-9]/.test(pw)) errs.push("특수문자 포함 필요");
  return errs;
}

function onPasswordInput() {
  pwErrors.value = validatePassword(password.value);
}

async function loadTerms() {
  try {
    const { data } = await authService.getTerms();
    terms.value = data;
    // default all to false
    agreed.value = Object.fromEntries(data.map((t) => [t.termId, false]));
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("약관을 불러오지 못했어요.", "danger");
  }
}

async function handleRegister() {
  const errors = validatePassword(password.value);
  if (errors.length) {
    pwErrors.value = errors;
    return;
  }
  if (!allRequiredAgreed.value) {
    uiStore.showToast("필수 약관에 동의해주세요.", "warning");
    return;
  }

  isLoading.value = true;
  try {
    const termsAgreed = terms.value.map((t) => ({
      termId: t.termId,
      agreed: !!agreed.value[t.termId],
    }));
    await authStore.register(email.value.trim(), password.value, nickname.value.trim(), termsAgreed);
    uiStore.showToast("인증 메일을 보냈어요. 메일 확인 후 로그인해주세요.");
    router.replace("/auth/login");
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    uiStore.showToast(msg ?? "회원가입에 실패했어요.", "danger");
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadTerms);
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="auth-content">
        <div class="auth-header">
          <button class="back-btn" @click="router.back()" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <h1 class="auth-title">회원가입</h1>
          <p class="auth-subtitle">클라이밍 여정을 시작해요.</p>
        </div>

        <div class="auth-form">
          <div class="field">
            <label class="field-label" for="reg-nickname">닉네임</label>
            <IonInput id="reg-nickname" v-model="nickname" placeholder="클라이머" class="hola-input" :maxlength="20" />
          </div>

          <div class="field">
            <label class="field-label" for="reg-email">이메일</label>
            <IonInput id="reg-email" v-model="email" type="email" placeholder="hello@climbing.kr" class="hola-input" autocomplete="email" />
          </div>

          <div class="field">
            <label class="field-label" for="reg-pw">비밀번호</label>
            <IonInput id="reg-pw" v-model="password" type="password" placeholder="8자 이상 · 영문+숫자+특수문자" class="hola-input" autocomplete="new-password" @ion-input="onPasswordInput" />
            <ul v-if="pwErrors.length" class="pw-errors" aria-live="polite">
              <li v-for="err in pwErrors" :key="err">{{ err }}</li>
            </ul>
          </div>

          <div class="terms-group">
            <div v-for="term in terms" :key="term.termId" class="terms-row">
              <IonCheckbox v-model="agreed[term.termId]" />
              <span class="terms-text">({{ term.required ? '필수' : '선택' }}) {{ term.title }}</span>
            </div>
          </div>

          <IonButton expand="block" :disabled="isLoading || !nickname || !email || !password" @click="handleRegister" class="submit-btn">
            <IonSpinner v-if="isLoading" name="dots" slot="start" />
            {{ isLoading ? "처리 중..." : "계정 만들기" }}
          </IonButton>
        </div>

        <div class="auth-footer">
          <span class="footer-text">이미 계정이 있으신가요?</span>
          <button class="footer-link" @click="router.push('/auth/login')">로그인</button>
        </div>
      </div>
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
.pw-errors {
  margin: 0;
  padding-left: 16px;
  list-style: disc;
}
.pw-errors li {
  font-size: var(--fs-caption);
  color: var(--hold-pink);
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

.submit-btn {
  --background: var(--hold-dark);
  --border-radius: var(--r-button);
  --box-shadow: none;
  height: 52px;
  font-weight: var(--w-bold);
  margin-top: 4px;
}

.auth-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 32px 0 40px;
  margin-top: auto;
}
.footer-text {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.footer-link {
  background: none;
  border: none;
  color: var(--fg);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
  padding: 0;
}
</style>
