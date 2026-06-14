<script setup lang="ts">
import { ref } from 'vue'
import { IonPage, IonContent, IonButton, IonInput, IonSpinner, IonIcon } from '@ionic/vue'
import { chevronBackOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { authService } from '@/services/auth'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const uiStore = useUIStore()

const email = ref('')
const isLoading = ref(false)
const isSent = ref(false)

async function handleSend() {
  if (!email.value) {
    uiStore.showToast('이메일을 입력해주세요.', 'warning')
    return
  }

  isLoading.value = true
  try {
    await authService.sendPasswordReset(email.value.trim())
    isSent.value = true
  } catch {
    uiStore.showToast('이메일 발송에 실패했어요. 등록된 이메일인지 확인해주세요.', 'danger')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="auth-content">
        <div class="auth-header">
          <button class="back-btn" @click="router.back()" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <h1 class="auth-title">비밀번호 재설정</h1>
          <p class="auth-subtitle">등록한 이메일로 인증 코드를 보내드려요.</p>
        </div>

        <div v-if="!isSent" class="auth-form">
          <div class="field">
            <label class="field-label" for="reset-email">이메일</label>
            <IonInput
              id="reset-email"
              v-model="email"
              type="email"
              placeholder="hello@climbing.kr"
              class="hola-input"
              @keydown.enter="handleSend"
            />
          </div>

          <IonButton expand="block" :disabled="isLoading || !email" @click="handleSend" class="submit-btn">
            <IonSpinner v-if="isLoading" name="crescent" slot="start" />
            {{ isLoading ? '발송 중...' : '인증 코드 받기' }}
          </IonButton>
        </div>

        <div v-else class="sent-state">
          <div class="sent-icon" aria-hidden="true">✉️</div>
          <p class="sent-title">이메일을 확인해주세요</p>
          <p class="sent-desc">{{ email }}으로<br/>재설정 링크를 발송했어요.</p>
          <button class="resend-link" @click="isSent = false">다른 이메일로 받기</button>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.auth-content { min-height: 100vh; display: flex; flex-direction: column; padding: 0 20px; }
.auth-header { padding-top: 60px; padding-bottom: 32px; }
.back-btn {
  background: none; border: none; cursor: pointer; color: var(--fg);
  font-size: 24px; display: grid; place-items: center; margin-bottom: 20px; padding: 0;
}
.auth-title { font-size: var(--fs-h1); font-weight: var(--w-extrabold); letter-spacing: -0.015em; margin: 0 0 8px; }
.auth-subtitle { font-size: var(--fs-body); color: var(--fg-muted); margin: 0; }
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: var(--fs-caption); font-weight: var(--w-semibold);
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted);
}
.hola-input {
  --background: var(--surface); --border-radius: var(--r-input); --padding-start: 14px;
  border: 1px solid var(--border); border-radius: var(--r-input); background: var(--surface); height: 50px;
}
.submit-btn { --background: var(--hold-dark); --border-radius: var(--r-button); --box-shadow: none; height: 52px; font-weight: var(--w-bold); }

.sent-state { text-align: center; padding: 60px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.sent-icon { font-size: 56px; }
.sent-title { font-size: var(--fs-h2); font-weight: var(--w-extrabold); margin: 0; }
.sent-desc { font-size: var(--fs-body); color: var(--fg-muted); line-height: 1.5; margin: 0; }
.resend-link { background: none; border: none; color: var(--fg-muted); font-size: var(--fs-caption); font-weight: var(--w-semibold); cursor: pointer; text-decoration: underline; }
</style>
