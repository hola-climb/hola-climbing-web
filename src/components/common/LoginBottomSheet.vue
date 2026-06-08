<script setup lang="ts">
import { IonModal, IonButton, IonIcon } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'

defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()

function goLogin() {
  emit('close')
  router.push('/auth/login')
}

function goRegister() {
  emit('close')
  router.push('/auth/register')
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    :initial-breakpoint="0.45"
    :breakpoints="[0, 0.45]"
    @did-dismiss="emit('close')"
  >
    <div class="sheet-content">
      <button class="close-btn" @click="emit('close')" aria-label="닫기">
        <IonIcon :icon="closeOutline" />
      </button>

      <div class="title">로그인이 필요해요</div>
      <p class="desc">기록, 업로드, 마이 페이지는<br/>로그인 후 이용할 수 있어요.</p>

      <div class="actions">
        <IonButton expand="block" @click="goLogin" class="login-btn">
          로그인
        </IonButton>
        <IonButton expand="block" fill="outline" @click="goRegister" class="register-btn">
          회원가입
        </IonButton>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.sheet-content {
  padding: 24px 20px 40px;
  text-align: center;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: var(--surface-soft);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--fg-muted);
}

.title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin-top: 8px;
}

.desc {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  line-height: 1.5;
  margin-top: 8px;
  margin-bottom: 24px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.login-btn {
  --background: var(--hold-dark);
  --border-radius: var(--r-button);
  --box-shadow: none;
  height: 52px;
  font-weight: var(--w-bold);
}

.register-btn {
  --color: var(--fg);
  --border-color: var(--border);
  --border-radius: var(--r-button);
  height: 52px;
  font-weight: var(--w-bold);
}
</style>
