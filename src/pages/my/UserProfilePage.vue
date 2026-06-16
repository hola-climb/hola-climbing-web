<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IonPage, IonContent, IonIcon, IonActionSheet,
} from '@ionic/vue'
import { ellipsisHorizontal } from 'ionicons/icons'
import AppHeader from '@/components/common/AppHeader.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/client'
import { authService } from '@/services/auth'
import { videoService } from '@/services/video'
import type { Video } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import VideoCard from '@/components/video/VideoCard.vue'

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

const moreButtons = computed(() => [
  isBlocked.value
    ? { text: '차단 해제', handler: handleUnblock }
    : { text: '차단', role: 'destructive', handler: handleBlock },
  { text: '취소', role: 'cancel' as const },
])

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

onMounted(async () => {
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
})

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
      <div v-if="isLoading" class="page-skeleton page-padding">
        <LoadingState variant="card" :count="1" label="프로필을 불러오는 중" />
        <LoadingState variant="list" :count="3" />
      </div>

      <div v-else-if="user" class="profile-content page-padding">
        <!-- Profile header -->
        <div class="profile-header">
          <div class="avatar-lg">
            <img v-if="user.profileImageUrl" :src="user.profileImageUrl" :alt="`${user.nickname} 프로필`" class="avatar-img" />
            <template v-else>{{ user.nickname.charAt(0).toUpperCase() }}</template>
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
            <VideoCard v-for="video in videos" :key="video.id" :video="video" />
          </div>
          <EmptyState v-else compact hold="cyan" title="공개 영상이 없어요" />
        </template>
      </div>

      <!-- 더보기 액션 시트 (차단/차단 해제) -->
      <IonActionSheet
        :is-open="showMoreSheet"
        :buttons="moreButtons"
        @did-dismiss="showMoreSheet = false"
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.more-btn { background: none; border: none; cursor: pointer; color: var(--fg); font-size: 22px; display: grid; place-items: center; padding: 6px; }

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
.empty { color: var(--fg-muted); font-size: var(--fs-caption); grid-column: 1/-1; text-align: center; padding: 40px 0; }
</style>
