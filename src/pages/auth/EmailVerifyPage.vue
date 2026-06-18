<script setup lang="ts">
import { ref, onMounted } from "vue";
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import { checkmarkCircleOutline, closeCircleOutline, mailOutline } from "ionicons/icons";
import BaseButton from "@/components/common/BaseButton.vue";
import { useRouter, useRoute } from "vue-router";
import { useUIStore } from "@/stores/ui";
import { authService } from "@/services/auth";

type PageState = "verifying" | "success" | "failed" | "no-token";

const router = useRouter();
const route = useRoute();
const uiStore = useUIStore();

const state = ref<PageState>("verifying");
const email = ref("");
const isResending = ref(false);

async function verify(token: string) {
  try {
    await authService.verifyEmail(token);
    state.value = "success";
    setTimeout(() => router.replace('/auth/login'), 2000);
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    state.value = "failed";
  }
}

async function handleResend() {
  const value = email.value.trim();
  if (!value) {
    uiStore.showToast("이메일을 입력해주세요.", "warning");
    return;
  }
  isResending.value = true;
  try {
    await authService.resendVerification(value);
    uiStore.showToast("인증 메일을 다시 보냈어요. 메일함을 확인해주세요.");
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("인증 메일 재발송에 실패했어요.", "danger");
  } finally {
    isResending.value = false;
  }
}

onMounted(() => {
  const token = route.query.token as string | undefined;
  if (!token) {
    state.value = "no-token";
    return;
  }
  verify(token);
});
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="verify-content">
        <div class="glow glow-lime" aria-hidden="true" />

        <!-- Verifying -->
        <div v-if="state === 'verifying'" class="state-block" aria-live="polite">
          <div class="breathing-dot" aria-label="인증 중" />
          <p class="state-title">인증 중이에요</p>
          <p class="state-sub">잠시만 기다려주세요.</p>
        </div>

        <!-- Success -->
        <div v-else-if="state === 'success'" class="state-block" aria-live="polite">
          <div class="icon-wrap success">
            <IonIcon :icon="checkmarkCircleOutline" aria-hidden="true" />
          </div>
          <p class="state-title">인증 완료!</p>
          <p class="state-sub">이메일 인증이 완료됐어요.<br />지금 바로 올라를 시작해보세요.</p>
          <BaseButton variant="primary" block class="action-btn" @click="router.replace('/auth/login')">
            로그인하러 가기
          </BaseButton>
        </div>

        <!-- Failed -->
        <div v-else-if="state === 'failed'" class="state-block" aria-live="polite">
          <div class="icon-wrap failed">
            <IonIcon :icon="closeCircleOutline" aria-hidden="true" />
          </div>
          <p class="state-title">인증에 실패했어요</p>
          <p class="state-sub">링크가 만료됐거나 올바르지 않아요.<br />아래에서 인증 메일을 다시 받아보세요.</p>

          <div class="resend-form">
            <label class="field-label" for="resend-email">가입한 이메일</label>
            <input
              id="resend-email"
              v-model="email"
              type="email"
              class="hola-input-native"
              placeholder="hello@climbing.kr"
              autocomplete="email"
            />
          </div>

          <BaseButton
            variant="primary"
            block
            :loading="isResending"
            class="action-btn"
            @click="handleResend"
          >
            인증 메일 다시 받기
          </BaseButton>

          <button class="text-btn" @click="router.replace('/auth/login')">로그인 페이지로</button>
        </div>

        <!-- No token (직접 접근) -->
        <div v-else-if="state === 'no-token'" class="state-block" aria-live="polite">
          <div class="icon-wrap mail">
            <IonIcon :icon="mailOutline" aria-hidden="true" />
          </div>
          <p class="state-title">메일함을 확인해주세요</p>
          <p class="state-sub">가입하신 이메일로 인증 링크를 보냈어요.<br />링크를 눌러 인증을 완료해주세요.</p>

          <div class="resend-form">
            <label class="field-label" for="pending-email">이메일 재발송</label>
            <input
              id="pending-email"
              v-model="email"
              type="email"
              class="hola-input-native"
              placeholder="hello@climbing.kr"
              autocomplete="email"
            />
          </div>

          <BaseButton
            variant="primary"
            block
            :loading="isResending"
            class="action-btn"
            @click="handleResend"
          >
            인증 메일 다시 보내기
          </BaseButton>

          <button class="text-btn" @click="router.replace('/auth/login')">로그인 페이지로</button>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.verify-content {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  position: relative;
}

.glow {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.25;
  pointer-events: none;
}
.glow-lime {
  background: var(--hold-lime);
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
}

.state-block {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

/* AI 스타일 breathing dot */
.breathing-dot {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--hold-lime);
  animation: breathe 1.6s ease-in-out infinite;
  margin-bottom: 8px;
}
@keyframes breathe {
  0%, 100% { transform: scale(0.85); opacity: 0.6; }
  50%       { transform: scale(1.05); opacity: 1; }
}

.icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 32px;
  margin-bottom: 8px;
}
.icon-wrap.success {
  background: color-mix(in srgb, var(--hold-lime) 18%, transparent);
  color: var(--hold-lime);
}
.icon-wrap.failed {
  background: color-mix(in srgb, var(--hold-pink) 18%, transparent);
  color: var(--hold-pink);
}
.icon-wrap.mail {
  background: color-mix(in srgb, var(--hold-cyan) 18%, transparent);
  color: var(--hold-cyan);
}

.state-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.015em;
  margin: 0;
}
.state-sub {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  line-height: 1.6;
  margin: 0;
}

.resend-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  text-align: left;
}
.field-label {
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
}
.hola-input-native {
  width: 100%;
  height: 50px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-input);
  background: var(--surface);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--fg);
  box-sizing: border-box;
  outline: none;
  transition: border-color var(--dur-fast) var(--ease-state);
}
.hola-input-native:focus {
  border-color: var(--hold-lime);
}
.hola-input-native::placeholder {
  color: var(--fg-subtle);
}

.action-btn {
  width: 100%;
  margin-top: 4px;
}

.text-btn {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
  padding: 0;
  margin-top: 4px;
}
</style>
