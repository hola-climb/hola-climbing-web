<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { onMounted, reactive, computed, ref, watch } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent } from "@ionic/vue";
import type { InfiniteScrollCustomEvent } from "@ionic/vue";
import { useRouter } from "vue-router";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import { useVideoStore } from "@/stores/video";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { gradeColor } from "@/utils/gradeColor";
import VideoThumbnail from "@/components/video/VideoThumbnail.vue";
import UserAvatar from "@/components/common/UserAvatar.vue";

const router = useRouter();
const videoStore = useVideoStore();
const authStore = useAuthStore();
const uiStore = useUIStore();

const brokenThumbs = reactive<Set<string>>(new Set());
const hasScrolled = ref(false);

const greetingHour = new Date().getHours();
const greeting = greetingHour < 6 || greetingHour > 22 ? "오늘 하루도 수고했어요" : greetingHour < 12 ? "좋은 아침이에요" : "오늘도 높이 올라요";
const showInitialLoading = computed(() => videoStore.isLoadingFeed && videoStore.feedVideos.length === 0);
const hasUnread = computed(() => uiStore.unreadCount > 0);

function durationLabel(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function onThumbError(id: string) {
  brokenThumbs.add(id);
}

function openVideo(id: string) {
  router.push(`/videos/${id}`);
}

function handleScroll(event: CustomEvent<{ scrollTop: number }>) {
  const scrolled = event.detail.scrollTop > 12;
  hasScrolled.value = scrolled;
  window.dispatchEvent(new CustomEvent("hola:tab-bar-scroll", { detail: { scrolled } }));
}

async function handleRefresh(event: CustomEvent) {
  await videoStore.loadFeed(true);
  (event.target as HTMLIonRefresherElement).complete();
}

async function loadMore(event: InfiniteScrollCustomEvent) {
  await videoStore.loadFeed(false);
  event.target.complete();
}

onMounted(() => {
  videoStore.loadFeed(true);
  if (authStore.isAuthenticated) uiStore.refreshUnreadCount();
});

watch(
  () => authStore.isAuthenticated,
  () => {
    videoStore.loadFeed(true);
    if (authStore.isAuthenticated) uiStore.refreshUnreadCount();
  },
);
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border transparent-header" :class="{ 'is-scrolled': hasScrolled }">
      <IonToolbar class="transparent-toolbar">
        <div class="toolbar-inner">
          <span class="brand">HOLA</span>
          <button class="icon-btn" @click="router.push('/my/notifications')" :aria-label="hasUnread ? '알림, 안 읽은 알림 있음' : '알림'">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />
            </svg>
            <span v-if="hasUnread" class="noti-dot" aria-hidden="true" />
          </button>
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent fullscreen class="feed-content" :scroll-events="true" @ion-scroll="handleScroll">
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div class="glow glow-lime" aria-hidden="true" />
      <div class="glow glow-pink" aria-hidden="true" />

      <!-- Greeting hero -->
      <div class="hero">
        <h1 class="greeting">
          <span v-if="authStore.user" v-html="`${greeting},<br/>${authStore.user.nickname}.`" />
          <span v-else>올라에 온 걸 환영해요.</span>
        </h1>
        <div class="micro-label">오늘의 추천 클립</div>
      </div>

      <!-- Initial loading -->
      <div v-if="showInitialLoading" class="feed-skeleton">
        <LoadingState variant="grid" :count="6" label="추천 클립을 불러오는 중" />
      </div>

      <!-- Empty -->
      <EmptyState
        v-else-if="videoStore.feedVideos.length === 0"
        hold="lime"
        title="추천할 클립이 아직 없어요"
        description="팔로우를 늘리거나 영상을 업로드해 보세요."
        action-label="영상 올리기"
        @action="router.push('/upload')"
      />

      <!-- Video grid (uniform 9:16) -->
      <div v-else class="video-grid reveal-on-load">
        <button v-for="video in videoStore.feedVideos" :key="video.id" class="video-grid-card" @click="openVideo(video.id)" :aria-label="video.title ?? '추천 클립'">
          <!-- Thumbnail or placeholder. 향후 previewUrl 생기면 <video muted loop>로 교체 가능한 자리 -->
          <div class="thumb-wrap">
            <img
              v-if="video.thumbnailUrl && !brokenThumbs.has(video.id)"
              :src="video.thumbnailUrl"
              :alt="video.title ?? '클라이밍 클립 썸네일'"
              class="thumb-img"
              loading="lazy"
              @error="onThumbError(video.id)"
            />
            <div v-else class="thumb-placeholder">
              <span class="placeholder-grade">HOLA</span>
            </div>

            <!-- Play icon (영상임을 명확히) -->
            <span class="play-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>

            <!-- Grade chip -->
            <span v-if="video.grade" class="grade-chip">
              <span class="grade-dot" :style="{ background: gradeColor(video.grade) }" aria-hidden="true" />
              {{ video.gymName }}
            </span>
            <!-- Duration -->
            <span v-if="durationLabel(video.durationSeconds)" class="dur-badge">
              {{ durationLabel(video.durationSeconds) }}
            </span>
          </div>

          <!-- Meta -->
          <div class="card-meta">
            <div class="card-author">
              <div class="card-avatar" aria-hidden="true">
                <UserAvatar :src="video.user.profileImage" :nickname="video.user.nickname" />
              </div>
              <span class="card-nickname">{{ video.user.nickname }}</span>
            </div>
            <div class="card-title">{{ video.title || "제목 없는 영상" }}</div>
            <div class="card-stats">
              <span class="stat">
                <AppIcon name="heart" :size="13" />
                {{ video.likeCount }}
              </span>
              <span class="stat">
                <AppIcon name="play" :size="12" />
                {{ video.viewCount }}
              </span>
            </div>
          </div>
        </button>
      </div>

      <!-- Infinite scroll -->
      <IonInfiniteScroll :disabled="!videoStore.feedHasNext || videoStore.feedVideos.length === 0" @ion-infinite="loadMore">
        <IonInfiniteScrollContent loading-spinner="crescent" />
      </IonInfiniteScroll>
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* ── Toolbar ────────────────────────────────────── */
.toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 52px;
}
/* 데스크탑: 헤더 내용도 중앙 컬럼에 맞춰 정렬 */
@media (min-width: 768px) {
  .toolbar-inner {
    max-width: var(--content-max);
    margin-left: auto;
    margin-right: auto;
    width: 100%;
  }
}
.transparent-header {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 10;
  background: transparent;
  box-shadow: none;
  transition:
    background var(--dur-base) var(--ease-state),
    box-shadow var(--dur-base) var(--ease-state);
}
.transparent-header::after {
  display: none;
}
.transparent-header.is-scrolled {
  background: rgba(247, 247, 245, 0.82);
  box-shadow: 0 1px 0 rgba(231, 234, 240, 0.72);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
}
.transparent-toolbar {
  --background: transparent;
  --border-color: transparent;
  --box-shadow: none;
  --min-height: 52px;
  background: transparent;
}
.feed-content {
  --background:
    radial-gradient(circle at 86% -28px, rgba(200, 255, 0, 0.24) 0, rgba(200, 255, 0, 0.12) 30%, rgba(200, 255, 0, 0) 58%),
    radial-gradient(circle at -18% 78px, rgba(255, 77, 148, 0.14) 0, rgba(255, 77, 148, 0.08) 34%, rgba(255, 77, 148, 0) 62%), var(--bg);
}
.brand {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.icon-btn {
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--fg);
  display: grid;
  place-items: center;
  position: relative;
}
.noti-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--hold-pink);
  border: 2px solid var(--bg);
  box-sizing: content-box;
}

/* ── Greeting ───────────────────────────────────── */
.hero {
  padding: calc(var(--ion-safe-area-top) + 68px) 20px 18px;
  position: relative;
  overflow: hidden;
}
.glow {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.3;
  pointer-events: none;
}
.glow-lime {
  background: var(--hold-lime);
  top: -120px;
  right: -120px;
}
.glow-pink {
  background: var(--hold-pink);
  top: 40px;
  left: -160px;
}

.greeting {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.08;
  margin: 0;
  position: relative;
}
/* .micro-label type — canonical in global.css; keep only local layout */
.micro-label {
  margin-top: 10px;
  position: relative;
}

/* ── States ─────────────────────────────────────── */
.feed-skeleton {
  padding: 8px 16px;
}

/* ── Video grid (uniform 9:16) ──────────────────── */
.video-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 8px 16px 120px;
}
/* 데스크탑: 피드를 넓은 화면에 펼치지 않고 중앙 컬럼으로 모은다.
   헤더(hero)·스켈레톤·그리드를 같은 폭으로 정렬하고, 카드는 모바일과
   동일하게 2열을 유지해 세로 영상 카드가 과도하게 커지지 않게 한다. */
@media (min-width: 768px) {
  .hero,
  .feed-skeleton,
  .video-grid {
    max-width: var(--content-max);
    margin-left: auto;
    margin-right: auto;
  }
  .video-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}
.video-grid-card {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: var(--surface);
  border-radius: var(--r-card, 16px);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  text-align: left;
  color: var(--fg);
  font-family: var(--font-sans);
  transition: transform var(--dur-fast) var(--ease-state);
}
.video-grid-card:active {
  transform: scale(0.98);
}

.thumb-wrap {
  position: relative;
  aspect-ratio: 9 / 16;
}
.thumb-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: var(--hold-lime);
}
.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
  color: #fff;
  padding-left: 2px;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.placeholder-grade {
  font-size: 28px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.55);
  letter-spacing: -0.02em;
}
.grade-chip {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: calc(100% - 16px);
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  border-radius: 5px;
  line-height: 1;
  padding: 5px 8px;
  /* color: rgba(21, 21, 21, 0.82); */
  /* border: 1px solid rgba(231, 234, 240, 0.9); */
  /* border-radius: 999px; */
  /* background: rgba(255, 255, 255, 0.88); */
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 1px 3px rgba(20, 22, 28, 0.1);
  backdrop-filter: saturate(140%) blur(6px);
  -webkit-backdrop-filter: saturate(140%) blur(6px);
}
.grade-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border: 1px solid rgba(21, 21, 21, 0.1);
  border-radius: 50%;
}
.dur-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 7px;
  border-radius: 999px;
}

.card-meta {
  padding: 10px 12px 12px;
}
.card-author {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.card-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}
.card-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-avatar-initial {
  font-size: 10px;
  font-weight: 700;
}
.card-nickname {
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.005em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-stats {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted);
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
</style>
