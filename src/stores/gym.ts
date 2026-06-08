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

  // actions
  async function search(params: { keyword?: string; lat?: number; lng?: number; page?: number }) {
    isLoading.value = true;
    try {
      const { data } = await gymService.search({ ...params, size: 20 });
      if (!params.page || params.page === 0) {
        gyms.value = data.content;
      } else {
        gyms.value.push(...data.content);
      }
      totalPages.value = data.totalPages;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchGym(id: string) {
    const { data } = await gymService.getGym(id);
    currentGym.value = data;
    return data;
  }

  async function toggleFavorite(gymId: string) {
    const listGym = gyms.value.find((g) => g.id === gymId) ?? null;
    const detailGym = currentGym.value?.id === gymId ? currentGym.value : null;
    const ref = listGym ?? detailGym;
    if (!ref) throw new Error("favorite_failed");

    const wasFavorited = ref.isFavorited;
    // Optimistic update
    if (listGym) listGym.isFavorited = !wasFavorited;
    if (detailGym) detailGym.isFavorited = !wasFavorited;

    try {
      await (wasFavorited ? gymService.removeFavorite(gymId) : gymService.addFavorite(gymId));
    } catch {
      // Revert on failure
      if (listGym) listGym.isFavorited = wasFavorited;
      if (detailGym) detailGym.isFavorited = wasFavorited;
      throw new Error("favorite_failed");
    }
  }

  return {
    gyms,
    currentGym,
    isLoading,
    totalPages,
    search,
    fetchGym,
    toggleFavorite,
  };
});
