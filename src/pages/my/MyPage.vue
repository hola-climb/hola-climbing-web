<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent, IonAlert, IonSpinner } from "@ionic/vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { statsService } from "@/services/stats";
import { getTagLabel } from "@/utils/tagLabels";
import type { UserStats, TechniqueStats } from "@/types/api";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();

const showLogoutAlert = ref(false);
const isLoading = ref(true);
const stats = ref<UserStats | null>(null);
const techniqueStats = ref<TechniqueStats | null>(null);

const avatarInitial = computed(() => authStore.user?.nickname?.charAt(0).toUpperCase() ?? "J");

const profileSub = computed(() => {
  const most = techniqueStats.value?.mostUsed;
  if (most) return `주력 기술 · ${getTagLabel(most)}`;
  if (authStore.user?.createdAt) {
    const d = new Date(authStore.user.createdAt);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")} 가입`;
  }
  return "클라이머";
});

function formatLastClimbed(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

// Headline stats — derived from real /stats/me
const headlineStats = computed(() => {
  const s = stats.value;
  const moves = s ? Object.values(s.techniqueCounts).reduce((a, b) => a + b, 0) : 0;
  const hours = s ? (s.totalClimbingSeconds / 3600).toFixed(1) : "0";
  return [
    { value: String(s?.totalVideos ?? 0), label: "VIDEOS" },
    { value: `${hours}h`, label: "CLIMB" },
    { value: String(moves), label: "MOVES" },
    { value: formatLastClimbed(s?.lastClimbedAt ?? null), label: "LAST" },
  ];
});

// Technique frequency — derived from real /stats/me/techniques
const techniques = computed(() => {
  const counts = techniqueStats.value?.techniqueCounts ?? {};
  const mostUsed = techniqueStats.value?.mostUsed;
  const entries = Object.entries(counts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = entries.length ? entries[0][1] : 1;
  return entries.map(([key, count]) => ({
    key,
    label: getTagLabel(key),
    count,
    pct: (count / max) * 100,
    color: key === mostUsed ? "var(--hold-lime)" : "var(--hold-pink)",
  }));
});

// Settings list (app preferences — navigation only)
const settings = [
  { label: "알림 설정", value: null, toggle: false, action: () => router.push("/my/notifications") },
  { label: "올라 소개", value: null, toggle: false, action: undefined },
];

async function load() {
  isLoading.value = true;
  try {
    if (!authStore.user) await authStore.fetchMe();
    const [statsRes, techRes] = await Promise.all([statsService.getStats(), statsService.getTechniques()]);
    stats.value = statsRes.data;
    techniqueStats.value = techRes.data;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("프로필 정보를 불러오지 못했어요.", "danger");
  } finally {
    isLoading.value = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  router.replace("/feed");
  uiStore.showToast("로그아웃되었어요.");
}

onMounted(load);
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <span class="brand-label">MY PAGE</span>
          <button class="icon-btn" @click="router.push('/my/settings')" aria-label="설정">
            <!-- Settings icon -->
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
              />
            </svg>
          </button>
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div class="my-content page-padding">
        <!-- Profile header with glows -->
        <div class="profile-section">
          <div class="glow glow-pink" aria-hidden="true" />
          <div class="glow glow-lime" aria-hidden="true" />
          <div class="profile-row">
            <div class="avatar-dark" :aria-label="`${authStore.user?.nickname ?? ''} 아바타`">
              {{ avatarInitial }}
            </div>
            <div class="profile-info">
              <div class="profile-name">{{ authStore.user?.nickname ?? "—" }}</div>
              <div class="profile-sub">{{ profileSub }}</div>
            </div>
          </div>
        </div>

        <!-- Headline stats card (cyan glow) -->
        <div class="stats-card hola-card">
          <div class="stats-glow" aria-hidden="true" />
          <div class="stats-grid">
            <div v-for="stat in headlineStats" :key="stat.label" class="big-stat">
              <div class="big-val">{{ stat.value }}</div>
              <div class="big-lbl">{{ stat.label }}</div>
            </div>
          </div>
        </div>

        <!-- Technique frequency -->
        <div class="pyramid-section">
          <div class="section-header">
            <div class="section-title">기술 사용 빈도</div>
          </div>
          <div class="pyramid-card hola-card">
            <div v-if="isLoading" class="section-state">
              <IonSpinner name="crescent" />
            </div>
            <div v-else-if="techniques.length === 0" class="section-state">
              <p class="state-title">아직 분석된 기술이 없어요</p>
              <p class="state-sub">영상을 업로드하면 AI가 기술을 분석해요.</p>
            </div>
            <div v-else class="pyramid-rows">
              <div v-for="row in techniques" :key="row.key" class="pyr-row">
                <div class="pyr-grade tech-label">{{ row.label }}</div>
                <div class="pyr-track">
                  <div class="pyr-fill" :style="{ width: `${row.pct}%`, background: row.color }" />
                </div>
                <div class="pyr-count">{{ row.count }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings list -->
        <div class="settings-card hola-card">
          <div v-for="(item, i) in settings" :key="item.label" class="settings-row" :class="{ 'border-top': i > 0 }" role="button" tabindex="0" :aria-label="item.label" @click="item.action?.()">
            <div class="settings-label">{{ item.label }}</div>
            <div class="settings-right">
              <span v-if="item.value" class="settings-value">{{ item.value }}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Logout -->
        <button class="logout-btn" @click="showLogoutAlert = true" aria-label="로그아웃">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          로그아웃
        </button>
      </div>

      <IonAlert
        :is-open="showLogoutAlert"
        header="로그아웃"
        message="정말 로그아웃하시겠어요?"
        :buttons="[
          {
            text: '취소',
            role: 'cancel',
            handler: () => {
              showLogoutAlert = false;
            },
          },
          { text: '로그아웃', role: 'confirm', handler: handleLogout },
        ]"
        @did-dismiss="showLogoutAlert = false"
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
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
  cursor: pointer;
  font-size: 22px;
  color: var(--fg);
  display: grid;
  place-items: center;
  padding: 6px;
}

/* ── Content ────────────────────────────────────── */
.my-content {
  padding-top: 8px;
  padding-bottom: 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (min-width: 1024px) {
  .my-content { max-width: 720px; margin: 0 auto; }
}

/* ── Profile section ────────────────────────────── */
.profile-section {
  position: relative;
  padding: 0 0 4px;
}
.glow {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
  pointer-events: none;
  z-index: -10;
}
.glow-pink {
  background: var(--hold-pink);
  top: -60px;
  right: -80px;
}
.glow-lime {
  background: var(--hold-lime);
  top: 80px;
  left: -120px;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
}
.avatar-dark {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--hold-dark);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 800;
  flex-shrink: 0;
}
.profile-name {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.015em;
}
.profile-sub {
  font-size: 13px;
  color: var(--fg-muted);
  margin-top: 2px;
}

/* ── Headline stats ─────────────────────────────── */
.stats-card {
  padding: 20px;
}
.stats-glow {
  position: absolute;
  inset: -50px -50px auto auto;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: var(--hold-cyan);
  filter: blur(50px);
  opacity: 0.35;
  pointer-events: none;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  position: relative;
}
.big-stat {
  text-align: left;
}
.big-val {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.015em;
}
.big-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
  margin-top: 2px;
}

/* ── Grade pyramid ──────────────────────────────── */
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

.pyramid-card {
}
.pyramid-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pyr-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pyr-grade {
  width: 30px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.01em;
  flex-shrink: 0;
}
.pyr-grade.tech-label {
  width: 64px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.section-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 28px 12px;
  text-align: center;
}
.state-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
}
.state-sub {
  font-size: 12px;
  color: var(--fg-muted);
  margin: 0;
}
.pyr-track {
  flex: 1;
  height: 16px;
  background: var(--surface-soft);
  border-radius: 999px;
  overflow: hidden;
}
.pyr-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 600ms var(--ease-soft);
}
.pyr-count {
  width: 28px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-muted);
}

/* ── Settings list ──────────────────────────────── */
.settings-card {
  padding: 0;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  cursor: pointer;
  transition: opacity var(--dur-fast) var(--ease-state);
}
.settings-row:active {
  opacity: 0.7;
}
.settings-row.border-top {
  border-top: 1px solid var(--border);
}
.settings-label {
  font-size: 14px;
  font-weight: 500;
}
.settings-right {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fg-muted);
}
.settings-value {
  font-size: 13px;
  color: var(--fg-muted);
}

.toggle {
  width: 44px;
  height: 26px;
  background: var(--surface-soft);
  border-radius: 999px;
  position: relative;
  transition: background var(--dur-base) var(--ease-state);
  flex-shrink: 0;
}
.toggle.on {
  background: var(--hold-lime);
}
.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  transition: left var(--dur-base) var(--ease-state);
}
.toggle.on .toggle-thumb {
  left: 21px;
}

/* ── Logout ─────────────────────────────────────── */
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--r-button);
  height: 48px;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  font-weight: var(--w-semibold);
  color: var(--hold-pink);
  cursor: pointer;
  width: 100%;
  margin-top: 8px;
}
</style>
