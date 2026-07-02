<script setup lang="ts">
// imports → composables → state → computed → methods → lifecycle
import { onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useAdminStore } from "@/stores/admin";
import { useUIStore } from "@/stores/ui";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const router = useRouter();
const adminStore = useAdminStore();
const uiStore = useUIStore();
const { dashboard, isDashboardLoading } = storeToRefs(adminStore);

const cards = computed(() => [
  { key: "gym", label: "승인 대기 암장", value: dashboard.value?.pendingGymCount ?? 0, hint: "확인 필요", icon: "clock", tone: "pink", to: "/admin/gyms?status=pending" },
  { key: "report", label: "미처리 신고", value: dashboard.value?.pendingReportCount ?? 0, hint: "대기 중", icon: "flag", tone: "orange", to: "/admin/reports" },
  { key: "video", label: "분석 실패 영상", value: dashboard.value?.failedAnalysisVideoCount ?? 0, hint: "재시도 가능", icon: "video-off", tone: "cyan", to: null },
  { key: "user", label: "오늘 신규 가입", value: dashboard.value?.newUserCountToday ?? 0, hint: "명 오늘 합류", icon: "user-plus", tone: "lime", to: "/admin/users" },
]);

async function load() {
  try {
    await adminStore.fetchDashboard();
  } catch {
    uiStore.showToast("대시보드를 불러오지 못했어요.", "danger");
  }
}

onMounted(load);
</script>

<template>
  <section class="admin-page">
    <div class="admin-page-head">
      <div>
        <h1 class="admin-page-title">대시보드</h1>
        <p class="admin-page-sub">오늘 운영 현황이에요.</p>
      </div>
    </div>

    <div class="stat-grid">
      <button v-for="c in cards" :key="c.key" class="stat-card" :class="[{ 'stat-card--accent': c.tone === 'pink' }, { 'stat-card--link': c.to }]" :disabled="!c.to" @click="c.to && router.push(c.to)">
        <div class="stat-top">
          <span class="stat-label">{{ c.label }}</span>
          <span class="stat-icon" :class="`tint-${c.tone}`"><AdminIcon :name="c.icon" /></span>
        </div>
        <div class="stat-value">{{ isDashboardLoading ? "—" : c.value.toLocaleString() }}</div>
        <div class="stat-hint">{{ c.hint }}</div>
      </button>
    </div>

    <div class="quick">
      <h2 class="quick-title">바로가기</h2>
      <div class="quick-links">
        <button class="admin-btn" @click="router.push('/admin/gyms')">
          <AdminIcon name="gym" :size="16" />
          암장 관리
        </button>
        <button class="admin-btn" @click="router.push('/admin/reports')">
          <AdminIcon name="flag" :size="16" />
          신고 처리
        </button>
        <button class="admin-btn" @click="router.push('/admin/users')">
          <AdminIcon name="users" :size="16" />
          회원 관리
        </button>
        <button class="admin-btn" @click="router.push('/admin/audit-logs')">
          <AdminIcon name="history" :size="16" />
          감사 로그
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 1080px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.stat-card {
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px 18px 16px;
  cursor: default;
  font-family: var(--font-sans);
  transition:
    transform var(--dur-fast) var(--ease-state),
    box-shadow var(--dur-fast) var(--ease-state);
}
.stat-card--accent {
  border-color: var(--tint-pink);
}
.stat-card--link {
  cursor: pointer;
}
.stat-card--link:hover {
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}
.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stat-label {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.05em;
  color: var(--fg-muted);
}
.stat-icon {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.tint-pink {
  background: var(--tint-pink);
  color: var(--on-tint-pink);
}
.tint-orange {
  background: var(--tint-orange);
  color: var(--on-tint-orange);
}
.tint-cyan {
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
}
.tint-lime {
  background: var(--tint-lime);
  color: var(--on-tint-lime);
}
.stat-value {
  font-size: 32px;
  font-weight: var(--w-extrabold);
  letter-spacing: -0.02em;
  line-height: 1;
  margin-top: 10px;
}
.stat-hint {
  font-size: var(--fs-caption);
  font-weight: var(--w-medium);
  color: var(--fg-muted);
  margin-top: 10px;
}
.stat-hint--accent {
  color: var(--hold-pink);
}
.quick {
  margin-top: 32px;
}
.quick-title {
  font-size: var(--fs-h3);
  font-weight: var(--w-semibold);
  margin: 0 0 14px;
}
.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
