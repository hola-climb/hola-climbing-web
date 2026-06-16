<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IonPage, IonContent, IonIcon,
  IonButton, IonSpinner,
} from '@ionic/vue'
import {
  heartOutline, heart,
  shareOutline, chatbubbleOutline, refreshOutline, checkmarkCircle,
} from 'ionicons/icons'
import AppHeader from '@/components/common/AppHeader.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import { useRoute, useRouter } from 'vue-router'
import { useVideoStore } from '@/stores/video'
import { useUIStore } from '@/stores/ui'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { videoService } from '@/services/video'
import { gradeColor, gradeTextColor } from '@/utils/gradeColor'
import type { Comment } from '@/types/api'
import AIResultBadge from '@/components/video/AIResultBadge.vue'
import AIFeedbackModal from '@/components/video/AIFeedbackModal.vue'

const route = useRoute()
const router = useRouter()
const videoStore = useVideoStore()
const uiStore = useUIStore()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const videoId = route.params.id as string
const isLoading = ref(true)
const showFeedbackModal = ref(false)

const video = computed(() => videoStore.currentVideo)

const showAIResult = computed(() =>
  video.value?.status === 'done' && video.value.analysis,
)
const isAnalyzing = computed(() =>
  video.value?.status === 'analyzing' || video.value?.status === 'pending',
)
const analysisFailed = computed(() => video.value?.status === 'failed')

const ANALYSIS_STEPS = [
  { stage: 'started',          label: '분석 시작' },
  { stage: 'downloaded',       label: '영상 다운로드' },
  { stage: 'pose_estimation',  label: '포즈 추정' },
  { stage: 'classification',   label: '기술 분류' },
  { stage: 'completed',        label: '분석 완료' },
] as const

const STAGE_ORDER = ANALYSIS_STEPS.map((s) => s.stage)

function stepState(stage: string): 'done' | 'active' | 'pending' {
  const currentIdx = STAGE_ORDER.indexOf(videoStore.analysisStage as typeof STAGE_ORDER[number])
  const stepIdx = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number])
  if (currentIdx === -1) return 'pending'
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

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
  if ((e as KeyboardEvent)?.isComposing) return
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

async function retryAnalysis() {
  try {
    await videoStore.retryAnalysis(videoId)
    videoStore.pollAnalysis(videoId)
    uiStore.showToast('AI 분석을 다시 시작했어요.')
  } catch {
    uiStore.showToast('재시도에 실패했어요.', 'danger')
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
    if (isAnalyzing.value) {
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
</script>

<template>
  <IonPage>
    <AppHeader title="내 영상" />

    <IonContent>
      <div v-if="isLoading" class="page-skeleton page-padding">
        <LoadingState variant="card" :count="1" label="영상을 불러오는 중" />
        <LoadingState variant="list" :count="3" />
      </div>

      <div v-else-if="video" class="video-detail-layout">
        <!-- ── 영상 플레이어 ──────────────────────── -->
        <div class="video-pane">
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
                <span v-if="isAnalyzing" class="ai-dot" aria-hidden="true" />
                {{ isAnalyzing ? 'AI 분석 중...' : '영상 준비 중' }}
              </span>
            </div>
          </div>
        </div>

        <!-- ── 사이드바 ──────────────────────────── -->
        <div class="sidebar-pane">
          <div class="sidebar-scroll">
            <div class="detail-content page-padding">

              <!-- 제목 + 난이도 -->
              <div class="title-row">
                <h1 class="video-title">{{ video.title || '클라이밍 클립' }}</h1>
                <span
                  v-if="video.grade"
                  class="chip grade-chip"
                  :style="{ background: gradeColor(video.grade), color: gradeTextColor(gradeColor(video.grade)) }"
                >{{ video.grade }}</span>
              </div>

              <!-- 암장 + 조회수 -->
              <div class="meta-row">
                <template v-if="video.gym">{{ video.gym.name }} · </template>
                조회 {{ video.viewCount }}
              </div>

              <!-- ── AI 분석 결과 (항상 표시) ──── -->
              <!-- done: 결과 카드 -->
              <div v-if="showAIResult" class="ai-section hola-card">
                <div class="ai-header">
                  <span class="ai-label">AI 분석</span>
                </div>
                <AIResultBadge
                  :techniques="video.analysis!.techniques"
                  :problem-type="video.analysis!.problemType ?? null"
                  :is-dynamic="video.analysis!.isDynamic ?? null"
                />
                <button class="feedback-link" @click="showFeedbackModal = true">
                  AI 결과가 맞나요? 피드백 남기기
                </button>
              </div>

              <!-- analyzing / pending -->
              <div v-else-if="isAnalyzing" class="ai-section hola-card ai-pending">
                <div class="progress-header">
                  <div class="progress-label-row">
                    <span class="ai-dot" aria-hidden="true" />
                    <span class="analyzing-text">{{ videoStore.analysisProgressMessage || 'AI가 영상을 분석하고 있어요...' }}</span>
                  </div>
                  <span class="progress-pct">{{ videoStore.analysisProgress }}%</span>
                </div>
                <div class="progress-bar-wrap" role="progressbar" :aria-valuenow="videoStore.analysisProgress" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar-fill" :style="{ width: videoStore.analysisProgress + '%' }" />
                </div>
                <div class="analysis-steps">
                  <div
                    v-for="step in ANALYSIS_STEPS"
                    :key="step.stage"
                    class="analysis-step"
                    :class="stepState(step.stage)"
                  >
                    <div class="step-icon-wrap">
                      <IonIcon v-if="stepState(step.stage) === 'done'" :icon="checkmarkCircle" class="step-icon step-icon--done" aria-hidden="true" />
                      <span v-else class="step-dot" aria-hidden="true" />
                    </div>
                    <span class="step-label">{{ step.label }}</span>
                  </div>
                </div>
              </div>

              <!-- failed -->
              <div v-else-if="analysisFailed" class="ai-section hola-card ai-failed">
                <span class="fail-text">AI 분석에 실패했어요.</span>
                <button class="retry-btn" aria-label="분석 재시도" @click="retryAnalysis">
                  <IonIcon :icon="refreshOutline" />
                  재시도
                </button>
              </div>

              <!-- 액션 -->
              <div class="actions actions-divided">
                <button
                  class="action-btn"
                  :aria-label="video.isLiked ? '좋아요 취소' : '좋아요'"
                  @click="videoStore.toggleLike(videoId)"
                >
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

              <!-- 댓글 -->
              <section class="comments-section">
                <h2 class="comments-title">댓글 {{ commentCount }}</h2>

                <div v-if="commentsLoading" class="comments-loading">
                  <IonSpinner name="crescent" />
                </div>

                <p v-else-if="comments.length === 0" class="comments-empty">
                  첫 댓글을 남겨보세요.
                </p>

                <ul v-else class="comment-list">
                  <li v-for="c in comments" :key="c.id" class="comment-item">
                    <div class="c-avatar" aria-hidden="true">{{ c.user.nickname.charAt(0).toUpperCase() }}</div>
                    <div class="c-body">
                      <div class="c-head">
                        <span class="c-name">{{ c.user.nickname }}</span>
                        <span class="c-time">{{ formatTime(c.createdAt) }}</span>
                      </div>
                      <p class="c-content">{{ c.content }}</p>
                    </div>
                    <button class="c-del" aria-label="댓글 삭제" @click="deleteComment(c)">
                      삭제
                    </button>
                  </li>
                </ul>
              </section>
            </div>
          </div>

          <!-- 데스크탑 댓글 입력 -->
          <div v-if="isDesktop" class="comment-bar comment-bar--desktop">
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
        </div>
      </div>
    </IonContent>

    <!-- 모바일 댓글 입력 (fixed) -->
    <div v-if="video && !isDesktop" class="comment-bar">
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
      :is-dynamic="video.analysis.isDynamic ?? null"
      @close="showFeedbackModal = false"
    />
  </IonPage>
</template>

<style scoped>
.page-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

/* ── Desktop 2-pane ───────────────────────────────── */
@media (min-width: 1024px) {
  .video-detail-layout {
    display: flex;
    height: 100%;
    overflow: hidden;
  }
  .video-pane {
    width: 480px;
    flex-shrink: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .sidebar-pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid var(--border);
    overflow: hidden;
  }
  .sidebar-scroll { flex: 1; overflow-y: auto; }
  .sidebar-scroll .comments-section { padding-bottom: 24px; }
  .comment-bar--desktop {
    position: static;
    padding-bottom: 12px;
    flex-shrink: 0;
  }
  .video-pane .video-wrap {
    width: 100%;
    height: 100%;
    max-height: 100%;
    aspect-ratio: unset;
  }
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
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--fs-body);
}
.placeholder-text { display: flex; align-items: center; gap: 8px; }

.detail-content {
  padding-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 제목 */
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

.meta-row {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin-top: -8px;
}

/* ── AI 분석 섹션 ─────────────────────────────────── */
.ai-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ai-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}
.ai-pending { gap: 10px; }

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.progress-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.analyzing-text {
  font-size: var(--fs-caption);
  color: var(--fg);
  font-weight: 600;
}
.progress-pct {
  font-size: var(--fs-caption);
  font-weight: 700;
  color: var(--fg-muted);
  min-width: 36px;
  text-align: right;
}
.ai-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hold-lime);
  flex-shrink: 0;
  animation: blink 1.2s ease-in-out infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

.progress-bar-wrap {
  height: 3px;
  background: var(--border);
  border-radius: var(--r-chip);
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--hold-lime);
  border-radius: var(--r-chip);
  transition: width 0.5s ease;
}

.analysis-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 4px;
}
.analysis-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  position: relative;
}
.analysis-step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 9px;
  top: 26px;
  width: 1.5px;
  height: calc(100% - 6px);
  background: var(--border);
}
.analysis-step.done::after { background: var(--hold-lime); opacity: 0.4; }

.step-icon-wrap {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;
}
.step-icon {
  font-size: 18px;
  color: var(--hold-lime);
}
.step-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border);
  display: block;
  margin: auto;
}
.analysis-step.active .step-dot {
  background: var(--hold-lime);
  animation: blink 1.2s ease-in-out infinite;
}

.step-label {
  font-size: 12px;
  color: var(--fg-muted);
  font-weight: 500;
}
.analysis-step.done .step-label,
.analysis-step.active .step-label { color: var(--fg); }
.ai-failed {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.fail-text {
  flex: 1;
  font-size: var(--fs-caption);
  color: var(--hold-pink);
}
.retry-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--tint-pink);
  border: none;
  border-radius: var(--r-chip);
  padding: 6px 12px;
  color: var(--on-tint-pink);
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

/* 액션 */
.actions { display: flex; gap: 24px; align-items: center; }
.actions-divided {
  margin-top: 4px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}
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

/* ── 댓글 ─────────────────────────────────────────── */
.comments-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  padding-bottom: 96px;
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
.comment-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.comment-item { display: flex; gap: 10px; align-items: flex-start; }
.c-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--tint-cyan, #d6f6fb);
  color: var(--on-tint-cyan);
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
  font-size: var(--fs-body);
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

/* ── 댓글 입력바 (fixed) ──────────────────────────── */
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
  font-size: var(--fs-body);
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
  font-size: var(--fs-body);
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.comment-send:disabled { opacity: 0.4; cursor: default; }
.comment-send ion-spinner { width: 18px; height: 18px; --color: #fff; }
</style>
