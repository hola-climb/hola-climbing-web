<script setup lang="ts">
import { ref } from 'vue'
import {
  IonPage, IonContent, IonIcon, IonButton, IonInput, IonSpinner,
} from '@ionic/vue'
import { eyeOutline, eyeOffOutline } from 'ionicons/icons'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

const email = ref('')
const password = ref('')
const showPw = ref(false)
const isLoading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    uiStore.showToast('이메일과 비밀번호를 입력해주세요.', 'warning')
    return
  }

  isLoading.value = true
  try {
    await authStore.login(email.value.trim(), password.value)
    const redirect = (route.query.redirect as string) || '/feed'
    router.replace(redirect)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    uiStore.showToast(msg ?? '로그인에 실패했어요.', 'danger')
  } finally {
    isLoading.value = false
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
            <IonInput
              id="login-email"
              v-model="email"
              type="email"
              placeholder="hello@climbing.kr"
              class="hola-input"
              autocomplete="email"
              @keydown.enter="handleLogin"
            />
          </div>

          <div class="field">
            <label class="field-label" for="login-pw">비밀번호</label>
            <div class="pw-wrap">
              <IonInput
                id="login-pw"
                v-model="password"
                :type="showPw ? 'text' : 'password'"
                placeholder="••••••••"
                class="hola-input"
                autocomplete="current-password"
                @keydown.enter="handleLogin"
              />
              <button class="pw-toggle" @click="showPw = !showPw" :aria-label="showPw ? '비밀번호 숨기기' : '비밀번호 보기'">
                <IonIcon :icon="showPw ? eyeOffOutline : eyeOutline" />
              </button>
            </div>
          </div>

          <button class="forgot-link" @click="router.push('/auth/password-reset')">
            비밀번호를 잊으셨나요?
          </button>

          <IonButton expand="block" :disabled="isLoading" @click="handleLogin" class="submit-btn">
            <IonSpinner v-if="isLoading" name="dots" slot="start" />
            {{ isLoading ? '로그인 중...' : '로그인' }}
          </IonButton>

          <!-- Social login -->
          <div class="divider"><span>또는</span></div>

          <div class="social-btns">
            <button class="social-btn kakao" aria-label="카카오로 로그인">
              카카오로 시작하기
            </button>
            <button class="social-btn google" aria-label="구글로 로그인">
              Google로 시작하기
            </button>
            <button class="social-btn naver" aria-label="네이버로 로그인">
              네이버로 시작하기
            </button>
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
.glow-lime { background: var(--hold-lime); top: -60px; left: 50%; transform: translateX(-50%); }
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

.auth-form { display: flex; flex-direction: column; gap: 16px; }

.field { display: flex; flex-direction: column; gap: 6px; }
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

.pw-wrap { position: relative; }
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
  --background: var(--hold-dark);
  --border-radius: var(--r-button);
  --box-shadow: none;
  height: 52px;
  font-weight: var(--w-bold);
  margin-top: 4px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fg-muted);
  font-size: var(--fs-caption);
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.social-btns { display: flex; flex-direction: column; gap: 10px; }
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
.social-btn:active { opacity: 0.7; }
.social-btn.kakao { background: #FEE500; border-color: #FEE500; color: #3A1D1D; }
.social-btn.naver { background: #03C75A; border-color: #03C75A; color: #fff; }
.social-btn.google { background: #fff; }

.auth-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 32px 0 40px;
  margin-top: auto;
}
.footer-text { font-size: var(--fs-caption); color: var(--fg-muted); }
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
