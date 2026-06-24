<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { IonPage, IonContent, IonIcon, IonSpinner, useIonRouter } from "@ionic/vue";
import BaseSheet from "@/components/common/BaseSheet.vue";
import { heartOutline, heart, shareOutline, chatbubbleOutline, refreshOutline, ellipsisVertical, createOutline, trashOutline, flagOutline } from "ionicons/icons";
import AppHeader from "@/components/common/AppHeader.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import AIResultBadge from "@/components/video/AIResultBadge.vue";
import AIFeedbackModal from "@/components/video/AIFeedbackModal.vue";
import AnalysisLoader from "@/components/video/AnalysisLoader.vue";
import VideoPlayer from "@/components/video/VideoPlayer.vue";
import VideoEditModal from "@/components/video/VideoEditModal.vue";
import ReportModal from "@/components/common/ReportModal.vue";
import ExpandableText from "@/components/common/ExpandableText.vue";
import { useRoute, useRouter } from "vue-router";
import { useVideoStore } from "@/stores/video";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { videoService } from "@/services/video";
import { gradeColor, gradeTextColor } from "@/utils/gradeColor";
import type { Comment, ReportTargetType } from "@/types/api";
import { useShare } from "@/composables/useShare";
import UserAvatar from "@/components/common/UserAvatar.vue";

const route = useRoute();
const router = useRouter();
const ionRouter = useIonRouter();
const videoStore = useVideoStore();
const authStore = useAuthStore();
const uiStore = useUIStore();
const isDesktop = useMediaQuery("(min-width: 1024px)");

const videoId = route.params.id as string;
const isLoading = ref(true);
const showFeedbackModal = ref(false);
const showActionSheet = ref(false);
const showDeleteDialog = ref(false);
const showEditModal = ref(false);
const isDeleting = ref(false);

// 비소유자 더보기 액션시트
const showMoreSheet = ref(false);

// 신고
const showReportModal = ref(false);
const reportTarget = ref<{ type: ReportTargetType; id: string } | null>(null);

function openReport(type: ReportTargetType, id: string) {
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  reportTarget.value = { type, id };
  showReportModal.value = true;
  showActionSheet.value = false;
}

const video = computed(() => videoStore.currentVideo);
const isOwner = computed(() => authStore.user && video.value?.user.id === authStore.user.id);
const isAnalyzing = computed(() => video.value?.status === "analyzing" || video.value?.status === "pending");
const analysisFailed = computed(() => video.value?.status === "failed");

// 분석 진행 상태 — store가 videoId별로 백그라운드 추적
const analysisProgress = computed(() => videoStore.getAnalysisProgress(videoId));

// 아웃트로: 분석이 화면에서 done 되면 로더의 완료 애니메이션이 끝날 때까지 결과 카드 전환을 미룬다.
const playingOutro = ref(false);
watch(
  () => video.value?.status,
  (s, prev) => {
    if (s === "done" && (prev === "analyzing" || prev === "pending")) {
      playingOutro.value = true;
    }
  },
);
function onAnalysisComplete() {
  playingOutro.value = false;
}

const showLoader = computed(() => isOwner.value && (isAnalyzing.value || playingOutro.value));
const showAIResult = computed(() => isOwner.value && !playingOutro.value && video.value?.status === "done" && video.value.analysis);

function leaveAnalysis() {
  router.push(isOwner.value ? "/my/videos" : "/feed");
}

function openProfile(userId: string | undefined) {
  if (userId) router.push(`/users/${userId}`);
}

// ── Comments ──────────────────────────────────────────
const comments = ref<Comment[]>([]);
const commentsLoading = ref(false);
const commentInput = ref("");
const isPosting = ref(false);
const commentCount = computed(() => comments.value.length);

const editingCommentId = ref<string | null>(null);
const editInput = ref("");
const isUpdating = ref(false);

function startEdit(c: Comment) {
  editingCommentId.value = c.id;
  editInput.value = c.content;
}

function cancelEdit() {
  editingCommentId.value = null;
  editInput.value = "";
}

async function submitEdit(commentId: string) {
  const content = editInput.value.trim();
  if (!content || isUpdating.value) return;
  isUpdating.value = true;
  try {
    await videoService.updateComment(commentId, content);
    const target = comments.value.find((c) => c.id === commentId);
    if (target) target.content = content;
    cancelEdit();
  } catch {
    uiStore.showToast("댓글 수정에 실패했어요.", "danger");
  } finally {
    isUpdating.value = false;
  }
}

async function loadComments() {
  commentsLoading.value = true;
  try {
    const { data } = await videoService.getComments(videoId, { page: 0, size: 50 });
    comments.value = data.content;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
  } finally {
    commentsLoading.value = false;
  }
}

async function postComment(e?: KeyboardEvent | MouseEvent) {
  if ((e as KeyboardEvent)?.isComposing) return;
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  const content = commentInput.value.trim();
  if (!content || isPosting.value) return;
  isPosting.value = true;
  try {
    const { data } = await videoService.addComment(videoId, content);
    comments.value.push(data);
    commentInput.value = "";
    if (video.value) video.value.commentCount = comments.value.length;
  } catch {
    uiStore.showToast("댓글 등록에 실패했어요.", "danger");
  } finally {
    isPosting.value = false;
  }
}

async function deleteComment(comment: Comment) {
  try {
    await videoService.deleteComment(comment.id);
    comments.value = comments.value.filter((c) => c.id !== comment.id);
    if (video.value) video.value.commentCount = comments.value.length;
  } catch {
    uiStore.showToast("댓글 삭제에 실패했어요.", "danger");
  }
}

async function handleLike() {
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  await videoStore.toggleLike(videoId);
}

// 공유
const { copyShareLink } = useShare();
async function handleShare() {
  try {
    await copyShareLink(videoId);
    uiStore.showToast("링크 복사 완료! 영상을 공유해 보세요.");
  } catch {
    uiStore.showToast("복사에 실패했어요.");
  }
}

async function retryAnalysis() {
  try {
    await videoStore.retryAnalysis(videoId);
    videoStore.watchAnalysis(videoId);
    uiStore.showToast("AI 분석을 다시 시작했어요.");
  } catch {
    uiStore.showToast("재시도에 실패했어요.", "danger");
  }
}

async function onEditSave(payload: import("@/types/api").UpdateVideoPayload) {
  try {
    await videoStore.updateVideo(videoId, payload);
    showEditModal.value = false;
    uiStore.showToast("영상 정보를 수정했어요.");
  } catch (err) {
    if (import.meta.env.DEV) console.error("[onEditSave]", err);
    uiStore.showToast("수정에 실패했어요.", "danger");
  }
}

async function onDeleteConfirm() {
  if (isDeleting.value) return;
  isDeleting.value = true;
  try {
    await videoStore.deleteVideo(videoId);
    uiStore.showToast("영상을 삭제했어요.");
    // 탭 레이아웃 복귀 — Ionic 라우터로 스택을 'root'로 리셋 (탭이 죽지 않도록).
    ionRouter.navigate("/my", "root", "replace");
  } catch {
    uiStore.showToast("삭제에 실패했어요.", "danger");
  } finally {
    isDeleting.value = false;
  }
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

onMounted(async () => {
  try {
    await videoStore.fetchVideo(videoId);
    if (isAnalyzing.value) {
      // 워처는 store에 살아 화면을 나가도 백그라운드로 계속 추적·완료 알림.
      // onUnmounted에서 중단하지 않는다 (멱등 — 재진입 시 중복 방지).
      videoStore.watchAnalysis(videoId);
    }
    loadComments();
  } catch {
    uiStore.showToast("영상을 불러올 수 없어요.", "danger");
    router.back();
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <IonPage>
    <AppHeader :title="isOwner ? '내 영상' : '영상'">
      <template #action>
        <button v-if="isOwner" class="more-btn" aria-label="더보기" @click="showActionSheet = true">
          <IonIcon :icon="ellipsisVertical" />
        </button>
        <button v-else-if="video" class="more-btn" aria-label="더보기" @click="showMoreSheet = true">
          <IonIcon :icon="ellipsisVertical" />
        </button>
      </template>
    </AppHeader>

    <IonContent>
      <div v-if="isLoading" class="page-skeleton page-padding">
        <LoadingState variant="card" :count="1" label="영상을 불러오는 중" />
        <LoadingState variant="list" :count="3" />
      </div>

      <div v-else-if="video" class="video-detail-layout reveal-on-load">
        <!-- ── 영상 플레이어 ───────────────────────── -->
        <div class="video-pane">
          <div class="video-wrap">
            <VideoPlayer v-if="video.streamingUrl" :src="video.streamingUrl" :poster="video.thumbnailUrl ?? undefined" :ariaLabel="`${video.user.nickname}의 클라이밍 영상`" />
            <div v-else class="video-placeholder">
              <span class="placeholder-text">
                <span v-if="isAnalyzing" class="ai-dot" aria-hidden="true" />
                {{ isAnalyzing ? "AI 분석 중..." : "영상 준비 중" }}
              </span>
            </div>
          </div>
        </div>

        <!-- ── 사이드바 ───────────────────────────── -->
        <div class="sidebar-pane">
          <div class="sidebar-scroll">
            <div class="detail-content page-padding">
              <!-- 제목 + 난이도 -->
              <div class="title-row">
                <h1 class="video-title">{{ video.title || "클라이밍 클립" }}</h1>
                <span v-if="video.grade" class="chip grade-chip" :style="{ background: gradeColor(video.grade), color: gradeTextColor(gradeColor(video.grade)) }">{{ video.grade }}</span>
              </div>

              <!-- 작성자 (남의 영상일 때만) -->
              <div v-if="!isOwner" class="author-row">
                <button class="author-link" :aria-label="`${video.user.nickname} 프로필 보기`" @click="openProfile(video.user.id)">
                  <div class="avatar" aria-hidden="true">
                    <UserAvatar :src="video.user.profileImage" :nickname="video.user.nickname" />
                  </div>
                  <div class="author-meta">
                    <div class="author-name">{{ video.user.nickname }}</div>
                    <div class="sub-line">
                      <template v-if="video.gym">{{ video.gym.name }} ·</template>
                      {{ video.createdAt.slice(0, 10) }} · 조회 {{ video.viewCount }}
                    </div>
                  </div>
                </button>
              </div>

              <!-- 암장 + 조회수 (내 영상일 때) -->
              <div v-else class="meta-row">
                <template v-if="video.gym">{{ video.gym.name }} ·</template>
                조회 {{ video.viewCount }}
              </div>

              <!-- ── AI 분석 (내 영상 전용) ─────────── -->
              <!-- done: 결과 카드 -->
              <div v-if="showAIResult" class="ai-section hola-card">
                <div class="ai-header">
                  <span class="ai-label">AI 분석</span>
                  <button class="retry-btn retry-btn--sm" aria-label="분석 재시도" @click="retryAnalysis">
                    <IonIcon :icon="refreshOutline" />
                    재시도
                  </button>
                </div>
                <AIResultBadge :techniques="video.analysis!.techniques" :problem-type="video.analysis!.problemType ?? null" :is-dynamic="video.analysis!.isDynamic ?? null" />
                <button class="feedback-link" @click="showFeedbackModal = true">AI 결과가 맞나요? 피드백 남기기</button>
              </div>

              <!-- analyzing / pending / 아웃트로 (내 영상 전용) -->
              <div v-else-if="showLoader" class="ai-section hola-card ai-pending">
                <AnalysisLoader :progress="analysisProgress.progress" :stage="analysisProgress.stage" :message="analysisProgress.message" :finishing="playingOutro" @complete="onAnalysisComplete" />
                <template v-if="!playingOutro">
                  <div class="leave-hint">
                    <p class="leave-hint-text">분석은 백그라운드에서 계속돼요. 다른 화면으로 이동해도 괜찮아요.</p>
                    <BaseButton variant="secondary" size="sm" @click="leaveAnalysis">
                      {{ isOwner ? "내 영상으로" : "둘러보기" }}
                    </BaseButton>
                  </div>
                  <button class="retry-btn retry-btn--muted" aria-label="분석 재시도" @click="retryAnalysis">
                    <IonIcon :icon="refreshOutline" />
                    멈췄나요? 재시도
                  </button>
                </template>
              </div>

              <!-- failed (내 영상 전용) -->
              <div v-else-if="isOwner && analysisFailed" class="ai-section hola-card ai-failed">
                <span class="fail-text">AI 분석에 실패했어요.</span>
                <button class="retry-btn" aria-label="분석 재시도" @click="retryAnalysis">
                  <IonIcon :icon="refreshOutline" />
                  재시도
                </button>
              </div>

              <!-- 액션 -->
              <div class="actions actions-divided">
                <button class="action-btn" :aria-label="video.isLiked ? '좋아요 취소' : '좋아요'" @click="handleLike">
                  <IonIcon :icon="video.isLiked ? heart : heartOutline" :class="{ liked: video.isLiked }" />
                  <span>{{ video.likeCount }}</span>
                </button>
                <button class="action-btn" aria-label="댓글">
                  <IonIcon :icon="chatbubbleOutline" />
                  <span>{{ commentCount }}</span>
                </button>
                <button class="action-btn" aria-label="공유" @click="handleShare">
                  <IonIcon :icon="shareOutline" />
                </button>
              </div>

              <!-- 댓글 -->
              <section class="comments-section">
                <h2 class="comments-title">댓글 {{ commentCount }}</h2>

                <div v-if="commentsLoading" class="comments-loading">
                  <IonSpinner name="crescent" />
                </div>

                <p v-else-if="comments.length === 0" class="comments-empty">첫 댓글을 남겨보세요.</p>

                <ul v-else class="comment-list">
                  <li v-for="c in comments" :key="c.id" class="comment-item">
                    <div class="avatar" aria-hidden="true">
                      <UserAvatar :src="c.user.profileImage" :nickname="c.user.nickname" />
                    </div>
                    <div class="c-body">
                      <div class="c-head">
                        <button class="c-name c-name-btn" @click="openProfile(c.user.id)">{{ c.user.nickname }}</button>
                        <span class="c-time">{{ formatTime(c.createdAt) }}</span>
                      </div>
                      <template v-if="editingCommentId === c.id">
                        <div class="c-edit-row">
                          <input v-model="editInput" class="c-edit-input" type="text" aria-label="댓글 수정" :disabled="isUpdating" @keydown.enter="submitEdit(c.id)" @keydown.esc="cancelEdit" />
                          <button class="c-edit-save" :disabled="!editInput.trim() || isUpdating" aria-label="수정 저장" @click="submitEdit(c.id)">저장</button>
                          <button class="c-edit-cancel" :disabled="isUpdating" aria-label="수정 취소" @click="cancelEdit">취소</button>
                        </div>
                      </template>
                      <p v-else class="c-content"><ExpandableText :text="c.content" /></p>
                    </div>
                    <div v-if="authStore.user && c.user.id === authStore.user.id && editingCommentId !== c.id" class="c-actions">
                      <button class="c-action-btn" aria-label="댓글 수정" @click="startEdit(c)">수정</button>
                      <button class="c-action-btn c-action-btn--danger" aria-label="댓글 삭제" @click="deleteComment(c)">삭제</button>
                    </div>
                    <div v-else-if="!authStore.user || c.user.id !== authStore.user.id" class="c-actions">
                      <button class="c-action-btn" aria-label="댓글 신고" @click="openReport('comment', c.id)">신고</button>
                    </div>
                  </li>
                </ul>
              </section>
            </div>
          </div>

          <!-- 데스크탑 댓글 입력 -->
          <div v-if="isDesktop" class="comment-bar comment-bar--desktop">
            <input v-model="commentInput" class="comment-input" type="text" placeholder="댓글을 입력하세요" :disabled="isPosting" aria-label="댓글 입력" @keydown.enter="postComment($event)" />
            <button class="comment-send" :disabled="!commentInput.trim() || isPosting" aria-label="댓글 등록" @click="postComment">
              <IonSpinner v-if="isPosting" name="crescent" />
              <span v-else>등록</span>
            </button>
          </div>
        </div>
      </div>
    </IonContent>

    <!-- 모바일 댓글 입력 (fixed) -->
    <div v-if="video && !isDesktop" class="comment-bar">
      <input v-model="commentInput" class="comment-input" type="text" placeholder="댓글을 입력하세요" :disabled="isPosting" aria-label="댓글 입력" @keydown.enter="postComment($event)" />
      <button class="comment-send" :disabled="!commentInput.trim() || isPosting" aria-label="댓글 등록" @click="postComment">
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

    <!-- 수정 / 삭제 선택 (내 영상 전용) -->
    <BaseSheet v-if="isOwner" :open="showActionSheet" flush @close="showActionSheet = false">
      <p class="options-label micro-label">영상 관리</p>
      <button
        class="option-row"
        aria-label="영상 수정"
        @click="
          showActionSheet = false;
          showEditModal = true;
        "
      >
        <IonIcon :icon="createOutline" aria-hidden="true" />
        <span>수정</span>
      </button>
      <button
        class="option-row option-row--danger"
        aria-label="영상 삭제"
        @click="
          showActionSheet = false;
          showDeleteDialog = true;
        "
      >
        <IonIcon :icon="trashOutline" aria-hidden="true" />
        <span>삭제</span>
      </button>
    </BaseSheet>

    <!-- 삭제 확인 (내 영상 전용) -->
    <ConfirmDialog
      v-if="isOwner"
      :open="showDeleteDialog"
      title="영상 삭제"
      message="삭제하면 복구할 수 없어요."
      confirm-text="삭제"
      cancel-text="취소"
      danger
      @confirm="
        showDeleteDialog = false;
        onDeleteConfirm();
      "
      @cancel="showDeleteDialog = false"
    />

    <!-- 수정 모달 (내 영상 전용) -->
    <VideoEditModal v-if="isOwner" :open="showEditModal" :video="video" @save="onEditSave" @cancel="showEditModal = false" />

    <!-- 비소유자 더보기 시트 -->
    <BaseSheet :open="showMoreSheet" flush @close="showMoreSheet = false">
      <p class="options-label micro-label">더보기</p>
      <button class="option-row option-row--danger" aria-label="영상 신고" @click="showMoreSheet = false; openReport('video', videoId)">
        <IonIcon :icon="flagOutline" aria-hidden="true" />
        <span>신고</span>
      </button>
    </BaseSheet>

    <!-- 신고 모달 -->
    <ReportModal v-if="reportTarget" :open="showReportModal" :target-type="reportTarget.type" :target-id="reportTarget.id" @close="showReportModal = false" />
  </IonPage>
</template>

<style scoped>
.more-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  font-size: 22px;
  display: grid;
  place-items: center;
  padding: 6px;
  width: 44px;
  height: 44px;
}

.page-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

/* ── Desktop 2-pane layout ───────────────────────── */
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
  .sidebar-scroll {
    flex: 1;
    overflow-y: auto;
  }
  .sidebar-scroll .comments-section {
    padding-bottom: 24px;
  }
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
.video-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--fs-body);
}
.placeholder-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

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
.grade-chip {
  flex-shrink: 0;
  margin-top: 2px;
}

/* 작성자 (남의 영상) */
.author-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.author-link {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  min-width: 0;
}
.author-link:active {
  opacity: 0.6;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.author-meta {
  min-width: 0;
}
.author-name {
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  padding-bottom: 4px;
}
.sub-line {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 메타 (내 영상) */
.meta-row {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin-top: -8px;
}

/* ── AI 분석 섹션 ────────────────────────────────── */
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
.ai-pending {
  gap: 16px;
}

/* 화면 이탈 안내 */
.leave-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface-soft);
  border-radius: var(--r-input);
}
.leave-hint-text {
  flex: 1;
  font-size: var(--fs-caption);
  line-height: 1.45;
  color: var(--fg-muted);
  margin: 0;
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
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

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
  font-family: var(--font-sans);
}
.retry-btn--sm {
  background: none;
  color: var(--fg-muted);
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
}
.retry-btn--muted {
  background: none;
  color: var(--fg-muted);
  border: 1px solid var(--border);
  align-self: flex-start;
  margin-top: 4px;
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
.actions {
  display: flex;
  gap: 24px;
  align-items: center;
}
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
.action-btn ion-icon {
  font-size: 22px;
}
.liked {
  color: var(--hold-pink);
}

/* ── 댓글 ────────────────────────────────────────── */
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
.comments-loading {
  display: grid;
  place-items: center;
  padding: 24px;
}
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
.comment-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
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
.c-avatar-btn {
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.c-avatar-btn:active {
  opacity: 0.6;
}
.c-body {
  flex: 1;
  min-width: 0;
}
.c-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.c-name {
  font-size: 13px;
  font-weight: 700;
}
.c-name-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--fg);
  font-family: inherit;
}
.c-name-btn:active {
  opacity: 0.6;
}
.c-time {
  font-size: 11px;
  color: var(--fg-muted);
}
.c-content {
  font-size: var(--fs-body);
  line-height: 1.45;
  margin: 3px 0 0;
  word-break: break-word;
}
.c-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.c-action-btn {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  font-family: inherit;
}
.c-action-btn--danger {
  color: var(--hold-pink);
}

.c-edit-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
}
.c-edit-input {
  flex: 1;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--r-input, 14px);
  background: var(--surface-soft);
  padding: 0 10px;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--fg);
  outline: none;
  min-width: 0;
}
.c-edit-input:focus {
  border-color: var(--fg);
}
.c-edit-save {
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: var(--r-button, 14px);
  background: var(--hold-dark, #151515);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.c-edit-save:disabled {
  opacity: 0.4;
  cursor: default;
}
.c-edit-cancel {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-button, 14px);
  background: none;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}

/* ── 댓글 입력바 ─────────────────────────────────── */
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
.comment-input:focus {
  border-color: var(--fg);
}
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
.comment-send:disabled {
  opacity: 0.4;
  cursor: default;
}
.comment-send ion-spinner {
  width: 18px;
  height: 18px;
  --color: #fff;
}

/* ── 영상 관리 옵션 시트 ─────────────────────────── */
.options-label {
  padding: 0 22px 8px;
  margin: 0;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 22px;
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  color: var(--fg);
  cursor: pointer;
  text-align: left;
}
.option-row ion-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.option-row--danger {
  color: var(--hold-pink);
}
</style>
