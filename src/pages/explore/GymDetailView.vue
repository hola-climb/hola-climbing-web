<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IonContent, IonIcon,
  IonSpinner, IonModal,
} from '@ionic/vue'
import AppHeader from '@/components/common/AppHeader.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import {
  bookmarkOutline, bookmark, locationOutline,
  timeOutline, closeOutline, sendOutline, star, starOutline,
} from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { useGymStore } from '@/stores/gym'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { gymService } from '@/services/gym'
import { chatService } from '@/services/chat'
import { useGymChat } from '@/composables/useGymChat'
import { gradeColor, gradeTextColor } from '@/utils/gradeColor'
import VideoThumbnail from '@/components/video/VideoThumbnail.vue'
import type { GymPhoto, GymReview, FeedVideo, ChatMessage } from '@/types/api'

const props = defineProps<{ gymId: string }>()

const router = useRouter()
const gymStore = useGymStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

const gymId = props.gymId
const isLoading = ref(true)
const gym = computed(() => gymStore.currentGym)

const DAY_LABELS: Record<string, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
}

// ── Section data ───────────────────────────────────
const photos = ref<GymPhoto[]>([])
const videos = ref<FeedVideo[]>([])
const reviews = ref<GymReview[]>([])
const chatPreview = ref<ChatMessage[]>([])

// ── Gallery lightbox ───────────────────────────────
const showGallery = ref(false)
const galleryIndex = ref(0)

// ── Review form ────────────────────────────────────
const showReviewForm = ref(false)
const newRating = ref(0)
const newReviewContent = ref('')
const isSubmittingReview = ref(false)

const avgRating = computed(() => gym.value?.ratingAvg ?? null)
const reviewCount = computed(() => reviews.value.length || gym.value?.ratingCount || 0)

// ── Chat ───────────────────────────────────────────
const chat = useGymChat(gymId)
const showChat = ref(false)
const chatInput = ref('')
const isJoining = ref(false)

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

// ── Loaders ────────────────────────────────────────
async function loadSections() {
  const [pRes, vRes, rRes, cRes] = await Promise.allSettled([
    gymService.getPhotos(gymId),
    gymService.getGymVideos(gymId, { page: 0, size: 10 }),
    gymService.getReviews(gymId, { page: 0, size: 20 }),
    chatService.getMessages(gymId, { page: 0, size: 5 }),
  ])
  if (pRes.status === 'fulfilled') photos.value = pRes.value.data
  if (vRes.status === 'fulfilled') videos.value = vRes.value.data.content
  if (rRes.status === 'fulfilled') reviews.value = rRes.value.data.content
  if (cRes.status === 'fulfilled') chatPreview.value = cRes.value.data.content.slice(-3)
}

onMounted(async () => {
  try {
    await gymStore.fetchGym(gymId)
    loadSections()
  } catch {
    uiStore.showToast('암장 정보를 불러올 수 없어요.', 'danger')
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => chat.disconnect())

// ── Actions ────────────────────────────────────────
async function handleFavorite() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  try {
    await gymStore.toggleFavorite(gymId)
  } catch {
    uiStore.showToast('즐겨찾기 처리 중 오류가 발생했어요.', 'danger')
  }
}

function openGallery(index: number) {
  galleryIndex.value = index
  showGallery.value = true
}

function openReviewForm() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  newRating.value = 0
  newReviewContent.value = ''
  showReviewForm.value = true
}

async function submitReview() {
  if (newRating.value < 1) { uiStore.showToast('별점을 선택해주세요.', 'warning'); return }
  isSubmittingReview.value = true
  try {
    const { data } = await gymService.createReview(gymId, newRating.value, newReviewContent.value.trim())
    reviews.value.unshift(data)
    showReviewForm.value = false
    uiStore.showToast('리뷰를 남겼어요.')
  } catch {
    uiStore.showToast('리뷰 등록에 실패했어요.', 'danger')
  } finally {
    isSubmittingReview.value = false
  }
}

async function deleteReview(r: GymReview) {
  try {
    await gymService.deleteReview(r.id)
    reviews.value = reviews.value.filter((x) => x.id !== r.id)
  } catch {
    uiStore.showToast('리뷰 삭제에 실패했어요.', 'danger')
  }
}

async function enterChat() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  const token = localStorage.getItem('access_token')
  if (!token) { uiStore.openLoginSheet(); return }
  isJoining.value = true
  try {
    // Joining the room is the only hard requirement to "enter".
    await chatService.joinRoom(gymId)

    // History is best-effort — a failure here shouldn't block entry.
    try {
      const { data } = await chatService.getMessages(gymId, { page: 0, size: 30 })
      chat.messages.value = [...data.content].reverse()
    } catch (e) {
      if (import.meta.env.DEV) console.error('[chat] history load failed', e)
      chat.messages.value = []
    }

    showChat.value = true
    // Live WS connection is best-effort; status badge reflects connect result.
    try {
      chat.connect(token)
    } catch (e) {
      if (import.meta.env.DEV) console.error('[chat] ws connect failed', e)
    }
  } catch (e: unknown) {
    if (import.meta.env.DEV) console.error('[chat] join failed', e)
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    uiStore.showToast(msg ?? '채팅방 입장에 실패했어요.', 'danger')
  } finally {
    isJoining.value = false
  }
}

function leaveChat() {
  showChat.value = false
  chat.disconnect()
}

function sendChat(e?: KeyboardEvent | MouseEvent) {
  // Korean IME: keydown.enter fires during composition — ignore those.
  if ((e as KeyboardEvent)?.isComposing) return
  const content = chatInput.value.trim()
  if (!content) return
  chat.sendMessage(content)
  chatInput.value = ''
}

function openVideo(id: string) {
  router.push(`/videos/${id}`)
}
</script>

<template>
  <div class="gym-detail-view">
      <div v-if="isLoading" class="page-skeleton page-padding">
        <LoadingState variant="card" :count="1" label="암장 정보를 불러오는 중" />
        <LoadingState variant="list" :count="3" />
      </div>

      <div v-else-if="gym" class="gym-detail page-padding">
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
              <span v-if="avgRating" class="chip chip-orange"><AppIcon name="star" :size="11" /> {{ avgRating.toFixed(1) }}</span>
              <span v-if="gym.distanceKm !== null" class="chip chip-dark">{{ gym.distanceKm.toFixed(1) }}km</span>
            </div>
          </div>
          <button
            class="fav-btn"
            @click="handleFavorite"
            :aria-label="gym.isFavorited ? '즐겨찾기 해제' : '즐겨찾기'"
          >
            <IonIcon :icon="gym.isFavorited ? bookmark : bookmarkOutline" :class="{ favorited: gym.isFavorited }" />
          </button>
        </div>

        <!-- Photo gallery -->
        <div v-if="photos.length" class="section">
          <div class="section-head">
            <div class="section-title">사진</div>
            <button class="see-all" @click="openGallery(0)">전체보기</button>
          </div>
          <div class="photo-row">
            <button
              v-for="(p, i) in photos.slice(0, 6)"
              :key="p.id"
              class="photo-thumb"
              @click="openGallery(i)"
              :aria-label="p.caption ?? '암장 사진'"
            >
              <img :src="p.url" :alt="p.caption ?? '암장 사진'" loading="lazy" />
            </button>
          </div>
        </div>

        <!-- Gym videos -->
        <div v-if="videos.length" class="section">
          <div class="section-head">
            <div class="section-title">관련 영상</div>
          </div>
          <div class="video-row">
            <button
              v-for="v in videos"
              :key="v.id"
              class="video-thumb"
              @click="openVideo(v.id)"
              :aria-label="v.title ?? '클라이밍 영상'"
            >
              <VideoThumbnail :thumbnail-url="v.thumbnailUrl" :grade="v.grade" :alt="v.title ?? ''" />
            </button>
          </div>
        </div>

        <!-- Operating hours -->
        <div class="section hola-card">
          <div class="section-title">
            <IonIcon :icon="timeOutline" aria-hidden="true" />
            운영 시간
          </div>
          <div v-if="gym.operatingHours" class="hours-grid">
            <template v-for="(koreanLabel, dayKey) in DAY_LABELS" :key="dayKey">
              <span class="dow-label">{{ koreanLabel }}</span>
              <span class="hours-val">{{ (gym.operatingHours as Record<string, string | null>)[dayKey] ?? '정보 없음' }}</span>
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
                <button
                  v-if="authStore.user && r.user.id === authStore.user.id"
                  class="r-del"
                  aria-label="리뷰 삭제"
                  @click="deleteReview(r)"
                >삭제</button>
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
              <IonSpinner v-if="isJoining" name="crescent" class="btn-spinner" />
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

    <!-- Photo lightbox modal -->
    <IonModal :is-open="showGallery" @did-dismiss="showGallery = false">
      <div class="lightbox">
        <button class="lb-close" @click="showGallery = false" aria-label="닫기">
          <IonIcon :icon="closeOutline" />
        </button>
        <div class="lb-scroll">
          <figure v-for="p in photos" :key="p.id" class="lb-fig">
            <img :src="p.url" :alt="p.caption ?? '암장 사진'" />
            <figcaption v-if="p.caption">{{ p.caption }}</figcaption>
          </figure>
        </div>
      </div>
    </IonModal>

    <!-- Review write modal -->
    <IonModal :is-open="showReviewForm" :initial-breakpoint="0.6" :breakpoints="[0, 0.6, 0.95]" @did-dismiss="showReviewForm = false">
      <div class="sheet">
        <h2 class="sheet-title">리뷰 쓰기</h2>
        <div class="star-pick" role="radiogroup" aria-label="별점">
          <button
            v-for="n in 5"
            :key="n"
            class="star-btn"
            :aria-label="`${n}점`"
            @click="newRating = n"
          >
            <IonIcon :icon="n <= newRating ? star : starOutline" />
          </button>
        </div>
        <textarea
          v-model="newReviewContent"
          class="review-textarea"
          rows="4"
          maxlength="1000"
          placeholder="암장은 어땠나요? (선택)"
          aria-label="리뷰 내용"
        />
        <BaseButton variant="primary" block :loading="isSubmittingReview" :disabled="newRating < 1" @click="submitReview">등록</BaseButton>
      </div>
    </IonModal>

    <!-- Live chat modal -->
    <IonModal :is-open="showChat" @did-dismiss="leaveChat">
      <AppHeader :title="gym?.name ?? '채팅'" back-icon="close" @back="leaveChat">
        <template #action>
          <span class="chat-status" :class="chat.status.value">
            {{ chat.status.value === 'connected' ? '● 실시간' : chat.status.value === 'connecting' ? '연결 중' : '오프라인' }}
          </span>
        </template>
      </AppHeader>
      <IonContent>
        <div class="chat-log page-padding">
          <div
            v-for="m in chat.messages.value"
            :key="m.id"
            class="chat-msg"
            :class="{ mine: authStore.user && m.user.id === authStore.user.id }"
          >
            <div class="chat-bubble">
              <div class="cb-head">
                <span class="cb-name">{{ m.user.nickname }}</span>
                <span v-if="m.verifiedAtGym" class="cb-verified"><AppIcon name="pin" :size="11" /> 암장</span>
              </div>
              <span class="cb-text">{{ m.content }}</span>
            </div>
            <span class="cb-time">{{ formatTime(m.createdAt) }}</span>
          </div>
        </div>
      </IonContent>
      <div class="chat-bar">
        <input
          v-model="chatInput"
          class="chat-input"
          type="text"
          placeholder="메시지 입력"
          aria-label="메시지 입력"
          @keydown.enter="sendChat($event)"
        />
        <button class="chat-send" :disabled="!chatInput.trim()" aria-label="전송" @click="sendChat">
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
.fav-btn ion-icon.favorited { color: var(--fg); }

.gym-detail-view { position: relative; }
.page-skeleton { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }

.gym-detail { padding-top: 18px; padding-bottom: 60px; display: flex; flex-direction: column; gap: 18px; }

.gym-header { display: flex; align-items: center; gap: 16px; }
.gym-info { flex: 1; min-width: 0; }
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
.gym-logo { width: 100%; height: 100%; object-fit: cover; }
.gym-logo-placeholder { font-size: 28px; color: var(--fg-muted); }
.gym-name { font-size: var(--fs-h2); font-weight: var(--w-extrabold); letter-spacing: -0.01em; margin: 0 0 4px; }
.gym-address { font-size: var(--fs-caption); color: var(--fg-muted); margin: 0 0 8px; }
.header-chips { display: flex; gap: 6px; }

/* Sections */
.section { display: flex; flex-direction: column; gap: 12px; }
.section-head { display: flex; align-items: center; justify-content: space-between; }
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
}
.muted-count { color: var(--fg-muted); font-weight: 600; }
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

/* Photos */
.photo-row { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.photo-row::-webkit-scrollbar { display: none; }
.photo-thumb {
  flex: 0 0 auto;
  width: 96px;
  height: 96px;
  border-radius: var(--r-button);
  overflow: hidden;
  border: none;
  padding: 0;
  cursor: pointer;
  background: var(--surface-soft);
}
.photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Videos */
.video-row { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; }
.video-row::-webkit-scrollbar { display: none; }
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
.hours-grid { display: grid; grid-template-columns: 24px 1fr; gap: 6px 12px; }
.dow-label { font-size: var(--fs-caption); font-weight: var(--w-semibold); color: var(--fg-muted); }
.hours-val { font-size: var(--fs-caption); }
.no-info { font-size: var(--fs-caption); color: var(--fg-muted); margin: 0; }

/* Reviews */
.review-list { display: flex; flex-direction: column; gap: 10px; }
.review-item { display: flex; flex-direction: column; gap: 8px; }
.review-top { display: flex; align-items: center; gap: 10px; }
.r-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--tint-cyan, #d6f6fb); color: var(--on-tint-cyan);
  display: grid; place-items: center; font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.r-meta { flex: 1; min-width: 0; }
.r-name { font-size: 13px; font-weight: 700; }
.r-stars { display: flex; gap: 1px; color: var(--hold-orange); font-size: 13px; }
.r-time { font-size: 11px; color: var(--fg-muted); flex-shrink: 0; }
.r-del { background: none; border: none; color: var(--fg-muted); font-size: 12px; cursor: pointer; flex-shrink: 0; }
.r-content { font-size: var(--fs-body); line-height: 1.45; margin: 0; word-break: break-word; }

/* Chat preview */
.chat-preview { display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
.cp-line { display: flex; gap: 8px; font-size: 13px; min-width: 0; }
.cp-name { font-weight: 700; flex-shrink: 0; }
.cp-text { color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Lightbox */
.lightbox { height: 100%; background: #000; position: relative; }
.lb-close {
  position: absolute; top: 14px; right: 14px; z-index: 2;
  background: rgba(0,0,0,0.5); border: none; color: #fff; font-size: 22px;
  width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
}
.lb-scroll { height: 100%; overflow-y: auto; display: flex; flex-direction: column; }
.lb-fig { margin: 0; }
.lb-fig img { width: 100%; display: block; }
.lb-fig figcaption { color: #fff; font-size: 13px; padding: 8px 16px 20px; }

/* Review sheet */
.sheet { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; }
.sheet-title { font-size: var(--fs-h3); font-weight: 800; margin: 0; }
.star-pick { display: flex; gap: 6px; justify-content: center; }
.star-btn { background: none; border: none; cursor: pointer; font-size: 34px; color: var(--hold-orange); padding: 0; }
.review-textarea {
  width: 100%; border: 1px solid var(--border); border-radius: var(--r-button);
  background: var(--surface-soft); padding: 12px 14px;
  font-family: var(--font-sans); font-size: var(--fs-body); color: var(--fg); resize: none; outline: none;
}
.review-textarea:focus { border-color: var(--fg); }

/* Chat modal */
.chat-status { font-size: 11px; font-weight: 700; text-align: right; }
.chat-status.connected { color: var(--hold-orange); }
.chat-status.connecting { color: var(--fg-muted); }
.chat-status.error, .chat-status.idle { color: var(--fg-muted); }

.chat-log { padding-top: 16px; padding-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
.chat-msg { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; max-width: 80%; }
.chat-msg.mine { align-self: flex-end; align-items: flex-end; }
.chat-bubble {
  background: var(--surface-soft); border-radius: var(--r-button); padding: 8px 12px;
}
.chat-msg.mine .chat-bubble { background: var(--hold-lime); }
.cb-head { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.cb-name { font-size: 11px; font-weight: 700; color: var(--fg-muted); }
.cb-verified { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; color: var(--fg-muted); }
.cb-text { font-size: var(--fs-body); line-height: 1.4; word-break: break-word; }
.cb-time { font-size: 10px; color: var(--fg-muted); padding: 0 4px; }

.chat-bar {
  display: flex; gap: 8px; align-items: center;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: var(--surface); border-top: 1px solid var(--border);
}
.chat-input {
  flex: 1; height: 42px; border: 1px solid var(--border); border-radius: var(--r-button);
  background: var(--surface-soft); padding: 0 14px;
  font-family: var(--font-sans); font-size: var(--fs-body); color: var(--fg); outline: none;
}
.chat-input:focus { border-color: var(--fg); }
.chat-send {
  width: 42px; height: 42px; border: none; border-radius: 50%;
  background: var(--hold-dark, #151515); color: #fff; font-size: 18px;
  display: grid; place-items: center; cursor: pointer; flex-shrink: 0;
}
.chat-send:disabled { opacity: 0.4; cursor: default; }
</style>
