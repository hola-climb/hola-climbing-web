<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { IonPage, IonHeader, IonToolbar, IonContent } from "@ionic/vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import BaseButton from "@/components/common/BaseButton.vue";
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
const hasScrolled = ref(false);

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

// ── Inline profile edit ────────────────────────────
const isEditing = ref(false);
const editNickname = ref("");
const editBio = ref("");
const isSavingProfile = ref(false);

function startEdit() {
  editNickname.value = authStore.user?.nickname ?? "";
  editBio.value = authStore.user?.bio ?? "";
  isEditing.value = true;
}
function cancelEdit() {
  isEditing.value = false;
}
async function saveProfile() {
  if (!editNickname.value.trim()) {
    uiStore.showToast("닉네임을 입력해주세요.", "warning");
    return;
  }
  isSavingProfile.value = true;
  try {
    await authStore.updateProfile({ nickname: editNickname.value.trim(), bio: editBio.value.trim() || null });
    isEditing.value = false;
    uiStore.showToast("프로필이 저장됐어요.");
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    uiStore.showToast(msg ?? "저장에 실패했어요.", "danger");
  } finally {
    isSavingProfile.value = false;
  }
}

function goFollows(tab: "followers" | "following") {
  const id = authStore.user?.id;
  if (id) router.push(`/users/${id}/follows?tab=${tab}`);
}

function handleScroll(event: CustomEvent<{ scrollTop: number }>) {
  const scrolled = event.detail.scrollTop > 12;
  hasScrolled.value = scrolled;
  window.dispatchEvent(new CustomEvent("hola:tab-bar-scroll", { detail: { scrolled } }));
}

function formatLastClimbed(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}달 전`;
  return `${Math.floor(months / 12)}년 전`;
}

// Headline stats — derived from real /stats/me
const headlineStats = computed(() => {
  const s = stats.value;
  const hours = s ? (s.totalClimbingSeconds / 3600).toFixed(1) : "0";
  return [
    { value: s?.isDynamic ? "다이나믹" : "스태틱", label: "STYLE" },
    { value: `${hours}h`, label: "CLIMB" },
    { value: formatLastClimbed(s?.lastClimbedAt), label: "LAST" },
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
    <IonHeader class="ion-no-border transparent-header" :class="{ 'is-scrolled': hasScrolled }">
      <IonToolbar class="transparent-toolbar">
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

    <IonContent fullscreen class="my-page-content" :scroll-events="true" @ion-scroll="handleScroll">
      <div class="my-content page-padding">
        <!-- Profile hero card -->
        <div class="profile-hero">
          <div class="glow glow-pink" aria-hidden="true" />
          <div class="glow glow-lime" aria-hidden="true" />

          <!-- View mode -->
          <template v-if="!isEditing">
            <div class="hero-top">
              <div class="avatar-dark" :aria-label="`${authStore.user?.nickname ?? ''} 아바타`">
                <img v-if="authStore.user?.profileImageUrl" :src="authStore.user.profileImageUrl" :alt="`${authStore.user?.nickname ?? ''} 프로필`" class="avatar-img" />
                <template v-else>{{ avatarInitial }}</template>
              </div>
              <div class="profile-info">
                <div class="profile-name">{{ authStore.user?.nickname ?? "—" }}</div>
                <!-- <div class="profile-sub">{{ profileSub }}</div> -->
                <p v-if="authStore.user?.bio" class="profile-bio">{{ authStore.user.bio }}</p>
              </div>
              <button class="edit-btn" aria-label="프로필 편집" @click="startEdit">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>

            <!-- Social / activity stats -->
            <div class="hero-stats">
              <button class="hero-stat" @click="goFollows('followers')">
                <span class="hs-val">{{ authStore.user?.followerCount ?? 0 }}</span>
                <span class="hs-lbl">팔로워</span>
              </button>
              <button class="hero-stat" @click="goFollows('following')">
                <span class="hs-val">{{ authStore.user?.followingCount ?? 0 }}</span>
                <span class="hs-lbl">팔로잉</span>
              </button>
              <button class="hero-stat" @click="router.push('/my/videos')">
                <span class="hs-val">{{ stats?.totalVideos ?? authStore.user?.videoCount ?? 0 }}</span>
                <span class="hs-lbl">영상</span>
              </button>
            </div>
          </template>

          <!-- Edit mode -->
          <div v-else class="profile-edit">
            <div class="edit-field">
              <label class="edit-label" for="edit-nickname">닉네임</label>
              <input id="edit-nickname" v-model="editNickname" class="edit-input" type="text" maxlength="20" placeholder="닉네임" aria-label="닉네임" />
            </div>
            <div class="edit-field">
              <label class="edit-label" for="edit-bio">소개</label>
              <textarea id="edit-bio" v-model="editBio" class="edit-input edit-textarea" rows="3" maxlength="200" placeholder="클라이머 소개 (선택)" aria-label="소개" />
            </div>
            <div class="edit-actions">
              <BaseButton variant="secondary" class="edit-btn-flex" :disabled="isSavingProfile" @click="cancelEdit">취소</BaseButton>
              <BaseButton variant="primary" class="edit-btn-flex" :loading="isSavingProfile" @click="saveProfile">저장</BaseButton>
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
            <LoadingState v-if="isLoading" variant="list" :count="3" label="기술 분석을 불러오는 중" />
            <EmptyState v-else-if="techniques.length === 0" compact hold="cyan" title="아직 분석된 기술이 없어요" description="영상을 업로드하면 AI가 기술을 분석해요." />
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

        <!-- Logout -->
        <button class="logout-btn" @click="showLogoutAlert = true" aria-label="로그아웃">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          로그아웃
        </button>
      </div>

      <ConfirmDialog :open="showLogoutAlert" title="로그아웃" message="정말 로그아웃하시겠어요?" confirm-text="로그아웃" @confirm="handleLogout" @cancel="showLogoutAlert = false" />
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
  background: transparent;
}
/* Flat canvas (DS rule); ambient comes only from the hero glow blobs. */
.my-page-content {
  --background: var(--bg);
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
  padding-top: calc(var(--ion-safe-area-top) + 68px);
  padding-bottom: 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (min-width: 1024px) {
  .my-content {
    max-width: 720px;
    margin: 0 auto;
  }
}

/* ── Profile hero (transparent, sits on the ambient glow) ── */
.profile-hero {
  position: relative;
  padding-inline: 20px;
  padding-bottom: 10px;
  background: transparent;
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
  bottom: -80px;
  left: -100px;
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  z-index: 1;
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
  overflow: hidden;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-name {
  font-size: var(--fs-h2);
  font-weight: 800;
  letter-spacing: -0.015em;
}
.profile-sub {
  font-size: 13px;
  color: var(--fg-muted);
  margin-top: 2px;
}
.profile-info {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}
.edit-btn {
  /* background: var(--surface-soft); */
  background: transparent;
  /* border: none; */
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: var(--fg);
  cursor: pointer;
  flex-shrink: 0;
}

.profile-bio {
  font-size: var(--fs-body);
  line-height: 1.5;
  margin: 8px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Hero stat row (followers / following / videos) */
.hero-stats {
  display: flex;
  margin-top: 16px;
  padding-top: 12px;
  /* border-top: 1px solid var(--border); */
  position: relative;
  z-index: 1;
}
.hero-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
}
.hero-stat--static {
  cursor: default;
}
.hero-stat:not(.hero-stat--static):active {
  opacity: 0.6;
}
.hs-val {
  font-size: var(--fs-h3);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--fg);
}
.hs-lbl {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--fg-muted);
}

/* Inline edit */
.profile-edit {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  z-index: 1;
}
.edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.edit-label {
  font-size: var(--fs-micro);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
}
.edit-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--r-input);
  background: var(--surface);
  padding: 12px 14px;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--fg);
  outline: none;
}
.edit-input:focus {
  border-color: var(--fg);
}
.edit-textarea {
  resize: none;
  line-height: 1.45;
}
.edit-actions {
  display: flex;
  gap: 8px;
}
.edit-btn-flex {
  flex: 1;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 18px 12px;
  position: relative;
}
.big-stat {
  text-align: left;
  min-width: 0;
}
.big-val {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.015em;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
/* .section-title — canonical style in global.css */

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
