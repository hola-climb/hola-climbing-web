<script setup lang="ts">
// imports → state → computed → methods → lifecycle
import { ref, computed, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonIcon, IonSpinner,
  IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent,
} from '@ionic/vue'
import type { InfiniteScrollCustomEvent } from '@ionic/vue'
import {
  chevronBackOutline, chatbubbleOutline, heartOutline,
  personAddOutline, megaphoneOutline, returnDownForwardOutline,
} from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { notificationService } from '@/services/notification'
import type { Notification, NotificationType } from '@/types/api'

const router = useRouter()
const uiStore = useUIStore()

const items = ref<Notification[]>([])
const page = ref(0)
const hasNext = ref(true)
const isLoading = ref(false)
const initialLoading = ref(true)

const hasUnread = computed(() => items.value.some((n) => !n.isRead))

const ICONS: Record<NotificationType, string> = {
  comment: chatbubbleOutline,
  reply: returnDownForwardOutline,
  like: heartOutline,
  follow: personAddOutline,
  system: megaphoneOutline,
}

function iconFor(type: NotificationType) {
  return ICONS[type] ?? megaphoneOutline
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

async function load(reset = false) {
  if (isLoading.value) return
  if (reset) { page.value = 0; hasNext.value = true; items.value = [] }
  if (!hasNext.value) return
  isLoading.value = true
  try {
    const { data } = await notificationService.getNotifications({ page: page.value, size: 20 })
    items.value.push(...data.content)
    hasNext.value = data.hasNext
    page.value++
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err)
    uiStore.showToast('알림을 불러오지 못했어요.', 'danger')
  } finally {
    isLoading.value = false
    initialLoading.value = false
  }
}

async function loadMore(event: InfiniteScrollCustomEvent) {
  await load()
  event.target.complete()
}

async function handleRefresh(event: CustomEvent) {
  await load(true)
  uiStore.refreshUnreadCount()
  ;(event.target as HTMLIonRefresherElement).complete()
}

async function openItem(n: Notification) {
  if (!n.isRead) {
    n.isRead = true
    try {
      await notificationService.markRead(n.id)
      uiStore.refreshUnreadCount()
    } catch { /* best-effort */ }
  }
  if (n.targetType === 'video' && n.targetId) router.push(`/videos/${n.targetId}`)
  else if (n.targetType === 'user' && n.targetId) router.push(`/users/${n.targetId}`)
  else if (n.targetType === 'gym' && n.targetId) router.push(`/gyms/${n.targetId}`)
}

async function markAllRead() {
  items.value.forEach((n) => { n.isRead = true })
  try {
    await notificationService.markRead('all')
    uiStore.setUnreadCount(0)
  } catch {
    uiStore.showToast('전체 읽음 처리에 실패했어요.', 'danger')
  }
}

onMounted(() => load(true))
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <button class="back-btn" @click="router.back()" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <span class="toolbar-title">알림</span>
          <button v-if="hasUnread" class="read-all" @click="markAllRead">모두 읽음</button>
          <span v-else class="read-all-spacer" />
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div v-if="initialLoading" class="state-center">
        <IonSpinner name="crescent" />
      </div>

      <div v-else-if="items.length === 0" class="state-center empty">
        <p class="empty-title">새 알림이 없어요</p>
        <p class="empty-sub">활동이 생기면 여기에 표시됩니다.</p>
      </div>

      <ul v-else class="noti-list">
        <li
          v-for="n in items"
          :key="n.id"
          class="noti-item"
          :class="{ unread: !n.isRead }"
          role="button"
          tabindex="0"
          @click="openItem(n)"
        >
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
.toolbar-inner {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 52px;
}
.back-btn {
  background: none; border: none; cursor: pointer; color: var(--fg);
  font-size: 22px; display: grid; place-items: center; padding: 6px;
}
.toolbar-title { font-size: 15px; font-weight: 700; }
.read-all {
  background: none; border: none; color: var(--hold-cyan);
  font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px 8px;
}
.read-all-spacer { width: 44px; }

.state-center {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 64px 24px; text-align: center;
}
.empty-title { font-size: 15px; font-weight: 700; margin: 0; }
.empty-sub { font-size: 13px; color: var(--fg-muted); margin: 0; }

.noti-list { list-style: none; margin: 0; padding: 8px 0 40px; }
.noti-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 20px; cursor: pointer; position: relative;
  transition: background var(--dur-fast) var(--ease-state);
}
.noti-item:active { background: var(--surface-soft); }
.noti-item.unread { background: color-mix(in srgb, var(--hold-lime) 8%, transparent); }

.noti-icon {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; font-size: 18px;
  background: var(--surface-soft); color: var(--fg);
}
.noti-icon.like { background: var(--tint-pink, #ffe0ec); color: #c7286a; }
.noti-icon.follow { background: var(--tint-cyan, #d6f6fb); color: #066a78; }
.noti-icon.comment, .noti-icon.reply { background: var(--tint-lime, #eefcc6); color: #4a6a00; }

.noti-body { flex: 1; min-width: 0; }
.noti-title { font-size: 14px; font-weight: 700; }
.noti-msg {
  font-size: 13px; color: var(--fg-muted); line-height: 1.4; margin-top: 2px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.noti-time { font-size: 11px; color: var(--fg-muted); margin-top: 4px; }

.unread-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--hold-lime); flex-shrink: 0; margin-top: 6px;
}
</style>
