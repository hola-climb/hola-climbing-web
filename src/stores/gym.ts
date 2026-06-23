import { defineStore } from "pinia";
import { ref } from "vue";
import type { Gym, GymDetail } from "@/types/api";
import { gymService } from "@/services/gym";

export const useGymStore = defineStore("gym", () => {
  // state
  const gyms = ref<Gym[]>([]);
  const currentGym = ref<GymDetail | null>(null);
  const isLoading = ref(false);
  const totalPages = ref(0);

  // 좌표 캐시 — 목록(/gyms)·근처(/gyms/nearby) 응답은 lat/lng를 주지 않으므로
  // 상세(/gyms/{id})에서 좌표만 보강해 지도 핀에 쓴다. 세션 동안 재사용.
  const coordsMap = new Map<string, { lat: number; lng: number }>();
  const coordsVersion = ref(0); // 캐시 갱신 시 증가 → computed 재계산 트리거
  const inFlightCoords = new Set<string>();

  /** 캐시된 좌표 조회 (없으면 null) */
  function getCoords(id: string): { lat: number; lng: number } | null {
    return coordsMap.get(id) ?? null;
  }

  /**
   * 좌표가 없는 암장들의 lat/lng를 상세 엔드포인트에서 채워 캐시한다.
   * 호출당 최대 `cap`개, 동시 요청 6개로 제한한다. 개별 실패는 무시(핀만 누락).
   */
  async function ensureCoords(list: Gym[], cap = 24): Promise<void> {
    const targets = list
      .filter((g) => (!g.latitude || !g.longitude) && !coordsMap.has(g.id) && !inFlightCoords.has(g.id))
      .slice(0, cap)
      .map((g) => g.id);
    if (!targets.length) return;
    targets.forEach((id) => inFlightCoords.add(id));

    let i = 0;
    const worker = async () => {
      while (i < targets.length) {
        const id = targets[i++];
        try {
          const { data } = await gymService.getGym(id);
          if (data.latitude && data.longitude) {
            coordsMap.set(id, { lat: data.latitude, lng: data.longitude });
            coordsVersion.value++;
          }
        } catch {
          /* 개별 상세 실패는 무시 — 해당 암장 핀만 표시되지 않는다 */
        } finally {
          inFlightCoords.delete(id);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker));
  }

  // 검색 요청 시퀀스 — out-of-order 응답이 최신 결과를 덮어쓰지 않도록 가드
  let searchSeq = 0;

  // actions
  async function search(params: { keyword?: string; lat?: number; lng?: number; page?: number }) {
    const seq = ++searchSeq;
    isLoading.value = true;
    try {
      const { data } = await gymService.search({ ...params, size: 20 });
      // 응답이 도착하는 사이 더 최신 검색이 시작됐다면 이 응답은 폐기
      if (seq !== searchSeq) return;
      if (!params.page || params.page === 0) {
        gyms.value = data.content;
      } else {
        gyms.value.push(...data.content);
      }
      totalPages.value = data.totalPages;
    } finally {
      // 최신 요청일 때만 로딩 해제 (stale 응답이 로딩 상태를 흔들지 않도록)
      if (seq === searchSeq) isLoading.value = false;
    }
  }

  async function fetchGym(id: string) {
    const { data } = await gymService.getGym(id);
    currentGym.value = data;
    return data;
  }

  async function toggleFavorite(gymId: string, gymRef?: Gym) {
    const listGym = gyms.value.find((g) => g.id === gymId) ?? null;
    const detailGym = currentGym.value?.id === gymId ? currentGym.value : null;
    // gymRef covers gyms outside the store (nearbyGyms, recommendedGyms in ExplorePage)
    const target = listGym ?? detailGym ?? gymRef ?? null;
    if (!target) throw new Error("favorite_failed");

    const wasFavorited = target.isFavorited;
    // Optimistic update — mutate all matching refs
    [listGym, detailGym, gymRef].forEach((g) => { if (g) g.isFavorited = !wasFavorited; });

    try {
      await (wasFavorited ? gymService.removeFavorite(gymId) : gymService.addFavorite(gymId));
    } catch {
      [listGym, detailGym, gymRef].forEach((g) => { if (g) g.isFavorited = wasFavorited; });
      throw new Error("favorite_failed");
    }
  }

  return {
    gyms,
    currentGym,
    isLoading,
    totalPages,
    coordsVersion,
    getCoords,
    ensureCoords,
    search,
    fetchGym,
    toggleFavorite,
  };
});
