<script setup lang="ts">
// imports → composables → state → computed → methods
import { computed } from "vue";
import { IonPage, useIonRouter } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useMediaQuery } from "@/composables/useMediaQuery";
import AdminIcon from "@/components/admin/AdminIcon.vue";

const route = useRoute();
const router = useRouter();
const ionRouter = useIonRouter();
const authStore = useAuthStore();

// 어드민은 데스크톱 전용 — 좁은 화면에서는 안내만 노출한다.
const isDesktop = useMediaQuery("(min-width: 960px)");

const NAV = [
  { path: "/admin", label: "대시보드", icon: "dashboard", exact: true },
  { path: "/admin/users", label: "회원", icon: "users", exact: false },
  { path: "/admin/reports", label: "신고", icon: "flag", exact: false },
  { path: "/admin/gyms", label: "암장", icon: "gym", exact: false },
  { path: "/admin/audit-logs", label: "감사 로그", icon: "history", exact: false },
  { path: "/admin/analysis/models", label: "모델 메트릭", icon: "metrics", exact: false },
];

const initial = computed(() => (authStore.user?.nickname ?? "A").slice(0, 1).toUpperCase());

function isActive(item: (typeof NAV)[number]) {
  return item.exact ? route.path === item.path : route.path.startsWith(item.path);
}

async function logout() {
  try {
    await authStore.logout();
  } catch {
    /* best-effort — 토큰은 어떤 경우든 로컬에서 정리된다 */
  }
  ionRouter.navigate("/auth/login", "root", "replace");
}
</script>

<template>
  <IonPage>
    <div v-if="isDesktop" class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-name">hola</div>
          <div class="brand-tag">ADMIN</div>
        </div>
        <nav class="nav">
          <button
            v-for="item in NAV"
            :key="item.path"
            class="nav-item"
            :class="{ active: isActive(item) }"
            @click="router.push(item.path)"
          >
            <AdminIcon :name="item.icon" :size="19" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <div class="nav-spacer" />
        <button class="nav-item" @click="router.push('/feed')">
          <AdminIcon name="back" :size="19" />
          <span>앱으로</span>
        </button>
        <button class="nav-item" @click="logout">
          <AdminIcon name="logout" :size="19" />
          <span>로그아웃</span>
        </button>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="who">
            <div class="who-name">{{ authStore.user?.nickname ?? "관리자" }}</div>
            <div class="who-role">ADMIN</div>
          </div>
          <div class="who-avatar">{{ initial }}</div>
        </header>
        <div class="main-scroll">
          <router-view />
        </div>
      </main>
    </div>

    <div v-else class="mobile-block">
      <AdminIcon name="desktop" :size="56" class="block-icon" />
      <h1 class="block-title">데스크탑에서 확인해주세요</h1>
      <p class="block-desc">관리자 대시보드는 넓은 화면에 최적화되어 있어요.</p>
      <button class="block-btn" @click="router.push('/feed')">앱으로 돌아가기</button>
    </div>
  </IonPage>
</template>

<style scoped>
.admin-shell {
  display: flex;
  height: 100%;
  background: var(--bg);
}

/* ── Sidebar ─────────────────────────────────────── */
.sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 22px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.brand {
  padding: 4px 12px 16px;
}
.brand-name {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.02em;
  line-height: 1;
}
.brand-tag {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-top: 2px;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-spacer {
  flex: 1;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-medium);
  color: var(--fg-muted);
  cursor: pointer;
  text-align: left;
  transition:
    background var(--dur-fast) var(--ease-state),
    color var(--dur-fast) var(--ease-state);
}
.nav-item:hover {
  background: var(--surface-soft);
  color: var(--fg);
}
.nav-item.active {
  background: var(--hold-dark);
  color: #fff;
}

/* ── Main ────────────────────────────────────────── */
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  height: 64px;
  padding: 0 32px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.who {
  text-align: right;
  line-height: 1.2;
}
.who-name {
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  color: var(--fg);
}
.who-role {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.06em;
  color: var(--fg-muted);
}
.who-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--tint-lime);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  color: var(--on-tint-lime);
}
.main-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 32px 40px;
}

/* ── Mobile block ────────────────────────────────── */
.mobile-block {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 40px 24px;
  background: var(--bg);
}
.block-icon {
  color: var(--fg-muted);
  margin-bottom: 8px;
}
.block-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.01em;
  margin: 0;
}
.block-desc {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  margin: 0;
}
.block-btn {
  margin-top: 16px;
  height: 48px;
  padding: 0 22px;
  border: 0;
  border-radius: var(--r-button);
  background: var(--hold-dark);
  color: #fff;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-bold);
  cursor: pointer;
}
</style>
