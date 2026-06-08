<script setup lang="ts">
import { ref } from 'vue'
import { IonModal, IonButton, IonIcon } from '@ionic/vue'
import { closeOutline, checkmarkOutline, closeCircleOutline } from 'ionicons/icons'
import type { TechniqueTag } from '@/types/api'
import { getTagLabel } from '@/utils/tagLabels'
import { useVideoStore } from '@/stores/video'
import { useUIStore } from '@/stores/ui'

const props = defineProps<{
  isOpen: boolean
  videoId: string
  techniques: TechniqueTag[]
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const videoStore = useVideoStore()
const uiStore = useUIStore()
const submitting = ref<string | null>(null)

async function submitFeedback(tag: TechniqueTag, feedback: 'correct' | 'incorrect') {
  if (submitting.value) return
  submitting.value = tag.key
  try {
    await videoStore.submitFeedback(props.videoId, tag.key, feedback === 'correct')
    uiStore.showToast('피드백 감사해요!', 'success')
  } catch {
    uiStore.showToast('피드백 처리에 실패했어요.', 'danger')
  } finally {
    submitting.value = null
  }
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    @did-dismiss="emit('close')"
  >
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">AI 분석 피드백</span>
        <button class="close-btn" @click="emit('close')" aria-label="닫기">
          <IonIcon :icon="closeOutline" />
        </button>
      </div>

      <p class="modal-desc">
        AI가 인식한 기술이 맞는지 알려주세요.<br/>
        피드백은 AI 개선에 사용됩니다.
      </p>

      <div class="tag-list">
        <div v-for="tag in techniques" :key="tag.key" class="tag-row">
          <span class="tag-label">{{ getTagLabel(tag.key) }}</span>
          <span class="confidence">{{ Math.round(tag.confidence * 100) }}%</span>

          <div class="feedback-btns">
            <button
              class="fb-btn"
              :class="{ active: tag.userFeedback === 'correct', loading: submitting === tag.key }"
              @click="submitFeedback(tag, 'correct')"
              aria-label="맞아요"
            >
              <IonIcon :icon="checkmarkOutline" />
              맞아요
            </button>
            <button
              class="fb-btn wrong"
              :class="{ active: tag.userFeedback === 'incorrect', loading: submitting === tag.key }"
              @click="submitFeedback(tag, 'incorrect')"
              aria-label="틀렸어요"
            >
              <IonIcon :icon="closeCircleOutline" />
              틀렸어요
            </button>
          </div>
        </div>

        <p v-if="!techniques.length" class="empty">감지된 기술이 없어요.</p>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.modal-content { padding: 20px 20px 40px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.modal-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-extrabold);
}
.close-btn {
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

.modal-desc {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  line-height: 1.5;
  margin-bottom: 20px;
}

.tag-list { display: flex; flex-direction: column; gap: 12px; }

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
}

.tag-label {
  flex: 1;
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
}
.confidence {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  min-width: 36px;
  text-align: right;
}

.feedback-btns { display: flex; gap: 6px; }

.fb-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--r-chip);
  border: 1px solid var(--border);
  background: var(--surface-soft);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-state);
  color: var(--fg-muted);
}
.fb-btn.active { background: var(--tint-lime); border-color: var(--hold-lime); color: #4a6a00; }
.fb-btn.wrong.active { background: var(--tint-pink); border-color: var(--hold-pink); color: #C7286A; }
.fb-btn.loading { opacity: 0.6; pointer-events: none; }

.empty { text-align: center; color: var(--fg-muted); font-size: var(--fs-caption); padding: 20px 0; }
</style>
