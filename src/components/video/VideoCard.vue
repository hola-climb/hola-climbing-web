<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { heartOutline, heart, chatbubbleOutline } from 'ionicons/icons'
import type { Video } from '@/types/api'
import { useVideoStore } from '@/stores/video'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useRouter } from 'vue-router'
import { gradeColor, gradeTextColor } from '@/utils/gradeColor'

const props = defineProps<{ video: Video }>()

const videoStore = useVideoStore()
const authStore = useAuthStore()
const uiStore = useUIStore()
const router = useRouter()

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    pending: '업로드 중',
    analyzing: 'AI 분석 중',
    failed: '분석 실패',
  }
  return map[props.video.status] ?? ''
})

async function handleLike() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  try {
    await videoStore.toggleLike(props.video.id)
  } catch {
    uiStore.showToast('좋아요 처리 중 오류가 발생했어요.', 'danger')
  }
}

function openDetail() {
  router.push(`/videos/${props.video.id}`)
}
</script>

<template>
  <div class="video-card" @click="openDetail">
    <!-- Thumbnail -->
    <div class="thumbnail-wrap">
      <img
        v-if="video.thumbnailUrl"
        :src="video.thumbnailUrl"
        :alt="`${video.user.nickname}의 클라이밍 영상`"
        class="thumbnail"
        loading="lazy"
      />
      <div v-else class="thumbnail-placeholder" aria-hidden="true" />

      <!-- Status badge (only shown for non-done states) -->
      <div v-if="video.status !== 'done'" class="status-badge" :class="`status-${video.status}`">
        <span v-if="video.status === 'analyzing'" class="ai-dot" />
        <span>{{ statusLabel }}</span>
      </div>
    </div>

    <!-- Meta -->
    <div class="meta">
      <div class="author-row">
        <div class="avatar" :aria-label="video.user.nickname">
          {{ video.user.nickname.charAt(0).toUpperCase() }}
        </div>
        <div class="author-info">
          <span class="author-name">{{ video.user.nickname }}</span>
          <span class="gym-name" v-if="video.gym">· {{ video.gym.name }}</span>
        </div>
        <span v-if="video.grade" class="chip" :style="{ background: gradeColor(video.grade), color: gradeTextColor(gradeColor(video.grade)) }">{{ video.grade }}</span>
      </div>

      <!-- Actions -->
      <div class="actions" @click.stop>
        <button class="action-btn" @click="handleLike" :aria-label="video.isLiked ? '좋아요 취소' : '좋아요'">
          <IonIcon :icon="video.isLiked ? heart : heartOutline" :class="{ liked: video.isLiked }" />
          <span>{{ video.likeCount }}</span>
        </button>
        <button class="action-btn" @click="openDetail" aria-label="댓글 보기">
          <IonIcon :icon="chatbubbleOutline" />
          <span>{{ video.commentCount }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-state);
}
.video-card:active { transform: scale(0.98); }

.thumbnail-wrap {
  position: relative;
  aspect-ratio: 9/16;
  background: var(--surface-soft);
  overflow: hidden;
}
.thumbnail { width: 100%; height: 100%; object-fit: cover; }
.thumbnail-placeholder { width: 100%; height: 100%; background: var(--surface-soft); }

.status-badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-chip);
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  background: rgba(247,247,245,0.85);
  color: var(--fg);
}
.status-failed { color: var(--hold-pink); }

.meta { padding: 12px 14px; }

.author-row { display: flex; align-items: center; gap: 8px; }
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--tint-cyan);
  color: #066a78;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.author-info { flex: 1; font-size: var(--fs-caption); min-width: 0; overflow: hidden; }
.author-name { font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.gym-name { color: var(--fg-muted); margin-left: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

.actions { display: flex; align-items: center; gap: 16px; margin-top: 10px; }
.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--fs-caption);
  color: var(--fg-muted);
}
.action-btn ion-icon { font-size: 18px; }
.liked { color: var(--hold-pink); }
</style>
