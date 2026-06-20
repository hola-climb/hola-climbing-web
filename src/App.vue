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
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const router = useRouter();

// 네이티브 소셜 로그인 콜백: 백엔드가 com.hola.climbing://oauth/callback?oauthCode= 로
// 돌려보내면 OS 가 이 리스너를 깨운다. 웹 콜백 페이지와 동일 라우트로 보내 처리 통일.
const OAUTH_SCHEME_PREFIX = 'com.hola.climbing://oauth/callback';
let urlOpenHandle: PluginListenerHandle | null = null;

onMounted(async () => {
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
});
</script>
