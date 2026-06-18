<script setup lang="ts">
// imports → state → methods → lifecycle
import { ref, onMounted } from "vue";
import { IonPage, IonContent, IonInfiniteScroll, IonInfiniteScrollContent } from "@ionic/vue";
import type { InfiniteScrollCustomEvent } from "@ionic/vue";
import AppHeader from "@/components/common/AppHeader.vue";
import UserListItem from "@/components/common/UserListItem.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { authService } from "@/services/auth";
import { useUIStore } from "@/stores/ui";
import type { BlockedUser } from "@/types/api";

const uiStore = useUIStore();

const items = ref<BlockedUser[]>([]);
const page = ref(0);
const hasNext = ref(true);
const isLoading = ref(false);
const initialLoading = ref(true);
const pendingIds = ref<Set<string>>(new Set());

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
    const { data } = await authService.getBlockList({ page: page.value, size: 20 });
    items.value.push(...data.content);
    hasNext.value = data.hasNext;
    page.value++;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("차단 목록을 불러오지 못했어요.", "danger");
  } finally {
    isLoading.value = false;
    initialLoading.value = false;
  }
}

async function loadMore(event: InfiniteScrollCustomEvent) {
  await load();
  event.target.complete();
}

async function unblock(u: BlockedUser) {
  if (pendingIds.value.has(u.id)) return;
  pendingIds.value.add(u.id);
  const idx = items.value.findIndex((x) => x.id === u.id);
  const removed = idx >= 0 ? items.value.splice(idx, 1)[0] : null; // optimistic remove
  try {
    await authService.unblockUser(u.id);
    uiStore.showToast("차단을 해제했어요.");
  } catch {
    if (removed && idx >= 0) items.value.splice(idx, 0, removed); // revert
    uiStore.showToast("차단 해제에 실패했어요.", "danger");
  } finally {
    pendingIds.value.delete(u.id);
  }
}

onMounted(() => load(true));
</script>

<template>
  <IonPage>
    <AppHeader title="차단 관리" />

    <IonContent>
      <div v-if="initialLoading" class="list-skeleton">
        <LoadingState variant="list" :count="6" label="차단 목록을 불러오는 중" />
      </div>

      <EmptyState
        v-else-if="items.length === 0"
        hold="dark"
        title="차단한 사용자가 없어요"
      />

      <ul v-else class="user-list reveal-on-load">
        <li v-for="u in items" :key="u.id">
          <UserListItem :id="u.id" :nickname="u.nickname" :profile-image-url="u.profileImageUrl">
            <template #action>
              <button class="unblock-btn" :disabled="pendingIds.has(u.id)" @click="unblock(u)">차단 해제</button>
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
.list-skeleton {
  padding: 14px 20px;
}

.user-list {
  list-style: none;
  margin: 0;
  padding: 8px 0 40px;
}

.unblock-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--r-chip);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  font-size: var(--fs-caption);
  font-weight: 700;
  cursor: pointer;
}
.unblock-btn:disabled {
  opacity: 0.5;
}
</style>
