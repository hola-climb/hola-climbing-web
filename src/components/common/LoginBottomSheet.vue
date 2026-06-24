<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import BaseSheet from '@/components/common/BaseSheet.vue'
import BaseButton from '@/components/common/BaseButton.vue'

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
  <BaseSheet :open="isOpen" :grabber="false" @close="emit('close')">
    <div class="sheet-content">
      <button class="sheet-close close-btn" @click="emit('close')" aria-label="닫기">
        <IonIcon :icon="closeOutline" />
      </button>

      <div class="title">로그인이 필요해요</div>
      <p class="desc">기록, 업로드, 마이 페이지는<br/>로그인 후 이용할 수 있어요.</p>

      <div class="actions">
        <BaseButton variant="primary" block @click="goLogin">로그인</BaseButton>
        <BaseButton variant="secondary" block @click="goRegister">회원가입</BaseButton>
      </div>
    </div>
  </BaseSheet>
</template>

<style scoped>
.sheet-content {
  padding: 16px 0;
  text-align: center;
  position: relative;
}

/* positioning only — visual styling comes from global .sheet-close */
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
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
</style>
