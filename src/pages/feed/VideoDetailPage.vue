<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonIcon,
  IonButton, IonSpinner, IonAlert,
} from '@ionic/vue'
import {
  chevronBackOutline, heartOutline, heart,
  shareOutline, chatbubbleOutline, refreshOutline,
} from 'ionicons/icons'
import { useRoute, useRouter } from 'vue-router'
import { useVideoStore } from '@/stores/video'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { videoService } from '@/services/video'
import { gradeColor, gradeTextColor } from '@/utils/gradeColor'
import type { Comment } from '@/types/api'
import AIResultBadge from '@/components/video/AIResultBadge.vue'
import AIFeedbackModal from '@/components/video/AIFeedbackModal.vue'

const route = useRoute()
const router = useRouter()
const videoStore = useVideoStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

const videoId = route.params.id as string
const isLoading = ref(true)
const showFeedbackModal = ref(false)

const video = computed(() => videoStore.currentVideo)
const isOwner = computed(() =>
  authStore.user && video.value?.user.id === authStore.user.id,
)
const showAIResult = computed(() =>
  isOwner.value && video.value?.status === 'done' && video.value.analysis,
)

// ── Comments ───────────────────────────────────────
const comments = ref<Comment[]>([])
const commentsLoading = ref(false)
const commentInput = ref('')
const isPosting = ref(false)
const commentCount = computed(() => comments.value.length)

async function loadComments() {
  commentsLoading.value = true
  try {
    const { data } = await videoService.getComments(videoId, { page: 0, size: 50 })
    comments.value = data.content
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err)
  } finally {
    commentsLoading.value = false
  }
}

async function postComment(e?: KeyboardEvent | MouseEvent) {
  if ((e as KeyboardEvent)?.isComposing) return  // Korean IME: ignore mid-composition Enter
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  const content = commentInput.value.trim()
  if (!content || isPosting.value) return
  isPosting.value = true
  try {
    const { data } = await videoService.addComment(videoId, content)
    comments.value.push(data)
    commentInput.value = ''
    if (video.value) video.value.commentCount = comments.value.length
  } catch {
    uiStore.showToast('댓글 등록에 실패했어요.', 'danger')
  } finally {
    isPosting.value = false
  }
}

async function deleteComment(comment: Comment) {
  try {
    await videoService.deleteComment(comment.id)
    comments.value = comments.value.filter((c) => c.id !== comment.id)
    if (video.value) video.value.commentCount = comments.value.length
  } catch {
    uiStore.showToast('댓글 삭제에 실패했어요.', 'danger')
  }
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

onMounted(async () => {
  try {
    await videoStore.fetchVideo(videoId)
    if (video.value?.status === 'analyzing' || video.value?.status === 'pending') {
      videoStore.pollAnalysis(videoId)
    }
    loadComments()
  } catch {
    uiStore.showToast('영상을 불러올 수 없어요.', 'danger')
    router.back()
  } finally {
    isLoading.value = false
  }
})

async function handleLike() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  await videoStore.toggleLike(videoId)
}

async function retryAnalysis() {
  try {
    await videoStore.retryAnalysis(videoId)
    videoStore.pollAnalysis(videoId)
    uiStore.showToast('AI 분석을 다시 시작했어요.')
  } catch {
    uiStore.showToast('재시도에 실패했어요.', 'danger')
  }
}
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <button class="back-btn" @click="router.back()" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <span class="toolbar-title">영상</span>
          <div />
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="isLoading" class="loading-center">
        <IonSpinner name="dots" />
      </div>

      <template v-else-if="video">
        <!-- Video player area -->
        <div class="video-wrap">
          <video
            v-if="video.streamingUrl"
            :src="video.streamingUrl"
            controls
            playsinline
            class="video-player"
            :aria-label="`${video.user.nickname}의 클라이밍 영상`"
          />
          <div v-else class="video-placeholder">
            <span class="placeholder-text">
              <span v-if="video.status === 'analyzing'" class="ai-dot" />
              {{ video.status === 'analyzing' ? 'AI 분석 중...' : '영상 준비 중' }}
            </span>
          </div>
        </div>

        <!-- Content -->
        <div class="detail-content page-padding">
          <!-- Title + grade -->
          <div class="title-row">
            <h1 class="video-title">{{ video.title || '클라이밍 클립' }}</h1>
            <span v-if="video.grade" class="chip grade-chip" :style="{ background: gradeColor(video.grade), color: gradeTextColor(gradeColor(video.grade)) }">{{ video.grade }}</span>
          </div>

          <!-- Author row -->
          <div class="author-row">
            <div class="avatar" :aria-label="video.user.nickname">
              {{ video.user.nickname.charAt(0).toUpperCase() }}
            </div>
            <div class="author-meta">
              <div class="author-name">{{ video.user.nickname }}</div>
              <div class="sub-line">
                <template v-if="video.gym">{{ video.gym.name }} · </template>조회 {{ video.viewCount }}
              </div>
            </div>
          </div>

          <!-- AI Analysis (owner only) -->
          <div v-if="showAIResult" class="ai-section hola-card">
            <AIResultBadge
              :techniques="video.analysis!.techniques"
              :problem-type="video.analysis!.problemType ?? null"
            />
            <button class="feedback-link" @click="showFeedbackModal = true">
              AI 결과가 맞나요? 피드백 남기기
            </button>
          </div>

          <!-- Analyzing state (owner only) -->
          <div v-else-if="isOwner && video.status === 'analyzing'" class="ai-section hola-card ai-pending">
            <span class="ai-dot" />
            <span class="analyzing-text">AI가 영상을 분석하고 있어요...</span>
          </div>

          <!-- Analysis failed (owner only) -->
          <div v-else-if="isOwner && video.status === 'failed'" class="ai-section hola-card ai-failed">
            <span class="fail-text">AI 분석에 실패했어요.</span>
            <button class="retry-btn" @click="retryAnalysis" aria-label="분석 재시도">
              <IonIcon :icon="refreshOutline" />
              재시도
            </button>
          </div>

          <!-- Actions -->
          <div class="actions actions-divided">
            <button class="action-btn" @click="handleLike" :aria-label="video.isLiked ? '좋아요 취소' : '좋아요'">
              <IonIcon :icon="video.isLiked ? heart : heartOutline" :class="{ liked: video.isLiked }" />
              <span>{{ video.likeCount }}</span>
            </button>
            <button class="action-btn" aria-label="댓글">
              <IonIcon :icon="chatbubbleOutline" />
              <span>{{ commentCount }}</span>
            </button>
            <button class="action-btn" aria-label="공유">
              <IonIcon :icon="shareOutline" />
            </button>
          </div>

          <!-- Comments -->
          <section class="comments-section">
            <h2 class="comments-title">댓글 {{ commentCount }}</h2>

            <div v-if="commentsLoading" class="comments-loading">
              <IonSpinner name="dots" />
            </div>

            <p v-else-if="comments.length === 0" class="comments-empty">
              첫 댓글을 남겨보세요.
            </p>

            <ul v-else class="comment-list">
              <li v-for="c in comments" :key="c.id" class="comment-item">
                <div class="c-avatar" :aria-hidden="true">{{ c.user.nickname.charAt(0).toUpperCase() }}</div>
                <div class="c-body">
                  <div class="c-head">
                    <span class="c-name">{{ c.user.nickname }}</span>
                    <span class="c-time">{{ formatTime(c.createdAt) }}</span>
                  </div>
                  <p class="c-content">{{ c.content }}</p>
                </div>
                <button
                  v-if="authStore.user && c.user.id === authStore.user.id"
                  class="c-del"
                  aria-label="댓글 삭제"
                  @click="deleteComment(c)"
                >
                  삭제
                </button>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </IonContent>

    <!-- Comment input bar -->
    <div v-if="video" class="comment-bar">
      <input
        v-model="commentInput"
        class="comment-input"
        type="text"
        placeholder="댓글을 입력하세요"
        :disabled="isPosting"
        aria-label="댓글 입력"
        @keydown.enter="postComment($event)"
      />
      <button
        class="comment-send"
        :disabled="!commentInput.trim() || isPosting"
        aria-label="댓글 등록"
        @click="postComment"
      >
        <IonSpinner v-if="isPosting" name="crescent" />
        <span v-else>등록</span>
      </button>
    </div>

    <AIFeedbackModal
      v-if="showFeedbackModal && video?.analysis"
      :is-open="showFeedbackModal"
      :video-id="videoId"
      :techniques="video.analysis.techniques"
      @close="showFeedbackModal = false"
    />
  </IonPage>
</template>

<style scoped>
.toolbar-inner {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  padding: 0 12px;
  height: 52px;
}
.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  font-size: 24px;
  display: grid;
  place-items: center;
}
.toolbar-title {
  text-align: center;
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}

.loading-center {
  display: grid;
  place-items: center;
  height: 60vh;
}

.video-wrap {
  width: 100%;
  aspect-ratio: 9 / 16;
  max-height: 78vh;
  background: #000;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.video-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: rgba(255,255,255,0.6);
  font-size: var(--fs-body);
}
.placeholder-text { display: flex; align-items: center; gap: 8px; }

.detail-content { padding-top: 18px; display: flex; flex-direction: column; gap: 16px; }

/* Title */
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.video-title {
  flex: 1;
  min-width: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 0;
}
.grade-chip { flex-shrink: 0; margin-top: 2px; }

.author-row { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--tint-cyan);
  color: #066a78;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
}
.author-meta { min-width: 0; }
.author-name { font-size: var(--fs-body); font-weight: var(--w-semibold); }
.sub-line {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-section { display: flex; flex-direction: column; gap: 12px; }
.ai-pending { flex-direction: row; align-items: center; gap: 10px; color: var(--fg-muted); }
.analyzing-text { font-size: var(--fs-caption); }
.ai-failed { flex-direction: row; align-items: center; gap: 10px; }
.fail-text { flex: 1; font-size: var(--fs-caption); color: var(--hold-pink); }
.retry-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--tint-pink);
  border: none;
  border-radius: var(--r-chip);
  padding: 6px 12px;
  color: #C7286A;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.feedback-link {
  background: none;
  border: none;
  color: var(--hold-cyan);
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  cursor: pointer;
  text-align: left;
  padding: 0;
}

.actions { display: flex; gap: 24px; align-items: center; }
.actions-divided {
  margin-top: 4px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

/* ── Comments ───────────────────────────────────── */
.comments-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  padding-bottom: 96px; /* clear fixed input bar */
}
.comments-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0 0 16px;
}
.comments-loading { display: grid; place-items: center; padding: 24px; }
.comments-empty {
  font-size: 13px;
  color: var(--fg-muted);
  text-align: center;
  padding: 20px 0;
  margin: 0;
}
.comment-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
.comment-item { display: flex; gap: 10px; align-items: flex-start; }
.c-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--tint-cyan, #d6f6fb);
  color: #066a78;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.c-body { flex: 1; min-width: 0; }
.c-head { display: flex; align-items: baseline; gap: 8px; }
.c-name { font-size: 13px; font-weight: 700; }
.c-time { font-size: 11px; color: var(--fg-muted); }
.c-content {
  font-size: 14px;
  line-height: 1.45;
  margin: 3px 0 0;
  word-break: break-word;
}
.c-del {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 2px 4px;
}

/* ── Comment input bar (fixed) ──────────────────── */
.comment-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
  z-index: 10;
}
.comment-input {
  flex: 1;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: var(--r-input, 14px);
  background: var(--surface-soft);
  padding: 0 14px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--fg);
  outline: none;
}
.comment-input:focus { border-color: var(--fg); }
.comment-send {
  height: 42px;
  min-width: 56px;
  padding: 0 14px;
  border: none;
  border-radius: var(--r-button, 14px);
  background: var(--hold-dark, #151515);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.comment-send:disabled { opacity: 0.4; cursor: default; }
.comment-send ion-spinner { width: 18px; height: 18px; --color: #fff; }
.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--fs-body);
  color: var(--fg-muted);
}
.action-btn ion-icon { font-size: 22px; }
.liked { color: var(--hold-pink); }
.saved { color: var(--fg); }
</style>
