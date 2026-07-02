import { defineStore } from "pinia";
import { ref } from "vue";
import type { AdminDashboardResponse } from "@/types/api";
import { adminService } from "@/services/admin";

// 대시보드 요약만 공유 캐시로 둔다 (사이드바 배지 + 대시보드 카드에서 재사용).
// 목록/상세는 각 페이지가 지역 state 로 직접 관리 — 과설계 지양.
export const useAdminStore = defineStore("admin", () => {
  // state
  const dashboard = ref<AdminDashboardResponse | null>(null);
  const isDashboardLoading = ref(false);

  // actions
  async function fetchDashboard() {
    isDashboardLoading.value = true;
    try {
      const { data } = await adminService.getDashboard();
      dashboard.value = data;
    } finally {
      isDashboardLoading.value = false;
    }
  }

  return { dashboard, isDashboardLoading, fetchDashboard };
});
