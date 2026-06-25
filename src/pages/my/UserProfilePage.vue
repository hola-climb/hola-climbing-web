<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IonPage, IonContent, IonIcon, IonRefresher, IonRefresherContent,
} from '@ionic/vue'
import { ellipsisHorizontal, flagOutline, banOutline } from 'ionicons/icons'
import BaseSheet from '@/components/common/BaseSheet.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ReportModal from '@/components/common/ReportModal.vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/client'
import { authService } from '@/services/auth'
import { videoService } from '@/services/video'
import type { Video } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import VideoThumbnail from '@/components/video/VideoThumbnail.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

interface ProfileView {
  id: string
  nickname: string
  profileImageUrl: string | null
  bio: string | null
  followerCount: number
  followingCount: number
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

const userId = route.params.id as string
const user = ref<ProfileView | null>(null)
const videos = ref<Video[]>([])
const isLoading = ref(true)
const isFollowing = ref(false)
const isTogglingFollow = ref(false)
const isBlocked = ref(false)
const showMoreSheet = ref(false)

const isSelf = computed(() => authStore.user?.id === userId)

function goDetail(video: Video) {
  router.push(`/videos/${video.id}`)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const showReportModal = ref(false)


function openReport() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  showReportModal.value = true
}

async function loadVideos() {
  try {
    const { data } = await videoService.getUserVideos(userId, { page: 0, size: 12 })
    videos.value = data.content
  } catch {
    videos.value = []
  }
}

/** 차단 여부는 프로필 응답에 없으므로 내 차단 목록으로 판별 */
async function loadBlockStatus() {
  if (!authStore.isAuthenticated || isSelf.value) return
  try {
    const { data } = await authService.getBlockList({ page: 0, size: 100 })
    const list = data.content as unknown as Array<{ userId?: number; id?: string | number }>
    isBlocked.value = list.some((b) => String(b.userId ?? b.id) === userId)
  } catch {
    /* best-effort */
  }
}

async function loadProfile() {
  try {
    // Backend UserProfileResponse: { userId, nickname, profileImage, bio, followerCount, followingCount, isFollowing }
    const [profileRes] = await Promise.all([
      api.get<{
        userId?: number; id?: number; nickname: string
        profileImage?: string | null; profileImageUrl?: string | null
        bio?: string | null; followerCount?: number; followingCount?: number; isFollowing?: boolean
      }>(`/users/${userId}`),
      loadVideos(),
      loadBlockStatus(),
    ])
    const p = profileRes.data
    user.value = {
      id: String(p.id ?? p.userId ?? userId),
      nickname: p.nickname ?? '사용자',
      profileImageUrl: p.profileImageUrl ?? p.profileImage ?? null,
      bio: p.bio ?? null,
      followerCount: p.followerCount ?? 0,
      followingCount: p.followingCount ?? 0,
    }
    isFollowing.value = !!p.isFollowing
  } catch {
    uiStore.showToast('프로필을 불러올 수 없어요.', 'danger')
    router.back()
  } finally {
    isLoading.value = false
  }
}

async function handleRefresh(event: CustomEvent) {
  await loadProfile()
  ;(event.target as HTMLIonRefresherElement).complete()
}

onMounted(loadProfile)

async function handleBlock() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  try {
    await authService.blockUser(userId)
    // 차단 시 상호 비노출 + 팔로우 관계 해제
    isBlocked.value = true
    isFollowing.value = false
    videos.value = []
    uiStore.showToast('차단했어요.')
  } catch {
    uiStore.showToast('차단에 실패했어요.', 'danger')
  }
}

async function handleUnblock() {
  try {
    await authService.unblockUser(userId)
    isBlocked.value = false
    uiStore.showToast('차단을 해제했어요.')
    await loadVideos()
  } catch {
    uiStore.showToast('차단 해제에 실패했어요.', 'danger')
  }
}

async function handleFollow() {
  if (!authStore.isAuthenticated) { uiStore.openLoginSheet(); return }
  if (isSelf.value) return
  if (isTogglingFollow.value) return
  isTogglingFollow.value = true
  const wasFollowing = isFollowing.value
  // Optimistic toggle (follow/unfollow return ApiResponse<Void>)
  isFollowing.value = !wasFollowing
  if (user.value) user.value.followerCount += wasFollowing ? -1 : 1
  try {
    if (wasFollowing) await authService.unfollow(userId)
    else await authService.follow(userId)
  } catch {
    // rollback
    isFollowing.value = wasFollowing
    if (user.value) user.value.followerCount += wasFollowing ? 1 : -1
    uiStore.showToast('처리 중 오류가 발생했어요.', 'danger')
  } finally {
    isTogglingFollow.value = false
  }
}
</script>

<template>
  <IonPage>
    <AppHeader title="프로필">
      <template v-if="!isSelf" #action>
        <button class="more-btn" @click="showMoreSheet = true" aria-label="더보기">
          <IonIcon :icon="ellipsisHorizontal" />
        </button>
      </template>
    </AppHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div v-if="isLoading" class="page-skeleton page-padding">
        <LoadingState variant="card" :count="1" label="프로필을 불러오는 중" />
        <LoadingState variant="list" :count="3" />
      </div>

      <div v-else-if="user" class="profile-content page-padding reveal-on-load">
        <!-- Profile header -->
        <div class="profile-header">
          <div class="avatar-lg">
            <UserAvatar :src="user.profileImageUrl" :nickname="user.nickname" />
          </div>
          <div class="profile-meta">
            <div class="user-name">{{ user.nickname }}</div>
            <div class="follow-counts">
              <button class="count" @click="router.push(`/users/${userId}/follows?tab=followers`)">
                팔로워 <strong>{{ user.followerCount }}</strong>
              </button>
              <span aria-hidden="true">·</span>
              <button class="count" @click="router.push(`/users/${userId}/follows?tab=following`)">
                팔로잉 <strong>{{ user.followingCount }}</strong>
              </button>
            </div>
            <div v-if="user.bio" class="user-bio">{{ user.bio }}</div>
          </div>
          <button
            v-if="!isSelf && !isBlocked"
            class="follow-btn"
            :class="{ following: isFollowing }"
            @click="handleFollow"
            :aria-label="isFollowing ? '언팔로우' : '팔로우'"
          >
            {{ isFollowing ? '팔로잉' : '팔로우' }}
          </button>
          <button
            v-else-if="!isSelf && isBlocked"
            class="follow-btn following"
            @click="handleUnblock"
            aria-label="차단 해제"
          >
            차단 해제
          </button>
        </div>

        <!-- Blocked notice -->
        <div v-if="isBlocked" class="blocked-notice">
          <p class="blocked-title">차단한 사용자예요</p>
          <p class="blocked-sub">차단을 해제하면 이 사용자의 영상과 활동을 다시 볼 수 있어요.</p>
        </div>

        <!-- Video grid (public videos only, no AI results) -->
        <template v-else>
          <div class="section-title">영상</div>
          <div v-if="videos.length" class="video-grid">
            <button v-for="video in videos" :key="video.id" class="video-item" :aria-label="`${video.title ?? '제목 없음'} 영상 보기`" @click="goDetail(video)">
              <div class="thumb-wrap">
                <VideoThumbnail :title="video.title" :thumbnail-url="video.thumbnailUrl" :grade="video.grade" :gym-name="video.gymName" :alt="`${video.title ?? '클라이밍 영상'} 썸네일`" />
              </div>
              <div class="item-info">
                <p class="item-title">{{ video.title ?? "제목 없음" }}</p>
                <div class="item-meta">
                  <span class="meta-stat" aria-label="조회수">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {{ video.viewCount }}
                  </span>
                  <span class="meta-stat" aria-label="좋아요수">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
                    </svg>
                    {{ video.likeCount }}
                  </span>
                  <span class="meta-date">{{ formatDate(video.createdAt) }}</span>
                </div>
              </div>
            </button>
          </div>
          <EmptyState v-else compact hold="cyan" title="공개 영상이 없어요" />
        </template>
      </div>

      <!-- 더보기 시트 (신고/차단/차단 해제) -->
      <BaseSheet :open="showMoreSheet" flush @close="showMoreSheet = false">
        <p class="options-label micro-label">더보기</p>
        <button class="option-row" aria-label="신고" @click="showMoreSheet = false; openReport()">
          <IonIcon :icon="flagOutline" aria-hidden="true" />
          <span>신고</span>
        </button>
        <button
          class="option-row option-row--danger"
          :aria-label="isBlocked ? '차단 해제' : '차단'"
          @click="showMoreSheet = false; isBlocked ? handleUnblock() : handleBlock()"
        >
          <IonIcon :icon="banOutline" aria-hidden="true" />
          <span>{{ isBlocked ? '차단 해제' : '차단' }}</span>
        </button>
      </BaseSheet>

      <!-- 사용자 신고 모달 -->
      <ReportModal :open="showReportModal" target-type="user" :target-id="userId" @close="showReportModal = false" />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.more-btn { background: none; border: none; cursor: pointer; color: var(--fg); font-size: 22px; display: grid; place-items: center; padding: 6px; }

.options-label { padding: 0 22px 8px; margin: 0; }
.option-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%; padding: 16px 22px;
  background: none; border: none;
  font-family: var(--font-sans); font-size: var(--fs-body); font-weight: var(--w-semibold);
  color: var(--fg); cursor: pointer; text-align: left;
}
.option-row ion-icon { font-size: 20px; flex-shrink: 0; }
.option-row--danger { color: var(--hold-pink); }

.page-skeleton { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }

.profile-content { padding-top: 20px; padding-bottom: 40px; display: flex; flex-direction: column; gap: 20px; }

.profile-header { display: flex; align-items: center; gap: 12px; }
.avatar-lg {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--tint-cyan); color: var(--on-tint-cyan);
  display: grid; place-items: center; overflow: hidden;
  font-size: 20px; font-weight: 800; flex-shrink: 0;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.profile-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.user-name { font-size: var(--fs-h3); font-weight: var(--w-extrabold); }
.follow-counts { display: flex; align-items: center; gap: 8px; font-size: var(--fs-caption); color: var(--fg-muted); }
.count { background: none; border: none; padding: 0; cursor: pointer; font-size: var(--fs-caption); color: var(--fg-muted); }
.count strong { color: var(--fg); font-weight: 800; }
.user-bio { font-size: var(--fs-caption); color: var(--fg); }

.follow-btn {
  padding: 8px 18px; border-radius: var(--r-chip);
  border: 1.5px solid var(--hold-dark); background: var(--hold-dark);
  color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all var(--dur-fast) var(--ease-state);
}
.follow-btn.following { background: var(--surface); color: var(--fg); }

.blocked-notice {
  text-align: center;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.blocked-title { font-size: var(--fs-body); font-weight: var(--w-bold); margin: 0; }
.blocked-sub { font-size: var(--fs-caption); color: var(--fg-muted); margin: 0; line-height: 1.5; }

.section-title { font-size: var(--fs-h3); font-weight: var(--w-semibold); }

.video-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 600px)  { .video-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 900px)  { .video-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1200px) { .video-grid { grid-template-columns: repeat(5, 1fr); } }

.video-item {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform var(--dur-fast) var(--ease-state);
}
.video-item:active { transform: scale(0.97); }

.thumb-wrap {
  aspect-ratio: 1 / 1;
  width: 100%;
  overflow: hidden;
  border-radius: var(--r-card);
  background: var(--surface-soft);
}

.item-info { padding: 8px 2px 4px; }

.item-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--fg);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.meta-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted);
}

.meta-date { font-size: 11px; color: var(--fg-muted); margin-left: auto; }
</style>
