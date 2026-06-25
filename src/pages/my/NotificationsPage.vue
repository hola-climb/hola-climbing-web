<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted } from "vue";
import { IonPage, IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent } from "@ionic/vue";
import type { InfiniteScrollCustomEvent } from "@ionic/vue";
import { chatbubbleOutline, heartOutline, personAddOutline, megaphoneOutline, returnDownForwardOutline } from "ionicons/icons";
import AppHeader from "@/components/common/AppHeader.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { useRouter } from "vue-router";
import { useUIStore } from "@/stores/ui";
import { notificationService } from "@/services/notification";
import type { Notification, NotificationType } from "@/types/api";

const router = useRouter();
const uiStore = useUIStore();

const items = ref<Notification[]>([]);
const page = ref(0);
const hasNext = ref(true);
const isLoading = ref(false);
const initialLoading = ref(true);

const hasUnread = computed(() => items.value.some((n) => !n.isRead));
const hasRead = computed(() => items.value.some((n) => n.isRead));
const isDeleting = ref(false);

const ICONS: Record<NotificationType, string> = {
  comment: chatbubbleOutline,
  reply: returnDownForwardOutline,
  like: heartOutline,
  follow: personAddOutline,
  system: megaphoneOutline,
};

function iconFor(type: NotificationType) {
  return ICONS[type] ?? megaphoneOutline;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

async function load(reset = false) {
  if (isLoading.value) return;
  if (reset) {
    page.value = 0;
    hasNext.value = true;
    items.value = [];
  }
  if (!hasNext.value) return;
  isLoading.value = true;
  try {
    const { data } = await notificationService.getNotifications({ page: page.value, size: 20 });
    items.value.push(...data.content);
    hasNext.value = data.hasNext;
    page.value++;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("알림을 불러오지 못했어요.", "danger");
  } finally {
    isLoading.value = false;
    initialLoading.value = false;
  }
}

async function loadMore(event: InfiniteScrollCustomEvent) {
  await load();
  event.target.complete();
}

async function handleRefresh(event: CustomEvent) {
  await load(true);
  uiStore.refreshUnreadCount();
  (event.target as HTMLIonRefresherElement).complete();
}

async function openItem(n: Notification) {
  if (!n.isRead) {
    n.isRead = true;
    try {
      await notificationService.markRead(n.id);
      uiStore.refreshUnreadCount();
    } catch {
      /* best-effort */
    }
  }
  if (n.targetType === "video" && n.targetId) router.push(`/videos/${n.targetId}`);
  else if (n.targetType === "user" && n.targetId) router.push(`/users/${n.targetId}`);
  else if (n.targetType === "gym" && n.targetId) router.push(`/gyms/${n.targetId}`);
}

async function deleteAllRead() {
  const readItems = items.value.filter((n) => n.isRead);
  if (!readItems.length) return;
  isDeleting.value = true;
  // allSettled: 일부 실패해도 나머지 삭제 계속
  const results = await Promise.allSettled(readItems.map((n) => notificationService.deleteNotification(n.id)));
  const succeeded = new Set(readItems.filter((_, i) => results[i].status === "fulfilled").map((n) => n.id));
  items.value = items.value.filter((n) => !succeeded.has(n.id));
  isDeleting.value = false;
  const failCount = results.filter((r) => r.status === "rejected").length;
  if (failCount > 0) uiStore.showToast(`${failCount}개 삭제에 실패했어요.`, "danger");
}

async function markAllRead() {
  items.value.forEach((n) => {
    n.isRead = true;
  });
  try {
    await notificationService.markRead("all");
    uiStore.setUnreadCount(0);
  } catch {
    uiStore.showToast("전체 읽음 처리에 실패했어요.", "danger");
  }
}

onMounted(() => load(true));
</script>

<template>
  <IonPage>
    <AppHeader title="알림">
      <template v-if="hasUnread || hasRead" #action>
        <div class="header-actions">
          <button v-if="hasUnread" class="read-all" @click="markAllRead">모두 읽음</button>
          <button v-if="hasRead" class="read-all delete-read" :disabled="isDeleting" @click="deleteAllRead">
            {{ isDeleting ? "삭제 중…" : "읽은 알림 삭제" }}
          </button>
        </div>
      </template>
    </AppHeader>

    <IonContent class="center-scroll">
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div v-if="initialLoading" class="noti-skeleton">
        <LoadingState variant="list" :count="6" label="알림을 불러오는 중" />
      </div>

      <EmptyState v-else-if="items.length === 0" hold="lime" title="새 알림이 없어요" description="활동이 생기면 여기에 표시됩니다." />

      <ul v-else class="noti-list reveal-on-load">
        <li v-for="n in items" :key="n.id" class="noti-item" :class="{ unread: !n.isRead }" role="button" tabindex="0" @click="openItem(n)">
          <div class="noti-icon" :class="n.type">
            <IonIcon :icon="iconFor(n.type)" />
          </div>
          <div class="noti-body">
            <div class="noti-title">{{ n.title }}</div>
            <div class="noti-msg">{{ n.message }}</div>
            <div class="noti-time">{{ formatTime(n.createdAt) }}</div>
          </div>
          <span v-if="!n.isRead" class="unread-dot" aria-label="안 읽음" />
        </li>
      </ul>

      <IonInfiniteScroll :disabled="!hasNext || items.length === 0" @ion-infinite="loadMore">
        <IonInfiniteScrollContent loading-spinner="crescent" />
      </IonInfiniteScroll>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.read-all {
  background: none;
  border: none;
  color: var(--hold-cyan);
  font-size: var(--fs-caption);
  font-weight: 700;
  cursor: pointer;
  padding: 6px 8px;
  white-space: nowrap;
}
.delete-read {
  color: var(--fg-muted);
}
.delete-read:disabled {
  opacity: 0.5;
  cursor: default;
}

.noti-skeleton {
  padding: 14px 20px;
}

.noti-list {
  list-style: none;
  margin: 0;
  padding: 8px 0 40px;
}
.noti-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 20px;
  cursor: pointer;
  position: relative;
  transition: background var(--dur-fast) var(--ease-state);
}
.noti-item:active {
  background: var(--surface-soft);
}
.noti-item.unread {
  background: color-mix(in srgb, var(--hold-lime) 8%, transparent);
}

.noti-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 18px;
  background: var(--surface-soft);
  color: var(--fg);
}
.noti-icon.like {
  background: var(--tint-pink, #ffe0ec);
  color: var(--on-tint-pink);
}
.noti-icon.follow {
  background: var(--tint-cyan, #d6f6fb);
  color: var(--on-tint-cyan);
}
.noti-icon.comment,
.noti-icon.reply {
  background: var(--tint-lime, #eefcc6);
  color: var(--on-tint-lime);
}

.noti-body {
  flex: 1;
  min-width: 0;
}
.noti-title {
  font-size: var(--fs-body);
  font-weight: 700;
}
.noti-msg {
  font-size: 13px;
  color: var(--fg-muted);
  line-height: 1.4;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.noti-time {
  font-size: 11px;
  color: var(--fg-muted);
  margin-top: 4px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hold-lime-ink);
  flex-shrink: 0;
  margin-top: 6px;
}
</style>
