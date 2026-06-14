<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { onMounted, reactive, computed, ref, watch } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner } from "@ionic/vue";
import type { InfiniteScrollCustomEvent } from "@ionic/vue";
import { useRouter } from "vue-router";
import { useVideoStore } from "@/stores/video";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { gradeColor } from "@/utils/gradeColor";
import VideoThumbnail from "@/components/video/VideoThumbnail.vue";

const router = useRouter();
const videoStore = useVideoStore();
const authStore = useAuthStore();
const uiStore = useUIStore();

const brokenThumbs = reactive<Set<string>>(new Set());
const hasScrolled = ref(false);

const greetingHour = new Date().getHours();
const greeting = greetingHour < 12 ? "좋은 아침이에요" : greetingHour < 18 ? "오늘도 높이 올라요" : "오늘 하루도 수고했어요";

const placeholderHeights = [150, 200, 175, 225, 190];

const showInitialLoading = computed(() => videoStore.isLoadingFeed && videoStore.feedVideos.length === 0);

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
          <button class="icon-btn" @click="router.push('/my/notifications')" aria-label="알림">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />
            </svg>
            <span v-if="uiStore.unreadCount > 0" class="noti-badge">{{ uiStore.unreadCount > 99 ? "99+" : uiStore.unreadCount }}</span>
          </button>
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent fullscreen class="feed-content" :scroll-events="true" @ion-scroll="handleScroll">
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <!-- Greeting hero -->
      <div class="hero">
        <div class="glow glow-lime" aria-hidden="true" />
        <div class="glow glow-pink" aria-hidden="true" />
        <h1 class="greeting">
          <span v-if="authStore.user" v-html="`${greeting},<br/>${authStore.user.nickname}.`" />
          <span v-else>올라에 온 걸 환영해요.</span>
        </h1>
        <div class="micro-label">오늘의 추천 클립</div>
      </div>

      <!-- Initial loading -->
      <div v-if="showInitialLoading" class="state-center">
        <IonSpinner name="crescent" />
      </div>

      <!-- Empty -->
      <div v-else-if="videoStore.feedVideos.length === 0" class="state-center empty">
        <p class="empty-title">추천할 클립이 아직 없어요</p>
        <p class="empty-sub">팔로우를 늘리거나 영상을 업로드해 보세요.</p>
      </div>

      <!-- Masonry grid (2-column) -->
      <div v-else class="masonry">
        <button v-for="(video, i) in videoStore.feedVideos" :key="video.id" class="masonry-card" @click="openVideo(video.id)" :aria-label="video.title ?? '추천 클립'">
          <!-- Thumbnail or placeholder -->
          <div class="thumb-wrap">
            <img
              v-if="video.thumbnailUrl && !brokenThumbs.has(video.id)"
              :src="video.thumbnailUrl"
              :alt="video.title ?? '클라이밍 클립 썸네일'"
              class="thumb-img"
              loading="lazy"
              @error="onThumbError(video.id)"
            />
            <div v-else class="thumb-placeholder" :style="{ height: placeholderHeights[i % placeholderHeights.length] + 'px', background: `var(--hold-lime)` }">
              <span class="placeholder-grade">{{ "HOLA" }}</span>
            </div>

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
            <div v-if="video.title" class="card-title">{{ video.title }}</div>
            <div class="card-stats">
              <span class="stat">♥ {{ video.likeCount }}</span>
              <span class="stat">▷ {{ video.viewCount }}</span>
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
.noti-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--hold-pink);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
  text-align: center;
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
.micro-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-top: 10px;
  position: relative;
}

/* ── States ─────────────────────────────────────── */
.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 56px 24px;
  text-align: center;
}
.empty-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}
.empty-sub {
  font-size: 13px;
  color: var(--fg-muted);
  margin: 0;
}

/* ── Masonry (CSS columns) ──────────────────────── */
.masonry {
  column-count: 2;
  column-gap: 12px;
  padding: 8px 16px 120px;
}
@media (min-width: 768px) {
  .masonry {
    column-count: 3;
  }
}
@media (min-width: 1024px) {
  .masonry {
    column-count: 4;
    column-gap: 16px;
  }
}
@media (min-width: 1440px) {
  .masonry {
    column-count: 5;
    max-width: 1600px;
    margin: 0 auto;
  }
}
.masonry-card {
  display: block;
  width: 100%;
  break-inside: avoid;
  margin-bottom: 12px;
  padding: 0;
  border: none;
  background: var(--surface);
  border-radius: var(--r-card, 16px);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  text-align: left;
  transition: transform var(--dur-fast) var(--ease-state);
}
.masonry-card:active {
  transform: scale(0.98);
}

.thumb-wrap {
  position: relative;
}
.thumb-img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
}
.thumb-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
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
</style>
