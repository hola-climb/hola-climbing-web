<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent } from "@ionic/vue";
import { useRouter } from "vue-router";
import { useGymStore } from "@/stores/gym";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { gymService } from "@/services/gym";
import { authService } from "@/services/auth";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { useGeolocation } from "@/composables/useGeolocation";
import GymCard from "@/components/gym/GymCard.vue";
import GymMap from "@/components/gym/GymMap.vue";
import GymDetailView from "./GymDetailView.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import type { Gym, RecommendedGym } from "@/types/api";

const router = useRouter();
const gymStore = useGymStore();
const uiStore = useUIStore();
const authStore = useAuthStore();
const isDesktop = useMediaQuery("(min-width: 1024px)");
const { locate } = useGeolocation();

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

// 데스크톱 2-pane에서 상세(채팅 포함)를 열어둔 채 창을 좁히면 detail-pane이
// v-if로 언마운트된다. 모바일 레이아웃으로 전환되는 순간 선택된 암장을 상세
// 라우트로 넘겨 상세 화면을 유지한다. 열려 있던 채팅은 chatStore가 보존하므로
// 새로 마운트된 상세 뷰에서 끊김 없이 그대로 이어진다.
watch(isDesktop, (desktop) => {
  if (!desktop && selectedGymId.value) {
    const id = selectedGymId.value;
    selectedGymId.value = null;
    router.push(`/gyms/${id}`);
  }
});

// Location state
const nearbyGyms = ref<Gym[]>([]);
const nearestGym = ref<Gym | null>(null);
const recommendedGyms = ref<RecommendedGym[]>([]);
const isLocating = ref(false);
// 위치서비스 활성화 시 현재 위치 좌표 — 지도 포커스를 현재 위치로 이동시킨다
const userCoords = ref<{ lat: number; lng: number } | null>(null);
// 캐러셀에서 현재 포커스된 암장 id — 지도 핀 강조 + 지도 중심 이동에 쓰인다
const carouselActiveId = ref<string | null>(null);

// 실제 카카오맵 사용 여부. VITE_KAKAO_MAP_KEY가 비어 있으면 자동으로 mock 지도로
// 폴백한다. mock으로 손쉽게 되돌리려면 키를 비우거나 아래를 false로 둔다.
const useRealMap = !!import.meta.env.VITE_KAKAO_MAP_KEY;

// 로그인 유저용 — 위치기반서비스 약관 미동의 시 설정 유도 다이얼로그
const showLocationConsent = ref(false);

// 비로그인 유저용 — 위치 일시 이용·미저장 1회성 안내
const LOCATION_NOTICE_KEY = "hola_location_notice_ack";
const showLocationNotice = ref(false);

function sortFavoritesFirst<T extends { isFavorited: boolean }>(list: T[]): T[] {
  return [...list].sort((a, b) => (b.isFavorited ? 1 : 0) - (a.isFavorited ? 1 : 0));
}

const displayGyms = computed(() => sortFavoritesFirst(nearbyGyms.value.length ? nearbyGyms.value : gymStore.gyms));
const isNearbyMode = computed(() => nearbyGyms.value.length > 0);
// 추천 섹션은 위치를 한 번이라도 획득(근처 모드)했을 때만 노출
const showRecoSection = computed(() => isNearbyMode.value);
// 이름 검색 중에는 지도(위치 기반 탐색용)를 숨겨 검색 결과를 바로 노출한다
const isSearching = computed(() => searchQuery.value.trim().length > 0);

// 지도에 넘길 암장 목록 — 목록 API에 없는 lat/lng를 좌표 캐시에서 보강한다.
// coordsVersion에 의존시켜 캐시가 채워질 때마다 핀이 점진적으로 나타나게 한다.
const mapGyms = computed<Gym[]>(() => {
  void gymStore.coordsVersion;
  return displayGyms.value.map((g) => {
    if (g.latitude && g.longitude) return g;
    const c = gymStore.getCoords(g.id);
    return c ? { ...g, latitude: c.lat, longitude: c.lng } : g;
  });
});

// 좌표가 비어 있는 암장은 상세 엔드포인트에서 좌표를 보강 요청한다.
watch(
  displayGyms,
  (list) => {
    if (useRealMap && list.length) gymStore.ensureCoords(list);
  },
  { immediate: true },
);

// 지도 포커스: 근처 모드 → 캐러셀 활성 암장 / 없으면 현재 위치
//              전체 모드 → 리스트 최상단 암장
const mapCenter = computed(() => {
  if (isNearbyMode.value) {
    if (carouselActiveId.value) {
      const g = mapGyms.value.find((x) => x.id === carouselActiveId.value);
      if (g?.latitude && g?.longitude) return { lat: g.latitude, lng: g.longitude };
    }
    return userCoords.value;
  }
  const g = mapGyms.value.find((x) => x.latitude && x.longitude);
  return g ? { lat: g.latitude, lng: g.longitude } : null;
});

/** 근처/추천 상태 초기화 — 검색·새로고침·전체보기 시 호출 */
function resetLocation() {
  nearbyGyms.value = [];
  nearestGym.value = null;
  recommendedGyms.value = [];
  userCoords.value = null;
  carouselActiveId.value = null;
}

/** 캐러셀 아이템 탭: 해당 핀으로 지도 포커스만 이동 */
function handleCarouselTap(gym: Gym) {
  carouselActiveId.value = gym.id;
}

/** 좌표를 받아 근처 암장·추천을 로드하는 공통 로직 (수동·자동 위치 모두 사용) */
async function fetchNearby(coords: { lat: number; lng: number }): Promise<void> {
  userCoords.value = coords;
  const { data } = await gymService.getNearby({ lat: coords.lat, lng: coords.lng, radius: 3, size: 20 });
  nearbyGyms.value = data;
  nearestGym.value = data[0] ?? null;
  carouselActiveId.value = data[0]?.id ?? null;
  searchQuery.value = "";
  if (authStore.isAuthenticated) {
    try {
      const { data: reco } = await gymService.getRecommendations({ lat: coords.lat, lng: coords.lng, radius: 5, size: 20 });
      recommendedGyms.value = reco;
    } catch {
      recommendedGyms.value = [];
    }
  }
}

/** 마운트 시 위치 동의 사용자에게 자동으로 내 주변 모드를 적용한다. 실패는 무시. */
async function tryAutoLocate(): Promise<void> {
  if (!(await hasLocationConsent())) return;
  isLocating.value = true;
  try {
    const coords = await locate();
    if (!coords) return;
    await fetchNearby(coords);
  } catch {
    /* 자동 위치 실패는 무시 — 전체 목록 유지 */
  } finally {
    isLocating.value = false;
  }
}

onMounted(async () => {
  await loadGyms(true);
  tryAutoLocate(); // 위치 동의 사용자는 자동으로 내 주변 모드
});

async function loadGyms(reset = false) {
  if (reset) currentPage.value = 0;
  try {
    await gymStore.search({ keyword: searchQuery.value.trim() || undefined, page: currentPage.value });
    if (!reset) currentPage.value++;
  } catch {
    uiStore.showToast("암장 목록을 불러올 수 없어요.", "danger");
  }
}

function handleSearch() {
  resetLocation();
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadGyms(true), 300);
}

function handleSearchEnter() {
  if (searchTimer) clearTimeout(searchTimer);
  resetLocation();
  loadGyms(true);
}

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

async function handleRefresh(event: CustomEvent) {
  resetLocation();
  await loadGyms(true);
  (event.target as HTMLIonRefresherElement).complete();
}

async function handleInfinite(event: CustomEvent) {
  currentPage.value++;
  await loadGyms();
  (event.target as HTMLIonInfiniteScrollElement).complete();
}

/** 로그인 유저의 위치기반서비스(type: 'location') 약관 동의 여부.
 *  비로그인은 계정별 동의 레코드가 없으므로 false — 마운트 자동 위치(tryAutoLocate)를 막는다.
 *  비로그인 수동 탐색은 handleLocate에서 익명·일시 위치 흐름으로 따로 처리한다. */
async function hasLocationConsent(): Promise<boolean> {
  if (!authStore.isAuthenticated) return false;
  try {
    const { data } = await authService.getAgreementStatus();
    const locationTerm = data.terms.find((t) => t.type === "location");
    return !!locationTerm?.agreed;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    return false;
  }
}

function goToLocationSettings() {
  showLocationConsent.value = false;
  router.push("/my/terms");
}

/** 실제 위치 측정 + 근처 암장 로드 (OS 위치 권한 프롬프트는 locate()가 담당). */
async function runLocate() {
  isLocating.value = true;
  try {
    const coords = await locate();
    if (!coords) {
      uiStore.showToast("위치 권한을 허용하면 주변 암장을 찾아드려요.", "warning");
      return;
    }
    await fetchNearby(coords);
  } catch {
    uiStore.showToast("주변 암장을 불러오지 못했어요.", "danger");
  } finally {
    isLocating.value = false;
  }
}

/** 비로그인 1회성 안내 확인 → 좌표 일시 이용 동의로 간주하고 진행. */
function acceptLocationNotice() {
  localStorage.setItem(LOCATION_NOTICE_KEY, "1");
  showLocationNotice.value = false;
  runLocate();
}

async function handleLocate() {
  // 이미 근처 모드이면 토글로 전체 목록으로 돌아간다
  if (isNearbyMode.value) {
    resetLocation();
    loadGyms(true);
    return;
  }

  // 로그인 유저: 위치가 계정에 연결되는 개인위치정보 → location 약관 동의 확인.
  if (authStore.isAuthenticated) {
    if (!(await hasLocationConsent())) {
      showLocationConsent.value = true;
      return;
    }
    await runLocate();
    return;
  }

  // 비로그인: 익명·일시 위치 사용 → 서버 약관 동의 불필요(OS 권한으로 충분).
  // 최초 1회만 "일시 이용·미저장" 안내 후 진행한다.
  if (!localStorage.getItem(LOCATION_NOTICE_KEY)) {
    showLocationNotice.value = true;
    return;
  }
  await runLocate();
}
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <span class="brand-label">EXPLORE</span>
          <!-- Pin icon -->
          <button class="icon-btn" :class="{ locating: isLocating, active: isNearbyMode }" :aria-label="isNearbyMode ? '내 위치 (켜짐)' : '내 위치'" :aria-pressed="isNearbyMode" @click="handleLocate">
            <IonSpinner v-if="isLocating" name="crescent" class="btn-spinner" />
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" :stroke="isNearbyMode ? '#AAEA00' : 'currentColor'" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
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
              <span v-if="isNearbyMode">반경 3km · 가까운 순 · {{ nearbyGyms.length }}개</span>
              <span v-else>{{ gymStore.gyms.length }}개의 암장</span>
            </div>
          </div>

          <!-- Search bar -->
          <div class="search-wrap page-padding">
            <div class="search-bar">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="search-icon"
                aria-hidden="true"
              >
                <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3" />
              </svg>
              <input v-model="searchQuery" type="search" placeholder="암장 이름 검색" class="search-input" aria-label="암장 검색" @input="handleSearch" @keydown.enter="handleSearchEnter" />
            </div>
          </div>

          <!-- Map preview card (이름 검색 중에는 숨김) -->
          <div v-if="!isSearching" class="map-section page-padding" :class="{ 'nearby-active': isNearbyMode }">
            <div class="map-card hola-card">
              <!-- 실제 카카오맵 (VITE_KAKAO_MAP_KEY 설정 시) -->
              <GymMap v-if="useRealMap" :gyms="mapGyms" :center="mapCenter" :user-location="userCoords" :selected-id="carouselActiveId" @select="openGym" />
              <!-- SVG map backdrop (mock · 키 미설정 시 폴백, 손쉽게 되돌리기용) -->
              <svg v-else viewBox="0 0 400 180" class="map-svg" aria-hidden="true" preserveAspectRatio="none">
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
              <!-- Nearby gyms carousel (근처 모드) -->
              <div v-if="nearbyGyms.length" class="map-carousel-wrap" aria-label="주변 암장 목록">
                <div class="map-carousel" role="list">
                  <button
                    v-for="gym in nearbyGyms"
                    :key="gym.id"
                    class="carousel-item"
                    :class="{ active: carouselActiveId === gym.id }"
                    role="listitem"
                    :aria-label="`${gym.name}${gym.distanceKm !== null ? `, ${gym.distanceKm.toFixed(1)}km` : ''}`"
                    :aria-pressed="carouselActiveId === gym.id"
                    @click="handleCarouselTap(gym)"
                    @mouseenter="carouselActiveId = gym.id"
                  >
                    <span v-if="gym.distanceKm !== null" class="carousel-dist">{{ gym.distanceKm.toFixed(1) }}km</span>
                    <span class="carousel-name">{{ gym.name }}</span>
                    <svg
                      v-if="carouselActiveId === gym.id"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                      class="carousel-arrow"
                    >
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <!-- Hint pill (위치 미설정) -->
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

          <!-- 맞춤 추천 (위치 획득 후 노출) -->
          <div v-if="showRecoSection" class="reco-section page-padding">
            <div class="section-header">
              <div class="section-title">맞춤 추천</div>
            </div>

            <!-- 로그인 + 추천 결과 -->
            <div v-if="authStore.isAuthenticated && recommendedGyms.length" class="gym-results reveal-on-load">
              <GymCard
                v-for="gym in recommendedGyms"
                :key="`reco-${gym.id}`"
                :gym="gym"
                :source="gym.source"
                :selectable="isDesktop"
                :class="{ 'is-selected': isDesktop && selectedGymId === gym.id }"
                @select="openGym"
              />
            </div>

            <!-- 로그인했지만 추천 없음 -->
            <p v-else-if="authStore.isAuthenticated" class="reco-hint">아직 추천할 암장이 부족해요. 영상을 올리면 스타일에 맞는 암장을 찾아드려요.</p>

            <!-- 비로그인 CTA -->
            <button v-else class="reco-cta hola-card" @click="uiStore.openLoginSheet()">
              <div>
                <div class="micro-label">맞춤 추천</div>
                <div class="reco-cta-title">로그인하면 내 스타일에 맞는 암장을 추천해드려요</div>
              </div>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Gym list -->
          <div class="gym-list page-padding">
            <div class="section-header">
              <div class="section-title">{{ isNearbyMode ? "주변 암장" : "모든 암장" }}</div>
              <button
                v-if="isNearbyMode"
                class="sort-btn"
                @click="
                  resetLocation();
                  loadGyms(true);
                "
              >
                전체 보기
              </button>
            </div>

            <LoadingState v-if="gymStore.isLoading && !displayGyms.length" variant="list" :count="5" label="암장을 불러오는 중" />

            <div v-if="displayGyms.length" class="gym-results reveal-on-load">
              <GymCard v-for="gym in displayGyms" :key="gym.id" :gym="gym" :selectable="isDesktop" :class="{ 'is-selected': isDesktop && selectedGymId === gym.id }" @select="openGym" />
            </div>

            <EmptyState v-if="!gymStore.isLoading && !gymStore.gyms.length" compact hold="orange" title="검색 결과가 없어요" description="다른 이름으로 검색하거나 위치로 찾아보세요." />
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

      <!-- 로그인 유저: 위치기반서비스 약관 미동의 안내 -->
      <ConfirmDialog
        :open="showLocationConsent"
        title="위치 서비스 동의가 필요해요"
        message="내 주변 암장을 찾으려면 위치기반서비스 이용약관에 동의해야 해요. 설정에서 동의할 수 있어요."
        confirm-text="설정으로 이동"
        cancel-text="닫기"
        @confirm="goToLocationSettings"
        @cancel="showLocationConsent = false"
      />

      <!-- 비로그인 유저: 위치 일시 이용 안내(1회성) -->
      <ConfirmDialog
        :open="showLocationNotice"
        title="내 주변 암장을 찾을게요"
        message="현재 위치는 가까운 암장을 찾는 데에만 일시적으로 사용됩니다."
        confirm-text="위치 사용"
        cancel-text="닫기"
        @confirm="acceptLocationNotice"
        @cancel="showLocationNotice = false"
      />
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
  .ph-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
  }
  .ph-sub {
    font-size: 13px;
    color: var(--fg-muted);
    margin: 0;
  }
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
  position: relative;
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--fg);
  display: grid;
  place-items: center;
  border-radius: 999px;
  transition: background var(--dur-base) var(--ease-state);
}
/* Active (nearby mode): soft orange tint + pulsing halo to emphasize the on-state */
.icon-btn.active {
  /* background: color-mix(in srgb, var(--hold-orange) 16%, transparent); */
}
.icon-btn.active::before {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  background: radial-gradient(circle, color-mix(in srgb, #aff100 55%, transparent) 0%, transparent 70%);
  filter: blur(5px);
  pointer-events: none;
  animation: locate-pulse 2.4s var(--ease-state) infinite;
}
@keyframes locate-pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.85);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.2);
  }
}
@media (prefers-reduced-motion: reduce) {
  .icon-btn.active::before {
    animation: none;
    opacity: 0.6;
  }
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
/* .micro-label type — canonical in global.css; keep only the local offset */
.micro-label {
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
  font-size: var(--fs-body);
  color: var(--fg);
  outline: none;
}
.search-input::placeholder {
  color: var(--fg-muted);
}

/* ── Map card ───────────────────────────────────── */
.map-section {
  position: relative;
  padding-top: 16px;
}
/* Soft orange ambient glow behind the map when nearby mode is active */
.map-section.nearby-active::before {
  content: "";
  position: absolute;
  left: 26px;
  right: 26px;
  top: 28px;
  bottom: 0;
  border-radius: var(--r-card);
  background: var(--hold-lime);
  filter: blur(28px);
  opacity: 0.22;
  pointer-events: none;
}
.map-card {
  padding: 0;
  height: 360px;
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
  z-index: 2;
  left: 12px;
  right: 12px;
  bottom: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: var(--r-button);
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.map-gym-name {
  font-size: var(--fs-body);
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

/* ── Nearby gyms carousel ──────────────────────────── */
.map-carousel-wrap {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 12px;
  padding: 0 12px;
}
.map-carousel {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px; /* prevent box-shadow clipping */
}
.map-carousel::-webkit-scrollbar {
  display: none;
}
.carousel-item {
  flex-shrink: 0;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1.5px solid transparent;
  border-radius: var(--r-button);
  padding: 9px 14px;
  cursor: pointer;
  font-family: var(--font-sans);
  color: var(--fg);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  white-space: nowrap;
}
.carousel-item.active {
  border-color: var(--hold-dark);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}
.carousel-dist {
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted);
  letter-spacing: 0.02em;
}
.carousel-name {
  font-size: 13px;
  font-weight: 700;
}
.carousel-arrow {
  color: var(--fg-muted);
  flex-shrink: 0;
}

/* ── 맞춤 추천 ───────────────────────────────────── */
.reco-section {
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.reco-hint {
  font-size: 13px;
  color: var(--fg-muted);
  margin: 0;
  padding: 0 4px;
}
.reco-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  text-align: left;
  border: none;
  width: 100%;
  color: var(--fg);
  font-family: var(--font-sans);
}
.reco-cta-title {
  font-size: 14px;
  font-weight: 600;
  margin-top: 2px;
}

/* ── Gym list ───────────────────────────────────── */
.gym-list {
  padding-top: 24px;
  padding-bottom: 120px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gym-results {
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
/* .section-title — canonical style in global.css */
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
</style>
