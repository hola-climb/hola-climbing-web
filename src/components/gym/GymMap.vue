<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { loadKakaoMaps } from "@/composables/useKakaoMap";
import type { Gym } from "@/types/api";

interface LatLngLiteral {
  lat: number;
  lng: number;
}

const props = defineProps<{
  gyms: Gym[];
  /** 기본 포커스 좌표 (전체 모드: 리스트 최상단 암장). null이면 첫 핀/서울로 폴백 */
  center: LatLngLiteral | null;
  /** 위치서비스 활성화 시 현재 위치. 설정되면 지도 포커스가 이쪽으로 이동 */
  userLocation: LatLngLiteral | null;
  /** 강조(핑크) 표시할 암장 id */
  selectedId?: string | null;
}>();

const emit = defineEmits<{ (e: "select", gym: Gym): void }>();

// 좌표 정보가 전혀 없을 때의 폴백 (서울 시청)
const SEOUL: LatLngLiteral = { lat: 37.5665, lng: 126.978 };

const mapEl = ref<HTMLDivElement | null>(null);
const failed = ref(false);

let map: kakao.maps.Map | null = null;
let markers: kakao.maps.Marker[] = [];
let userMarker: kakao.maps.Marker | null = null;
let resizeObserver: ResizeObserver | null = null;

/** 디자인 토큰 색상의 teardrop 핀 MarkerImage 생성 */
function pinImage(color: string): kakao.maps.MarkerImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38"><path d="M15 0C6.7 0 0 6.6 0 14.7 0 25.5 15 38 15 38s15-12.5 15-23.3C30 6.6 23.3 0 15 0Z" fill="${color}"/><circle cx="15" cy="14.6" r="5.4" fill="#fff"/></svg>`;
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new window.kakao.maps.MarkerImage(src, new window.kakao.maps.Size(22, 26), { offset: new window.kakao.maps.Point(15, 38) });
}

/** 현재 위치 마커 (라임 도트) */
function userImage(): kakao.maps.MarkerImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#c8ff00" stroke="#fff" stroke-width="3"/><circle cx="12" cy="12" r="3.2" fill="#151515"/></svg>`;
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new window.kakao.maps.MarkerImage(src, new window.kakao.maps.Size(24, 24), { offset: new window.kakao.maps.Point(12, 12) });
}

function toLatLng(p: LatLngLiteral): kakao.maps.LatLng {
  return new window.kakao.maps.LatLng(p.lat, p.lng);
}

function resolveCenter(): LatLngLiteral {
  if (props.userLocation) return props.userLocation;
  if (props.center) return props.center;
  const first = props.gyms.find((g) => g.latitude && g.longitude);
  return first ? { lat: first.latitude, lng: first.longitude } : SEOUL;
}

function renderMarkers() {
  if (!map) return;
  markers.forEach((m) => m.setMap(null));
  markers = [];
  props.gyms.forEach((gym) => {
    if (!gym.latitude || !gym.longitude) return; // 좌표 없는 암장은 핀 생략
    const selected = props.selectedId != null && gym.id === props.selectedId;
    const marker = new window.kakao.maps.Marker({
      position: toLatLng({ lat: gym.latitude, lng: gym.longitude }),
      image: pinImage(selected ? "#ff4d94" : "#151515"),
      title: gym.name,
      zIndex: selected ? 10 : 1,
      clickable: true,
    });
    window.kakao.maps.event.addListener(marker, "click", () => emit("select", gym));
    marker.setMap(map);
    markers.push(marker);
  });
}

function renderUserMarker() {
  if (!map) return;
  if (userMarker) {
    userMarker.setMap(null);
    userMarker = null;
  }
  if (!props.userLocation) return;
  userMarker = new window.kakao.maps.Marker({
    position: toLatLng(props.userLocation),
    image: userImage(),
    zIndex: 20,
    clickable: false,
  });
  userMarker.setMap(map);
}

async function initMap() {
  try {
    await loadKakaoMaps();
  } catch (e: unknown) {
    failed.value = true;
    if (import.meta.env.DEV) console.error("[GymMap]", e);
    return;
  }
  if (!mapEl.value) return;
  map = new window.kakao.maps.Map(mapEl.value, { center: toLatLng(resolveCenter()), level: 5 });
  renderMarkers();
  renderUserMarker();

  // Ionic 탭 전환 시 컨테이너 크기가 0→실제로 바뀌므로 relayout 필요
  resizeObserver = new ResizeObserver(() => map?.relayout());
  resizeObserver.observe(mapEl.value);
}

onMounted(initMap);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  markers.forEach((m) => m.setMap(null));
  userMarker?.setMap(null);
  map = null;
});

watch(() => props.gyms, renderMarkers);
watch(() => props.selectedId, renderMarkers);

watch(
  () => props.center,
  (c) => {
    if (map && c) map.panTo(toLatLng(c));
  },
);

// 위치서비스 활성화 → 현재 위치로 포커스 이동
watch(
  () => props.userLocation,
  (loc) => {
    renderUserMarker();
    if (map && loc) map.panTo(toLatLng(loc));
  },
);
</script>

<template>
  <div class="gym-map">
    <div v-show="!failed" ref="mapEl" class="gym-map__canvas" />
    <div v-if="failed" class="gym-map__fallback">지도를 불러올 수 없어요</div>
  </div>
</template>

<style scoped>
.gym-map,
.gym-map__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.gym-map__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--surface-soft);
  color: var(--fg-muted);
  font-size: 13px;
}
</style>
