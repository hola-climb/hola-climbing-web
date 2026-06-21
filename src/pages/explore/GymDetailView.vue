<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted } from "vue";
import { IonContent, IonIcon, IonSpinner, IonModal } from "@ionic/vue";
import AppHeader from "@/components/common/AppHeader.vue";
import BaseSheet from "@/components/common/BaseSheet.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import BaseButton from "@/components/common/BaseButton.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import { bookmarkOutline, bookmark, locationOutline, timeOutline, sendOutline, star, starOutline } from "ionicons/icons";
import { useRouter } from "vue-router";
import { useGymStore } from "@/stores/gym";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { gymService } from "@/services/gym";
import { chatService } from "@/services/chat";
import { useChatStore } from "@/stores/chat";
import { gradeColor, gradeTextColor } from "@/utils/gradeColor";
import VideoThumbnail from "@/components/video/VideoThumbnail.vue";
import type { GymReview, FeedVideo, ChatMessage, BusinessHours } from "@/types/api";

const props = defineProps<{ gymId: string }>();

const router = useRouter();
const gymStore = useGymStore();
const authStore = useAuthStore();
const uiStore = useUIStore();
const chatStore = useChatStore();

const gymId = props.gymId;
const isLoading = ref(true);
const gym = computed(() => gymStore.currentGym);

const DAY_LABELS: Record<string, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

// ── Section data ───────────────────────────────────
const videos = ref<FeedVideo[]>([]);
const reviews = ref<GymReview[]>([]);
const chatPreview = ref<ChatMessage[]>([]);

// ── Review form ────────────────────────────────────
const showReviewForm = ref(false);
const newRating = ref(0);
const newReviewContent = ref("");
const isSubmittingReview = ref(false);

// ── Review edit ────────────────────────────────────
const showEditForm = ref(false);
const editingReview = ref<GymReview | null>(null);
const editRating = ref(0);
const editContent = ref("");
const isUpdatingReview = ref(false);

function openEditForm(r: GymReview) {
  editingReview.value = r;
  editRating.value = r.rating;
  editContent.value = r.content ?? "";
  showEditForm.value = true;
}

async function submitEditReview() {
  if (editRating.value < 1) {
    uiStore.showToast("별점을 선택해주세요.", "warning");
    return;
  }
  if (!editingReview.value) return;
  isUpdatingReview.value = true;
  try {
    await gymService.updateReview(editingReview.value.id, editRating.value, editContent.value.trim());
    const target = reviews.value.find((r) => r.id === editingReview.value!.id);
    if (target) {
      target.rating = editRating.value;
      target.content = editContent.value.trim();
    }
    showEditForm.value = false;
    uiStore.showToast("리뷰를 수정했어요.");
  } catch {
    uiStore.showToast("리뷰 수정에 실패했어요.", "danger");
  } finally {
    isUpdatingReview.value = false;
  }
}

const avgRating = computed(() => gym.value?.ratingAvg ?? null);
const reviewCount = computed(() => reviews.value.length || gym.value?.ratingCount || 0);

// ── Chat ───────────────────────────────────────────
// 채팅 상태(모달 노출·메시지·소켓)는 chatStore가 보유한다. 컴포넌트가
// 리사이즈로 언마운트/리마운트돼도 채팅이 끊기지 않게 하기 위함이다.
// showChat은 "이 암장"의 채팅이 열려 있을 때만 true.
const showChat = computed(() => chatStore.showChat && chatStore.activeGymId === gymId);
// 언마운트로 인한 모달 dismiss를 사용자의 '나가기'와 구분하기 위한 플래그.
let unmounting = false;

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

// ── Loaders ────────────────────────────────────────
async function loadSections() {
  const [vRes, rRes, cRes] = await Promise.allSettled([
    gymService.getGymVideos(gymId, { page: 0, size: 10 }),
    gymService.getReviews(gymId, { page: 0, size: 20 }),
    chatService.getMessages(gymId, { page: 0, size: 5 }),
  ]);
  if (vRes.status === "fulfilled") videos.value = vRes.value.data.content;
  if (rRes.status === "fulfilled") reviews.value = rRes.value.data.content;
  if (cRes.status === "fulfilled") chatPreview.value = cRes.value.data.content.slice(-3);
}

onMounted(async () => {
  // 이 뷰가 해당 암장 채팅의 '시청자'임을 등록 — 리마운트 핸드오프 동안
  // 소켓이 유지되도록 한다.
  chatStore.retainView(gymId);
  try {
    await gymStore.fetchGym(gymId);
    loadSections();
  } catch {
    uiStore.showToast("암장 정보를 불러올 수 없어요.", "danger");
  } finally {
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  unmounting = true;
});

// 시청자 해제 — 같은 암장 뷰가 곧바로 다시 마운트되지 않으면 소켓을 정리한다.
onUnmounted(() => chatStore.releaseView(gymId));

// ── Actions ────────────────────────────────────────
async function handleFavorite() {
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  try {
    await gymStore.toggleFavorite(gymId);
  } catch {
    uiStore.showToast("즐겨찾기 처리 중 오류가 발생했어요.", "danger");
  }
}

function openReviewForm() {
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  newRating.value = 0;
  newReviewContent.value = "";
  showReviewForm.value = true;
}

async function submitReview() {
  if (newRating.value < 1) {
    uiStore.showToast("별점을 선택해주세요.", "warning");
    return;
  }
  isSubmittingReview.value = true;
  try {
    const { data } = await gymService.createReview(gymId, newRating.value, newReviewContent.value.trim());
    reviews.value.unshift(data);
    showReviewForm.value = false;
    uiStore.showToast("리뷰를 남겼어요.");
  } catch {
    uiStore.showToast("리뷰 등록에 실패했어요.", "danger");
  } finally {
    isSubmittingReview.value = false;
  }
}

async function deleteReview(r: GymReview) {
  try {
    await gymService.deleteReview(r.id);
    reviews.value = reviews.value.filter((x) => x.id !== r.id);
  } catch {
    uiStore.showToast("리뷰 삭제에 실패했어요.", "danger");
  }
}

async function enterChat() {
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  const token = localStorage.getItem("access_token");
  if (!token) {
    uiStore.openLoginSheet();
    return;
  }
  try {
    // 입장(join)·이력·소켓 연결 오케스트레이션은 스토어가 담당한다.
    // join 실패만 throw되며, 그 외(이력/연결)는 best-effort.
    await chatStore.enterRoom(gymId, token);
  } catch (e: unknown) {
    if (import.meta.env.DEV) console.error("[chat] join failed", e);
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    uiStore.showToast(msg ?? "채팅방 입장에 실패했어요.", "danger");
  }
}

function leaveChat() {
  chatStore.leaveRoom();
}

// IonModal의 did-dismiss: 사용자가 직접 닫았을 때만 '나가기'로 처리하고,
// 컴포넌트 언마운트로 인한 dismiss는 무시한다(소켓 핸드오프 보존).
function onChatDismiss() {
  if (unmounting) return;
  leaveChat();
}

function sendChat(e?: KeyboardEvent | MouseEvent) {
  // Korean IME: keydown.enter fires during composition — ignore those.
  if ((e as KeyboardEvent)?.isComposing) return;
  const content = chatStore.draft.trim();
  if (!content) return;
  chatStore.sendMessage(content);
  chatStore.draft = "";
}

function openVideo(id: string) {
  router.push(`/videos/${id}`);
}
</script>

<template>
  <div class="gym-detail-view">
    <div v-if="isLoading" class="gd-skeleton page-padding" role="status" aria-label="암장 정보를 불러오는 중">
      <!-- Header card: logo + name / address / chips -->
      <div class="sk-header hola-card">
        <div class="sk sk-logo" />
        <div class="sk-header-info">
          <div class="sk sk-line" style="width: 55%; height: 16px" />
          <div class="sk sk-line" style="width: 75%; height: 11px; margin-top: 6px" />
          <div class="sk sk-chips">
            <div class="sk sk-chip" />
            <div class="sk sk-chip" style="width: 48px" />
          </div>
        </div>
      </div>

      <!-- Hours card: title + 7 day rows -->
      <div class="sk-hours hola-card">
        <div class="sk sk-section-title" style="width: 80px; margin-bottom: 12px" />
        <div v-for="i in 7" :key="i" class="sk-hours-row">
          <div class="sk sk-dow" />
          <div class="sk sk-line" :style="{ width: `${42 + (i % 3) * 12}%`, height: '11px' }" />
        </div>
      </div>

      <!-- Reviews section: title + 2 review items -->
      <div class="sk-section">
        <div class="sk sk-section-title" />
        <div v-for="i in 2" :key="i" class="sk-review hola-card">
          <div class="sk-review-top">
            <div class="sk sk-avatar" />
            <div class="sk-review-meta">
              <div class="sk sk-line" style="width: 60%; height: 11px" />
              <div class="sk sk-line" style="width: 40%; height: 9px; margin-top: 5px" />
            </div>
          </div>
          <div class="sk sk-line" style="width: 90%; height: 11px" />
          <div class="sk sk-line" style="width: 65%; height: 11px" />
        </div>
      </div>
    </div>

    <div v-else-if="gym" class="gym-detail page-padding reveal-on-load">
      <!-- Header -->
      <div class="gym-header hola-card">
        <div class="gym-logo-wrap">
          <img v-if="gym.logoUrl" :src="gym.logoUrl" :alt="`${gym.name} 로고`" class="gym-logo" />
          <IonIcon v-else :icon="locationOutline" class="gym-logo-placeholder" aria-hidden="true" />
        </div>
        <div class="gym-info">
          <h1 class="gym-name">{{ gym.name }}</h1>
          <p class="gym-address">{{ gym.address }}</p>
          <div class="header-chips">
            <span v-if="avgRating" class="chip chip-orange">
              <AppIcon name="star" :size="11" />
              {{ avgRating.toFixed(1) }}
            </span>
            <span v-if="gym.distanceKm !== null" class="chip chip-dark">{{ gym.distanceKm.toFixed(1) }}km</span>
          </div>
        </div>
        <button class="fav-btn" @click="handleFavorite" :aria-label="gym.isFavorited ? '즐겨찾기 해제' : '즐겨찾기'">
          <!-- <IonIcon :icon="gym.isFavorited ? bookmark : bookmarkOutline" :class="{ favorited: gym.isFavorited }" /> -->
          <!-- Star favorite icon -->
          <svg v-if="gym.isFavorited" viewBox="0 0 200 200" width="35" height="35" aria-hidden="true" class="star-icon">
            <defs>
              <radialGradient id="sh" cx="40%" cy="34%" r="72%">
                <stop offset="0%" stop-color="#fff" stop-opacity="0.55"></stop>
                <stop offset="55%" stop-color="#fff" stop-opacity="0"></stop>
              </radialGradient>
            </defs>
            <path
              d="M 89.4 46.4 Q 100.0 20.0 110.6 46.4 L 110.6 46.4 Q 121.2 72.9 149.6 74.8 L 149.6 74.8 Q 178.0 76.7 156.1 94.9 L 156.1 94.9 Q 134.2 113.1 141.2 140.7 L 141.2 140.7 Q 148.2 168.3 124.1 153.2 L 124.1 153.2 Q 100.0 138.0 75.9 153.2 L 75.9 153.2 Q 51.8 168.3 58.8 140.7 L 58.8 140.7 Q 65.8 113.1 43.9 94.9 L 43.9 94.9 Q 22.0 76.7 50.4 74.8 L 50.4 74.8 Q 78.8 72.9 89.4 46.4 Z"
              fill="#22D3EE"
              stroke="#066a78"
              stroke-width="2"
              stroke-opacity="0.18"
              stroke-linejoin="round"
            ></path>
            <path
              d="M 89.4 46.4 Q 100.0 20.0 110.6 46.4 L 110.6 46.4 Q 121.2 72.9 149.6 74.8 L 149.6 74.8 Q 178.0 76.7 156.1 94.9 L 156.1 94.9 Q 134.2 113.1 141.2 140.7 L 141.2 140.7 Q 148.2 168.3 124.1 153.2 L 124.1 153.2 Q 100.0 138.0 75.9 153.2 L 75.9 153.2 Q 51.8 168.3 58.8 140.7 L 58.8 140.7 Q 65.8 113.1 43.9 94.9 L 43.9 94.9 Q 22.0 76.7 50.4 74.8 L 50.4 74.8 Q 78.8 72.9 89.4 46.4 Z"
              fill="url(#sh)"
            ></path>
          </svg>
          <svg v-else viewBox="0 0 200 200" width="35" height="35" aria-hidden="true" class="star-icon">
            <path
              d="M 89.4 46.4 Q 100.0 20.0 110.6 46.4 L 110.6 46.4 Q 121.2 72.9 149.6 74.8 L 149.6 74.8 Q 178.0 76.7 156.1 94.9 L 156.1 94.9 Q 134.2 113.1 141.2 140.7 L 141.2 140.7 Q 148.2 168.3 124.1 153.2 L 124.1 153.2 Q 100.0 138.0 75.9 153.2 L 75.9 153.2 Q 51.8 168.3 58.8 140.7 L 58.8 140.7 Q 65.8 113.1 43.9 94.9 L 43.9 94.9 Q 22.0 76.7 50.4 74.8 L 50.4 74.8 Q 78.8 72.9 89.4 46.4 Z"
              fill="none"
              stroke="#8D96A8"
              stroke-width="8"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <!-- Gym videos -->
      <div v-if="videos.length" class="section">
        <div class="section-head">
          <div class="section-title">관련 영상</div>
        </div>
        <div class="video-row">
          <button v-for="v in videos" :key="v.id" class="video-thumb" @click="openVideo(v.id)" :aria-label="v.title ?? '클라이밍 영상'">
            <VideoThumbnail :title="v.title" :thumbnail-url="v.thumbnailUrl" :grade="v.grade" :alt="v.title ?? ''" />
          </button>
        </div>
      </div>

      <!-- Operating hours -->
      <div class="section hola-card">
        <div class="section-title">
          <IonIcon :icon="timeOutline" aria-hidden="true" />
          운영 시간
        </div>
        <div v-if="gym.businessHours" class="hours-grid">
          <template v-for="(koreanLabel, dayKey) in DAY_LABELS" :key="dayKey">
            <span class="dow-label">{{ koreanLabel }}</span>
            <span class="hours-val">
              {{ gym.businessHours[dayKey as keyof BusinessHours] ? `${gym.businessHours[dayKey as keyof BusinessHours]!.open} - ${gym.businessHours[dayKey as keyof BusinessHours]!.close}` : "휴무" }}
            </span>
          </template>
        </div>
        <p v-else class="no-info">정보 없음</p>
      </div>

      <!-- Reviews -->
      <div class="section">
        <div class="section-head">
          <div class="section-title">
            리뷰
            <span v-if="reviewCount" class="muted-count">{{ reviewCount }}</span>
          </div>
          <button class="see-all" @click="openReviewForm">리뷰 쓰기</button>
        </div>

        <p v-if="reviews.length === 0" class="no-info">아직 리뷰가 없어요. 첫 리뷰를 남겨보세요.</p>

        <div v-else class="review-list">
          <div v-for="r in reviews" :key="r.id" class="review-item hola-card">
            <div class="review-top">
              <div class="r-avatar">{{ r.user.nickname.charAt(0).toUpperCase() }}</div>
              <div class="r-meta">
                <div class="r-name">{{ r.user.nickname }}</div>
                <div class="r-stars">
                  <IonIcon v-for="n in 5" :key="n" :icon="n <= r.rating ? star : starOutline" />
                </div>
              </div>
              <span class="r-time">{{ formatTime(r.createdAt) }}</span>
              <div v-if="authStore.user && r.user.id === authStore.user.id" class="r-actions">
                <button class="r-action-btn" aria-label="리뷰 수정" @click="openEditForm(r)">수정</button>
                <button class="r-action-btn r-action-btn--danger" aria-label="리뷰 삭제" @click="deleteReview(r)">삭제</button>
              </div>
            </div>
            <p v-if="r.content" class="r-content">{{ r.content }}</p>
          </div>
        </div>
      </div>

      <!-- Live chat preview -->
      <div class="section">
        <div class="section-head">
          <div class="section-title">실시간 채팅</div>
          <button class="see-all" @click="enterChat">
            <IonSpinner v-if="chatStore.isJoining" name="crescent" class="btn-spinner" />
            <span v-else>입장</span>
          </button>
        </div>
        <div class="chat-preview hola-card" @click="enterChat" role="button" tabindex="0">
          <template v-if="chatPreview.length">
            <div v-for="m in chatPreview" :key="m.id" class="cp-line">
              <span class="cp-name">{{ m.user.nickname }}</span>
              <span class="cp-text">{{ m.content }}</span>
            </div>
          </template>
          <p v-else class="no-info">아직 대화가 없어요. 입장해 첫 메시지를 남겨보세요.</p>
        </div>
      </div>
    </div>

    <!-- Review write modal -->
    <BaseSheet :open="showReviewForm" @close="showReviewForm = false">
      <div class="sheet">
        <h2 class="sheet-title">리뷰 쓰기</h2>
        <div class="star-pick" role="radiogroup" aria-label="별점">
          <button v-for="n in 5" :key="n" class="star-btn" :aria-label="`${n}점`" @click="newRating = n">
            <IonIcon :icon="n <= newRating ? star : starOutline" />
          </button>
        </div>
        <textarea v-model="newReviewContent" class="review-textarea" rows="4" maxlength="1000" placeholder="암장은 어땠나요? (선택)" aria-label="리뷰 내용" />
      </div>
      <template #footer>
        <BaseButton variant="primary" block :loading="isSubmittingReview" :disabled="newRating < 1" @click="submitReview">등록</BaseButton>
      </template>
    </BaseSheet>

    <!-- Review edit modal -->
    <BaseSheet :open="showEditForm" @close="showEditForm = false">
      <div class="sheet">
        <h2 class="sheet-title">리뷰 수정</h2>
        <div class="star-pick" role="radiogroup" aria-label="별점">
          <button v-for="n in 5" :key="n" class="star-btn" :aria-label="`${n}점`" @click="editRating = n">
            <IonIcon :icon="n <= editRating ? star : starOutline" />
          </button>
        </div>
        <textarea v-model="editContent" class="review-textarea" rows="4" maxlength="1000" placeholder="암장은 어땠나요? (선택)" aria-label="리뷰 내용" />
      </div>
      <template #footer>
        <BaseButton variant="primary" block :loading="isUpdatingReview" :disabled="editRating < 1" @click="submitEditReview">저장</BaseButton>
      </template>
    </BaseSheet>

    <!-- Live chat modal -->
    <IonModal :is-open="showChat" @did-dismiss="onChatDismiss">
      <AppHeader :title="gym?.name ?? '채팅'" back-icon="close" @back="leaveChat">
        <template #action>
          <span class="chat-status" :class="chatStore.status">
            {{ chatStore.status === "connected" ? "● 실시간" : chatStore.status === "connecting" ? "연결 중" : "오프라인" }}
          </span>
        </template>
      </AppHeader>
      <IonContent>
        <div class="chat-log page-padding">
          <div v-for="m in chatStore.messages" :key="m.id" class="chat-msg" :class="{ mine: authStore.user && m.user.id === authStore.user.id }">
            <div class="chat-bubble">
              <div class="cb-head">
                <span class="cb-name">{{ m.user.nickname }}</span>
                <span v-if="m.verifiedAtGym" class="cb-verified">
                  <AppIcon name="pin" :size="11" />
                  암장
                </span>
              </div>
              <span class="cb-text">{{ m.content }}</span>
            </div>
            <span class="cb-time">{{ formatTime(m.createdAt) }}</span>
          </div>
        </div>
      </IonContent>
      <div class="chat-bar">
        <input v-model="chatStore.draft" class="chat-input" type="text" placeholder="메시지 입력" aria-label="메시지 입력" @keydown.enter="sendChat($event)" />
        <button class="chat-send" :disabled="!chatStore.draft.trim()" aria-label="전송" @click="sendChat">
          <IonIcon :icon="sendOutline" />
        </button>
      </div>
    </IonModal>
  </div>
</template>

<style scoped>
.fav-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  font-size: 22px;
  display: grid;
  place-items: center;
  padding: 6px;
  flex-shrink: 0;
  align-self: flex-start;
}
.fav-btn ion-icon.favorited {
  color: var(--fg);
}

.gym-detail-view {
  position: relative;
}
.page-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

/* ── Layout-matched skeleton ─────────────────────── */
.gd-skeleton {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 18px;
  padding-bottom: 60px;
}

/* Shimmer base */
.sk {
  position: relative;
  overflow: hidden;
  background: var(--surface-soft);
  border-radius: var(--r-chip);
}
.sk::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  animation: gd-shimmer 1400ms var(--ease-state) infinite;
}
@keyframes gd-shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk::after {
    animation: none;
  }
}

/* Header card */
.sk-header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.sk-logo {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  flex-shrink: 0;
}
.sk-header-info {
  flex: 1;
  min-width: 0;
}
.sk-chips {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.sk-chip {
  height: 22px;
  width: 36px;
  border-radius: var(--r-chip);
}

/* Section containers */
.sk-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sk-section-title {
  height: 14px;
  width: 64px;
}
.sk-line {
  border-radius: var(--r-chip);
}

/* Hours card */
.sk-hours {
  display: flex;
  flex-direction: column;
}
.sk-hours-row {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 8px 12px;
  margin-bottom: 8px;
}
.sk-dow {
  height: 11px;
  width: 16px;
  border-radius: var(--r-chip);
}

/* Review items */
.sk-review {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sk-review-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sk-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sk-review-meta {
  flex: 1;
  min-width: 0;
}

.gym-detail {
  padding-top: 18px;
  padding-bottom: 60px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.gym-header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.gym-info {
  flex: 1;
  min-width: 0;
}
.gym-logo-wrap {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  overflow: hidden;
  background: var(--surface-soft);
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
.gym-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.gym-logo-placeholder {
  font-size: 28px;
  color: var(--fg-muted);
}
.gym-name {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0 0 4px;
}
.gym-address {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0 0 8px;
}
.header-chips {
  display: flex;
  gap: 6px;
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
}
.muted-count {
  color: var(--fg-muted);
  font-weight: 600;
}
.see-all {
  background: none;
  border: none;
  color: var(--hold-cyan);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
  min-height: 20px;
}

/* Videos */
.video-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.video-row::-webkit-scrollbar {
  display: none;
}
.video-thumb {
  flex: 0 0 auto;
  width: 116px;
  height: 160px;
  border-radius: var(--r-button);
  overflow: hidden;
  position: relative;
  border: none;
  padding: 0;
  cursor: pointer;
  background: var(--surface-soft);
}

/* Hours */
.hours-grid {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 6px 12px;
}
.dow-label {
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg-muted);
}
.hours-val {
  font-size: var(--fs-caption);
}
.no-info {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin: 0;
}

/* Reviews */
.review-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.review-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.review-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.r-avatar {
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
.r-meta {
  flex: 1;
  min-width: 0;
}
.r-name {
  font-size: 13px;
  font-weight: 700;
}
.r-stars {
  display: flex;
  gap: 1px;
  color: var(--hold-orange);
  font-size: 13px;
}
.r-time {
  font-size: 11px;
  color: var(--fg-muted);
  flex-shrink: 0;
}
.r-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}
.r-action-btn {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  font-family: inherit;
  text-align: right;
}
.r-action-btn--danger {
  color: var(--hold-pink);
}
.r-content {
  font-size: var(--fs-body);
  line-height: 1.45;
  margin: 0;
  word-break: break-word;
}

/* Chat preview */
.chat-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}
.cp-line {
  display: flex;
  gap: 8px;
  font-size: 13px;
  min-width: 0;
}
.cp-name {
  font-weight: 700;
  flex-shrink: 0;
}
.cp-text {
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Review sheet */
.sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}
.sheet-title {
  font-size: var(--fs-h3);
  font-weight: 800;
  margin: 0;
}
.star-pick {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 34px;
  color: var(--hold-orange);
  padding: 0;
}
.review-textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--r-button);
  background: var(--surface-soft);
  padding: 12px 14px;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--fg);
  resize: none;
  outline: none;
}
.review-textarea:focus {
  border-color: var(--fg);
}

/* Chat modal */
.chat-status {
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}
.chat-status.connected {
  color: var(--hold-orange);
}
.chat-status.connecting {
  color: var(--fg-muted);
}
.chat-status.error,
.chat-status.idle {
  color: var(--fg-muted);
}

.chat-log {
  padding-top: 16px;
  padding-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chat-msg {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  max-width: 80%;
}
.chat-msg.mine {
  align-self: flex-end;
  align-items: flex-end;
}
.chat-bubble {
  background: var(--surface-soft);
  border-radius: var(--r-button);
  padding: 8px 12px;
}
.chat-msg.mine .chat-bubble {
  background: var(--hold-lime);
}
.cb-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.cb-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--fg-muted);
}
.cb-verified {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--fg-muted);
}
.cb-text {
  font-size: var(--fs-body);
  line-height: 1.4;
  word-break: break-word;
}
.cb-time {
  font-size: 10px;
  color: var(--fg-muted);
  padding: 0 4px;
}

.chat-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
}
.chat-input {
  flex: 1;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: var(--r-button);
  background: var(--surface-soft);
  padding: 0 14px;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--fg);
  outline: none;
}
.chat-input:focus {
  border-color: var(--fg);
}
.chat-send {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 50%;
  background: var(--hold-dark, #151515);
  color: #fff;
  font-size: 18px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}
.chat-send:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
