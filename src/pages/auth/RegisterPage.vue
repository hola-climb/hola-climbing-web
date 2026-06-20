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
import type { Term } from "@/types/api";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

const nickname = ref("");
const email = ref("");
const password = ref("");
const isLoading = ref(false);

// 이메일 중복 확인 상태 — GET /api/auth/email-check
type EmailStatus = "idle" | "checking" | "available" | "taken" | "invalid";
const emailStatus = ref<EmailStatus>("idle");
const emailMessages: Record<Exclude<EmailStatus, "idle">, string> = {
  checking: "확인 중...",
  available: "사용 가능한 이메일이에요.",
  taken: "이미 가입된 이메일이에요.",
  invalid: "이메일 형식을 확인해주세요.",
};

function onEmailInput() {
  // 입력이 바뀌면 이전 확인 결과를 초기화
  if (emailStatus.value !== "idle") emailStatus.value = "idle";
}

async function checkEmailAvailability() {
  const value = email.value.trim();
  if (!value) {
    emailStatus.value = "idle";
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    emailStatus.value = "invalid";
    return;
  }
  emailStatus.value = "checking";
  try {
    const { data } = await authService.checkEmail(value);
    emailStatus.value = data.available ? "available" : "taken";
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    // 확인 실패 시 가입 흐름을 막지 않도록 idle로 되돌린다.
    emailStatus.value = "idle";
  }
}

// Active terms loaded from API. agreed map keyed by termId.
const terms = ref<Term[]>([]);
const agreed = ref<Record<number, boolean>>({});

// '보기'로 펼쳐 볼 약관. null 이면 모달 닫힘.
const viewingTerm = ref<Term | null>(null);

const allRequiredAgreed = computed(() => terms.value.filter((t) => t.required).every((t) => agreed.value[t.termId]));

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
    terms.value = [...data].sort((a, b) => a.termId - b.termId);
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
  if (emailStatus.value === "taken") {
    uiStore.showToast("이미 가입된 이메일이에요.", "warning");
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
            <IonInput
              id="reg-email"
              v-model="email"
              type="email"
              placeholder="hello@climbing.kr"
              class="hola-input"
              autocomplete="email"
              @ion-input="onEmailInput"
              @ion-blur="checkEmailAvailability"
            />
            <p v-if="emailStatus !== 'idle'" class="field-hint" :class="{ ok: emailStatus === 'available', err: emailStatus === 'taken' || emailStatus === 'invalid' }" aria-live="polite">
              {{ emailMessages[emailStatus] }}
            </p>
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
              <span class="terms-text">({{ term.required ? "필수" : "선택" }}) {{ term.title }}</span>
              <button type="button" class="terms-view" :aria-label="`${term.title} 약관 보기`" @click="viewingTerm = term">보기</button>
            </div>
          </div>

          <BaseButton variant="primary" block :loading="isLoading" :disabled="!nickname || !email || !password" class="submit-btn" @click="handleRegister">계정 만들기</BaseButton>
        </div>

        <div class="auth-footer">
          <span class="footer-text">이미 계정이 있으신가요?</span>
          <button class="footer-link" @click="router.push('/auth/login')">로그인</button>
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
.field-hint {
  margin: 0;
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.field-hint.ok {
  /* color: yellowgreen; */
  /* color: var(--hold-cyan); */
  color: #9bc600;
}
.field-hint.err {
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
