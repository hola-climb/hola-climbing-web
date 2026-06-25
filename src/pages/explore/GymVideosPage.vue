<script setup lang="ts">
import { ref, onMounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonButtons, IonBackButton, IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import { gymService } from "@/services/gym";
import VideoThumbnail from "@/components/video/VideoThumbnail.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import type { FeedVideo, GymGrade } from "@/types/api";

const route = useRoute();
const router = useRouter();
const gymId = route.params.id as string;
const gymName = ref("");

const videos = ref<FeedVideo[]>([]);
const isLoading = ref(true);
const page = ref(0);
const hasNext = ref(false);
const hasScrolled = ref(false);

// Grade filter
const grades = ref<GymGrade[]>([]);
const selectedGradeId = ref<number | null>(null);

function handleScroll(event: CustomEvent<{ scrollTop: number }>) {
  hasScrolled.value = event.detail.scrollTop > 12;
}

function goDetail(id: string) {
  router.push(`/videos/${id}`);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function loadVideos(reset = false) {
  if (reset) {
    page.value = 0;
    videos.value = [];
  }
  isLoading.value = reset || page.value === 0;
  try {
    const { data } = await gymService.getGymVideos(gymId, {
      page: page.value,
      size: 12,
      gymGradeId: selectedGradeId.value ?? undefined,
    });
    if (reset || page.value === 0) {
      videos.value = data.content;
    } else {
      videos.value.push(...data.content);
    }
    hasNext.value = data.hasNext;
  } catch {
    // silent
  } finally {
    isLoading.value = false;
  }
}

async function onInfiniteScroll(event: CustomEvent) {
  if (!hasNext.value) {
    (event.target as HTMLIonInfiniteScrollElement).complete();
    return;
  }
  page.value++;
  await loadVideos();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

function selectGrade(gradeId: number | null) {
  if (selectedGradeId.value === gradeId) return;
  selectedGradeId.value = gradeId;
  loadVideos(true);
}

async function handleRefresh(event: CustomEvent) {
  await loadVideos(true);
  (event.target as HTMLIonRefresherElement).complete();
}

onMounted(async () => {
  const [gymRes, gradeRes] = await Promise.allSettled([gymService.getGym(gymId), gymService.getGrades(gymId)]);
  if (gymRes.status === "fulfilled") gymName.value = gymRes.value.data.name;
  if (gradeRes.status === "fulfilled") grades.value = gradeRes.value.data;
  await loadVideos(true);
});
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border transparent-header" :class="{ 'is-scrolled': hasScrolled }">
      <IonToolbar class="transparent-toolbar">
        <IonButtons slot="start">
          <IonBackButton :default-href="`/gyms/${gymId}`" text="" class="back-btn" aria-label="뒤로" />
        </IonButtons>
        <div class="toolbar-title">{{ gymName || "암장 영상" }}</div>

        <!-- 난이도 필터 -->
        <div v-if="grades.length" class="grade-filter" slot="end">
          <select
            class="grade-select"
            :value="selectedGradeId ?? ''"
            aria-label="난이도 필터"
            @change="selectGrade(($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value))"
          >
            <option value="">전체</option>
            <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent fullscreen class="page-content" :scroll-events="true" @ion-scroll="handleScroll">
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div class="page-inner page-padding">
        <LoadingState v-if="isLoading" variant="grid" :count="6" thumb-aspect="1/1" label="영상을 불러오는 중" />

        <EmptyState v-else-if="videos.length === 0" hold="cyan" title="아직 영상이 없어요" description="이 암장이나 난이도의 영상이 없어요." />

        <div v-else class="video-grid reveal-on-load">
          <button v-for="video in videos" :key="video.id" class="video-item" :aria-label="`${video.title ?? '제목 없음'} 영상 보기`" @click="goDetail(video.id)">
            <div class="thumb-wrap">
              <VideoThumbnail :title="video.title" :thumbnail-url="video.thumbnailUrl" :grade="video.grade" :alt="`${video.title ?? '클라이밍 영상'} 썸네일`" />
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
      </div>

      <IonInfiniteScroll :disabled="!hasNext" @ion-infinite="onInfiniteScroll">
        <IonInfiniteScrollContent loading-spinner="crescent" />
      </IonInfiniteScroll>
    </IonContent>
  </IonPage>
</template>

<style scoped>
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
}
.back-btn {
  --color: var(--fg);
  --icon-font-size: 22px;
}
.toolbar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--fs-body);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--fg);
  pointer-events: none;
  white-space: nowrap;
}

/* 난이도 필터 */
.grade-filter {
  padding-right: 16px;
}
.grade-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: var(--r-chip);
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-sans);
  color: var(--fg);
  cursor: pointer;
}

/* 콘텐츠 */
.page-content {
  --background: var(--bg);
}
.page-inner {
  padding-top: calc(var(--ion-safe-area-top) + 64px);
  padding-bottom: 40px;
}

/* 그리드 */
.video-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 600px) {
  .video-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 900px) {
  .video-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
@media (min-width: 1200px) {
  .video-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

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
.video-item:active {
  transform: scale(0.97);
}

.thumb-wrap {
  aspect-ratio: 1 / 1;
  width: 100%;
  overflow: hidden;
  border-radius: var(--r-card);
  background: var(--surface-soft);
}

.item-info {
  padding: 8px 2px 4px;
}
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
.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.meta-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted);
}
.meta-date {
  font-size: 11px;
  color: var(--fg-muted);
  margin-left: auto;
}
</style>
