<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent } from "@ionic/vue";
import { useRouter } from "vue-router";
import { useGymStore } from "@/stores/gym";
import { useUIStore } from "@/stores/ui";
import { gymService } from "@/services/gym";
import { useMediaQuery } from "@/composables/useMediaQuery";
import GymCard from "@/components/gym/GymCard.vue";
import GymDetailView from "./GymDetailView.vue";
import type { Gym } from "@/types/api";

const router = useRouter();
const gymStore = useGymStore();
const uiStore = useUIStore();
const isDesktop = useMediaQuery("(min-width: 1024px)");

const searchQuery = ref("");
const currentPage = ref(0);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// Desktop two-pane: selected gym shown in the right pane
const selectedGymId = ref<string | null>(null);

function openGym(gym: Gym) {
  if (isDesktop.value) {
    selectedGymId.value = gym.id;
  } else {
    router.push(`/gyms/${gym.id}`);
  }
}

// Location state
const nearbyGyms = ref<Gym[]>([]);
const nearestGym = ref<Gym | null>(null);
const isLocating = ref(false);

const displayGyms = computed(() => (nearbyGyms.value.length ? nearbyGyms.value : gymStore.gyms));
const isNearbyMode = computed(() => nearbyGyms.value.length > 0);

onMounted(() => loadGyms(true));

async function loadGyms(reset = false) {
  if (reset) currentPage.value = 0;
  try {
    await gymStore.search({ keyword: searchQuery.value || undefined, page: currentPage.value });
    if (!reset) currentPage.value++;
  } catch {
    uiStore.showToast("암장 목록을 불러올 수 없어요.", "danger");
  }
}

function handleSearch() {
  nearbyGyms.value = [];
  nearestGym.value = null;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadGyms(true), 300);
}

function handleSearchEnter() {
  if (searchTimer) clearTimeout(searchTimer);
  nearbyGyms.value = [];
  nearestGym.value = null;
  loadGyms(true);
}

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

async function handleRefresh(event: CustomEvent) {
  nearbyGyms.value = [];
  nearestGym.value = null;
  await loadGyms(true);
  (event.target as HTMLIonRefresherElement).complete();
}

async function handleInfinite(event: CustomEvent) {
  currentPage.value++;
  await loadGyms();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

async function handleLocate() {
  if (!navigator.geolocation) {
    uiStore.showToast("이 기기에서 위치 서비스를 지원하지 않아요.", "warning");
    return;
  }
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { data } = await gymService.getNearby({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radius: 5,
          size: 20,
        });
        nearbyGyms.value = data;
        nearestGym.value = data[0] ?? null;
        searchQuery.value = "";
      } catch {
        uiStore.showToast("주변 암장을 불러오지 못했어요.", "danger");
      } finally {
        isLocating.value = false;
      }
    },
    (err) => {
      isLocating.value = false;
      if (err.code === err.PERMISSION_DENIED) {
        uiStore.showToast("위치 권한을 허용해주세요.", "warning");
      } else {
        uiStore.showToast("위치를 가져오지 못했어요.", "danger");
      }
    },
    { timeout: 8000 },
  );
}
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <span class="brand-label">EXPLORE</span>
          <!-- Pin icon -->
          <button class="icon-btn" :class="{ locating: isLocating }" aria-label="내 위치" @click="handleLocate">
            <IonSpinner v-if="isLocating" name="crescent" style="width: 18px; height: 18px" />
            <svg
              v-else
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              :stroke="isNearbyMode ? 'var(--hold-lime)' : 'currentColor'"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            </svg>
          </button>
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div class="explore-layout">
      <div class="list-pane">
      <!-- Hero heading -->
      <div class="explore-hero page-padding">
        <h1 class="hero-title">{{ isNearbyMode ? "내 주변 암장" : "암장 탐색" }}</h1>
        <div class="micro-label">
          <span v-if="isNearbyMode">반경 5km · {{ nearbyGyms.length }}개</span>
          <span v-else>{{ gymStore.gyms.length }}개의 암장</span>
        </div>
      </div>

      <!-- Search bar -->
      <div class="search-wrap page-padding">
        <div class="search-bar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true">
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3" />
          </svg>
          <input v-model="searchQuery" type="search" placeholder="암장 이름 검색" class="search-input" aria-label="암장 검색" @input="handleSearch" @keydown.enter="handleSearchEnter" />
        </div>
      </div>

      <!-- Map preview card -->
      <div class="map-section page-padding">
        <div class="map-card hola-card">
          <!-- SVG map backdrop -->
          <svg viewBox="0 0 400 180" class="map-svg" aria-hidden="true" preserveAspectRatio="none">
            <rect width="400" height="180" fill="#EEF1F4" />
            <path d="M0 70 L400 90" stroke="#DDE2E8" stroke-width="6" />
            <path d="M0 120 L400 110" stroke="#DDE2E8" stroke-width="6" />
            <path d="M120 0 L130 180" stroke="#DDE2E8" stroke-width="6" />
            <path d="M280 0 L260 180" stroke="#DDE2E8" stroke-width="6" />
            <rect x="40" y="20" width="60" height="40" rx="6" fill="#E4E8EE" />
            <rect x="160" y="30" width="80" height="36" rx="6" fill="#E4E8EE" />
            <rect x="300" y="20" width="60" height="50" rx="6" fill="#E4E8EE" />
            <rect x="20" y="120" width="80" height="40" rx="6" fill="#E4E8EE" />
            <rect x="190" y="120" width="50" height="44" rx="6" fill="#E4E8EE" />
            <rect x="300" y="130" width="70" height="34" rx="6" fill="#E4E8EE" />
            <!-- Pins -->
            <circle cx="180" cy="92" r="14" fill="#FF4D94" opacity="0.18" />
            <circle cx="180" cy="92" r="6" fill="#FF4D94" />
            <circle cx="290" cy="60" r="6" fill="#22D3EE" />
            <circle cx="90" cy="140" r="6" fill="#C8FF00" />
          </svg>
          <!-- Nearest gym overlay -->
          <div v-if="nearestGym" class="map-pill" role="button" tabindex="0" :aria-label="`${nearestGym.name} 상세 보기`" @click="openGym(nearestGym)">
            <div>
              <div class="micro-label">NEAREST</div>
              <div class="map-gym-name">
                {{ nearestGym.name }}
                <span v-if="nearestGym.distanceKm != null">· {{ nearestGym.distanceKm.toFixed(1) }}km</span>
              </div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </div>
          <div v-else class="map-pill map-pill-hint" aria-label="위치 버튼 안내">
            <div>
              <div class="micro-label">내 주변</div>
              <div class="map-gym-name">핀 버튼으로 근처 암장 검색</div>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--fg-muted)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Gym list -->
      <div class="gym-list page-padding">
        <div class="section-header">
          <div class="section-title">{{ isNearbyMode ? "주변 암장" : "모든 암장" }}</div>
          <button
            v-if="isNearbyMode"
            class="sort-btn"
            @click="
              nearbyGyms = [];
              nearestGym = null;
              loadGyms(true);
            "
          >
            전체 보기
          </button>
        </div>

        <div v-if="gymStore.isLoading && !displayGyms.length" class="loading-center">
          <IonSpinner name="dots" />
        </div>

        <GymCard
          v-for="gym in displayGyms"
          :key="gym.id"
          :gym="gym"
          :selectable="isDesktop"
          :class="{ 'is-selected': isDesktop && selectedGymId === gym.id }"
          @select="openGym"
        />

        <div v-if="!gymStore.isLoading && !gymStore.gyms.length" class="empty-state">
          <p>검색 결과가 없어요.</p>
        </div>
      </div>

      <IonInfiniteScroll :disabled="gymStore.isLoading" @ion-infinite="handleInfinite">
        <IonInfiniteScrollContent loading-spinner="dots" />
      </IonInfiniteScroll>
      </div>
      <!-- end .list-pane -->

      <!-- Desktop detail pane -->
      <div v-if="isDesktop" class="detail-pane">
        <GymDetailView v-if="selectedGymId" :key="selectedGymId" :gym-id="selectedGymId" />
        <div v-else class="detail-placeholder">
          <p class="ph-title">암장을 선택하세요</p>
          <p class="ph-sub">왼쪽 목록에서 암장을 누르면 상세 정보를 볼 수 있어요.</p>
        </div>
      </div>
      </div>
      <!-- end .explore-layout -->
    </IonContent>
  </IonPage>
</template>

<style scoped>
/* ── Desktop two-pane ───────────────────────────── */
@media (min-width: 1024px) {
  .explore-layout {
    display: flex;
    height: 100%;
  }
  .list-pane {
    width: 400px;
    flex-shrink: 0;
    overflow-y: auto;
    height: 100%;
  }
  .detail-pane {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    height: 100%;
    border-left: 1px solid var(--border);
  }
  .detail-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    text-align: center;
    padding: 0 24px;
  }
  .ph-title { font-size: 16px; font-weight: 700; margin: 0; }
  .ph-sub { font-size: 13px; color: var(--fg-muted); margin: 0; }
  .is-selected {
    outline: 2px solid var(--hold-dark);
    outline-offset: -2px;
    border-radius: var(--r-card);
  }
}

/* ── Toolbar ────────────────────────────────────── */
.toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 52px;
}
.brand-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.icon-btn {
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--fg);
  display: grid;
  place-items: center;
}

/* ── Hero ───────────────────────────────────────── */
.explore-hero {
  padding-top: 16px;
  padding-bottom: 8px;
}
.hero-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.05;
  margin: 0;
}
.micro-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-top: 6px;
}

/* ── Search ─────────────────────────────────────── */
.search-wrap {
  padding-top: 10px;
  padding-bottom: 4px;
}
.search-bar {
  height: 48px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-icon {
  color: var(--fg-muted);
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--fg);
  outline: none;
}
.search-input::placeholder {
  color: var(--fg-muted);
}

/* ── Map card ───────────────────────────────────── */
.map-section {
  padding-top: 16px;
}
.map-card {
  padding: 0;
  height: 180px;
  overflow: hidden;
}
.map-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.map-pill {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.map-gym-name {
  font-size: 14px;
  font-weight: 700;
  margin-top: 2px;
}
.map-pill-hint {
  cursor: default;
}
.map-pill-hint .map-gym-name {
  color: var(--fg-muted);
  font-weight: 500;
}

/* ── Gym list ───────────────────────────────────── */
.gym-list {
  padding-top: 24px;
  padding-bottom: 120px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 12px;
}
.section-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.sort-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-muted);
  padding: 4px 0;
}

.loading-center {
  display: grid;
  place-items: center;
  padding: 60px 0;
}
.empty-state {
  text-align: center;
  padding: 60px 0;
  color: var(--fg-muted);
}
</style>
