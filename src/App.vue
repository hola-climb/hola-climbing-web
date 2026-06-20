<template>
  <ion-app>
    <ion-router-outlet />
    <!-- Global toast — must live here (always mounted) so toasts fired from
         auth/standalone pages outside AppLayout still render. -->
    <IonToast :is-open="uiStore.isToastOpen" :message="uiStore.toastMessage" :color="uiStore.toastColor" :duration="2500" position="top" @did-dismiss="uiStore.dismissToast" />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { IonApp, IonRouterOutlet, IonToast } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { useUIStore } from '@/stores/ui';
import { pushService } from '@/services/push';

const uiStore = useUIStore();
const router = useRouter();

// 네이티브 소셜 로그인 콜백: 백엔드가 com.hola.climbing://oauth/callback?oauthCode= 로
// 돌려보내면 OS 가 이 리스너를 깨운다. 웹 콜백 페이지와 동일 라우트로 보내 처리 통일.
const OAUTH_SCHEME_PREFIX = 'com.hola.climbing://oauth/callback';
let urlOpenHandle: PluginListenerHandle | null = null;

// ── FCM 푸시 ──────────────────────────────────────────────────────────────
const pushHandles: PluginListenerHandle[] = [];

// 알림 data 페이로드 → 인앱 라우트. NotificationsPage.openItem 과 동일 규칙.
function routeForNotification(data: unknown): string | null {
  const d = (data ?? {}) as { targetType?: string; targetId?: string | number };
  if (d.targetId == null) return null;
  if (d.targetType === 'video') return `/videos/${d.targetId}`;
  if (d.targetType === 'user') return `/users/${d.targetId}`;
  if (d.targetType === 'gym') return `/gyms/${d.targetId}`;
  return null;
}

async function registerPushListeners() {
  // 포그라운드 수신 — OS 알림이 안 뜨므로 인앱 토스트 + 미읽음 배지 갱신.
  pushHandles.push(
    await FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
      uiStore.showToast(notification.title ?? '새 알림이 도착했어요.');
      uiStore.refreshUnreadCount();
    }),
  );

  // 알림 탭 → 대상 화면으로 이동.
  pushHandles.push(
    await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      const path = routeForNotification(notification.data);
      if (path) router.push(path);
      uiStore.refreshUnreadCount();
    }),
  );

  // 토큰 회전(서버측/OS 갱신) → 서버에 재등록.
  pushHandles.push(
    await FirebaseMessaging.addListener('tokenReceived', () => {
      void pushService.register();
    }),
  );
}

onMounted(async () => {
  await registerPushListeners();

  if (!Capacitor.isNativePlatform()) return;
  urlOpenHandle = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith(OAUTH_SCHEME_PREFIX)) return;
    try {
      const parsed = new URL(url);
      router.replace({ path: '/oauth/callback', query: Object.fromEntries(parsed.searchParams) });
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    }
  });
});

onUnmounted(() => {
  void urlOpenHandle?.remove();
  pushHandles.forEach((h) => void h.remove());
});
</script>
