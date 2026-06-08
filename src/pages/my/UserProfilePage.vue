<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonIcon, IonSpinner,
} from '@ionic/vue'
import { chevronBackOutline } from 'ionicons/icons'
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

onMounted(async () => {
  try {
    // Backend UserProfileResponse: { userId, nickname, profileImage, bio, followerCount, followingCount, isFollowing }
    const [profileRes, videosRes] = await Promise.all([
      api.get<{
        userId?: number; id?: number; nickname: string
        profileImage?: string | null; profileImageUrl?: string | null
        bio?: string | null; followerCount?: number; followingCount?: number; isFollowing?: boolean
      }>(`/users/${userId}`),
      videoService.getUserVideos(userId, { page: 0, size: 12 }),
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
    videos.value = videosRes.data.content
  } catch {
    uiStore.showToast('프로필을 불러올 수 없어요.', 'danger')
    router.back()
  } finally {
    isLoading.value = false
  }
})

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
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <button class="back-btn" @click="router.back()" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <span class="toolbar-title">프로필</span>
          <div />
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="isLoading" class="loading-center">
        <IonSpinner name="dots" />
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
            <div class="follow-counts">팔로워 {{ user.followerCount }} · 팔로잉 {{ user.followingCount }}</div>
            <div v-if="user.bio" class="user-bio">{{ user.bio }}</div>
          </div>
          <button
            v-if="authStore.user?.id !== userId"
            class="follow-btn"
            :class="{ following: isFollowing }"
            @click="handleFollow"
            :aria-label="isFollowing ? '언팔로우' : '팔로우'"
          >
            {{ isFollowing ? '팔로잉' : '팔로우' }}
          </button>
        </div>

        <!-- Video grid (public videos only, no AI results) -->
        <div class="section-title">영상</div>
        <div class="video-grid">
          <VideoCard v-for="video in videos" :key="video.id" :video="video" />
          <p v-if="!videos.length" class="empty">공개 영상이 없어요.</p>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.toolbar-inner {
  display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; padding: 0 12px; height: 52px;
}
.back-btn { background: none; border: none; cursor: pointer; color: var(--fg); font-size: 24px; display: grid; place-items: center; }
.toolbar-title { text-align: center; font-size: var(--fs-caption); font-weight: var(--w-semibold); text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-muted); }

.loading-center { display: grid; place-items: center; height: 60vh; }

.profile-content { padding-top: 20px; padding-bottom: 40px; display: flex; flex-direction: column; gap: 20px; }

.profile-header { display: flex; align-items: center; gap: 12px; }
.avatar-lg {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--tint-cyan); color: #066a78;
  display: grid; place-items: center; overflow: hidden;
  font-size: 20px; font-weight: 800; flex-shrink: 0;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.profile-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.user-name { font-size: var(--fs-h3); font-weight: var(--w-extrabold); }
.follow-counts { font-size: var(--fs-caption); color: var(--fg-muted); }
.user-bio { font-size: var(--fs-caption); color: var(--fg); }

.follow-btn {
  padding: 8px 18px; border-radius: var(--r-chip);
  border: 1.5px solid var(--hold-dark); background: var(--hold-dark);
  color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all var(--dur-fast) var(--ease-state);
}
.follow-btn.following { background: var(--surface); color: var(--fg); }

.section-title { font-size: var(--fs-h3); font-weight: var(--w-semibold); }
.video-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.empty { color: var(--fg-muted); font-size: var(--fs-caption); grid-column: 1/-1; text-align: center; padding: 40px 0; }
</style>
