<script setup lang="ts">
import { ref } from "vue";
import { IonPage, IonContent, IonIcon, IonInput } from "@ionic/vue";
import { eyeOutline, eyeOffOutline } from "ionicons/icons";
import BaseButton from "@/components/common/BaseButton.vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { authService } from "@/services/auth";
import { useOAuth } from "@/composables/useOAuth";
import { OAuthProvider } from "@/types/api";
import { getErrorMessage, getErrorCode } from "@/utils/apiError";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const uiStore = useUIStore();
const { startLogin: startSocialLogin } = useOAuth();

const email = ref("");
const password = ref("");
const showPw = ref(false);
const isLoading = ref(false);

// 이메일 미인증 등으로 로그인 실패 시 재발송 안내 노출
const showResend = ref(false);
const isResending = ref(false);

async function handleResend() {
  const value = email.value.trim();
  if (!value) {
    uiStore.showToast("이메일을 입력해주세요.", "warning");
    return;
  }
  isResending.value = true;
  try {
    await authService.resendVerification(value);
    // 보안상 미가입 이메일도 동일 응답 — 항상 동일 안내
    uiStore.showToast("인증 메일을 다시 보냈어요. 메일함을 확인해주세요.");
    showResend.value = false;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("인증 메일 재발송에 실패했어요.", "danger");
  } finally {
    isResending.value = false;
  }
}

async function handleLogin() {
  if (!email.value || !password.value) {
    uiStore.showToast("이메일과 비밀번호를 입력해주세요.", "warning");
    return;
  }

  isLoading.value = true;
  try {
    await authStore.login(email.value.trim(), password.value);
    const redirect = (route.query.redirect as string) || "/feed";
    router.replace(redirect);
  } catch (err: unknown) {
    const code = getErrorCode(err);
    const msg = getErrorMessage(err, "로그인에 실패했어요.");
    // 이메일 미인증(U004)으로 인한 실패면 재발송 안내를 노출한다.
    if (code === "U004" || msg.includes("인증")) {
      showResend.value = true;
    }
    uiStore.showToast(msg, "danger");
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="auth-content">
        <!-- Brand header -->
        <div class="auth-hero">
          <div class="glow glow-lime" aria-hidden="true" />
          <div class="brand">HOLA</div>
          <p class="tagline">등반을 기록하고, AI로 성장하세요.</p>
        </div>

        <!-- Form -->
        <div class="auth-form">
          <div class="field">
            <label class="field-label" for="login-email">이메일</label>
            <IonInput id="login-email" v-model="email" type="email" placeholder="이메일을 입력하세요" class="hola-input" autocomplete="email" @keydown.enter="handleLogin" />
          </div>

          <div class="field">
            <label class="field-label" for="login-pw">비밀번호</label>
            <div class="pw-wrap">
              <IonInput id="login-pw" v-model="password" :type="showPw ? 'text' : 'password'" placeholder="비밀번호를 입력하세요" class="hola-input" autocomplete="current-password" @keydown.enter="handleLogin" />
              <button class="pw-toggle" @click="showPw = !showPw" :aria-label="showPw ? '비밀번호 숨기기' : '비밀번호 보기'">
                <IonIcon :icon="showPw ? eyeOffOutline : eyeOutline" />
              </button>
            </div>
          </div>

          <button class="forgot-link" @click="router.push('/auth/password-reset')">비밀번호를 잊으셨나요?</button>

          <BaseButton variant="primary" block :loading="isLoading" class="submit-btn" @click="handleLogin">로그인</BaseButton>

          <div v-if="showResend" class="resend-box" aria-live="polite">
            <span class="resend-text">이메일 인증이 필요해요.</span>
            <button class="resend-link" :disabled="isResending" @click="handleResend">
              {{ isResending ? "보내는 중..." : "인증 메일 다시 보내기" }}
            </button>
          </div>

          <!-- Social login -->
          <div class="divider"><span>또는</span></div>

          <div class="social-btns">
            <button class="social-btn kakao" aria-label="카카오로 로그인" @click="startSocialLogin(OAuthProvider.KAKAO)">카카오로 시작하기</button>
            <button class="social-btn google" aria-label="구글로 로그인" @click="startSocialLogin(OAuthProvider.GOOGLE)">Google로 시작하기</button>
            <button class="social-btn naver" aria-label="네이버로 로그인" @click="startSocialLogin(OAuthProvider.NAVER)">네이버로 시작하기</button>
          </div>
        </div>

        <!-- Footer -->
        <div class="auth-footer">
          <span class="footer-text">아직 계정이 없으신가요?</span>
          <button class="footer-link" @click="router.push('/auth/register')">회원가입</button>
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
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.auth-hero {
  padding: 80px 0 32px;
  text-align: center;
  position: relative;
}
.glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  pointer-events: none;
}
.glow-lime {
  background: var(--hold-lime);
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
}
.brand {
  font-size: 48px;
  font-weight: 800;
  letter-spacing: 0.06em;
  position: relative;
}
.tagline {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  margin-top: 8px;
  position: relative;
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
  --padding-end: 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-input);
  background: var(--surface);
  height: 50px;
  font-size: var(--fs-body);
}

.pw-wrap {
  position: relative;
}
.pw-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg-muted);
  font-size: 18px;
  display: grid;
  place-items: center;
  padding: 4px;
  z-index: 2;
}

.forgot-link {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
  text-align: right;
  padding: 0;
  margin-top: -4px;
}

.submit-btn {
  margin-top: 4px;
}

.resend-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.resend-text {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.resend-link {
  background: none;
  border: none;
  color: var(--fg);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
  padding: 0;
}
.resend-link:disabled {
  opacity: 0.6;
  cursor: default;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
}
.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.social-btns {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.social-btn {
  height: 48px;
  border-radius: var(--r-button);
  border: 1px solid var(--border);
  background: var(--surface);
  font-family: var(--font-sans);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
  transition: opacity var(--dur-fast) var(--ease-state);
}
.social-btn:active {
  opacity: 0.7;
}
.social-btn.kakao {
  background: var(--brand-kakao);
  border-color: var(--brand-kakao);
  color: var(--brand-kakao-fg);
}
.social-btn.naver {
  background: var(--brand-naver);
  border-color: var(--brand-naver);
  color: var(--brand-naver-fg);
}
.social-btn.google {
  background: var(--surface);
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
