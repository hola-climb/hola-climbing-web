<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { IonPage, IonContent, IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent } from "@ionic/vue";
import type { InfiniteScrollCustomEvent } from "@ionic/vue";
import { useRoute } from "vue-router";
import AppHeader from "@/components/common/AppHeader.vue";
import UserListItem from "@/components/common/UserListItem.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import type { FollowUser } from "@/types/api";

type Tab = "followers" | "following";

const route = useRoute();
const authStore = useAuthStore();
const uiStore = useUIStore();

const userId = route.params.id as string;
const tab = ref<Tab>(route.query.tab === "following" ? "following" : "followers");

const items = ref<FollowUser[]>([]);
const page = ref(0);
const hasNext = ref(true);
const isLoading = ref(false);
const initialLoading = ref(true);
const pendingIds = ref<Set<string>>(new Set());

const myId = computed(() => authStore.user?.id ?? null);

async function load(reset = false) {
  if (isLoading.value) return;
  if (reset) {
    page.value = 0;
    hasNext.value = true;
    items.value = [];
    initialLoading.value = true;
  }
  if (!hasNext.value) return;
  isLoading.value = true;
  try {
    const fetcher = tab.value === "followers" ? authService.getFollowers : authService.getFollowing;
    const { data } = await fetcher(userId, { page: page.value, size: 20 });
    items.value.push(...data.content);
    hasNext.value = data.hasNext;
    page.value++;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("목록을 불러오지 못했어요.", "danger");
  } finally {
    isLoading.value = false;
    initialLoading.value = false;
  }
}

async function loadMore(event: InfiniteScrollCustomEvent) {
  await load();
  event.target.complete();
}

function switchTab(next: Tab) {
  if (tab.value === next) return;
  tab.value = next;
  load(true);
}

async function toggleFollow(u: FollowUser) {
  if (pendingIds.value.has(u.id)) return;
  pendingIds.value.add(u.id);
  const wasFollowing = u.isFollowing;
  u.isFollowing = !wasFollowing; // optimistic
  try {
    if (wasFollowing) await authService.unfollow(u.id);
    else await authService.follow(u.id);
  } catch {
    u.isFollowing = wasFollowing; // revert
    uiStore.showToast("처리 중 오류가 발생했어요.", "danger");
  } finally {
    pendingIds.value.delete(u.id);
  }
}

async function handleRefresh(event: CustomEvent) {
  await load(true);
  (event.target as HTMLIonRefresherElement).complete();
}

onMounted(() => load(true));
</script>

<template>
  <IonPage>
    <AppHeader title="팔로우" />

    <IonContent class="center-scroll">
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'followers' }" @click="switchTab('followers')">팔로워</button>
        <button class="tab" :class="{ active: tab === 'following' }" @click="switchTab('following')">팔로잉</button>
      </div>

      <div v-if="initialLoading" class="list-skeleton">
        <LoadingState variant="list" :count="6" label="목록을 불러오는 중" />
      </div>

      <EmptyState
        v-else-if="items.length === 0"
        hold="cyan"
        :title="tab === 'followers' ? '팔로워가 없어요' : '팔로잉이 없어요'"
      />

      <ul v-else class="user-list reveal-on-load">
        <li v-for="u in items" :key="u.id">
          <UserListItem :id="u.id" :nickname="u.nickname" :profile-image-url="u.profileImageUrl">
            <template v-if="u.id !== myId" #action>
              <button
                class="follow-btn"
                :class="{ following: u.isFollowing }"
                :disabled="pendingIds.has(u.id)"
                @click="toggleFollow(u)"
              >
                {{ u.isFollowing ? "팔로잉" : "팔로우" }}
              </button>
            </template>
          </UserListItem>
        </li>
      </ul>

      <IonInfiniteScroll :disabled="!hasNext || items.length === 0" @ion-infinite="loadMore">
        <IonInfiniteScrollContent loading-spinner="crescent" />
      </IonInfiniteScroll>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 1;
}
.tab {
  flex: 1;
  background: none;
  border: none;
  padding: 14px 0;
  font-size: var(--fs-body);
  font-weight: 700;
  color: var(--fg-muted);
  cursor: pointer;
  position: relative;
}
.tab.active {
  color: var(--fg);
}
.tab.active::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -1px;
  transform: translateX(-50%);
  width: 48px;
  height: 2px;
  border-radius: 999px;
  background: var(--fg);
}

.list-skeleton {
  padding: 14px 20px;
}

.user-list {
  list-style: none;
  margin: 0;
  padding: 8px 0 40px;
}

.follow-btn {
  height: 34px;
  padding: 0 16px;
  border-radius: var(--r-chip);
  border: none;
  background: var(--hold-dark);
  color: #fff;
  font-size: var(--fs-caption);
  font-weight: 700;
  cursor: pointer;
}
.follow-btn.following {
  background: var(--surface-soft);
  color: var(--fg);
}
.follow-btn:disabled {
  opacity: 0.5;
}
</style>
