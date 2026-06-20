<script setup lang="ts">
import { onMounted } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import { useOAuth } from "@/composables/useOAuth";
import { useUIStore } from "@/stores/ui";
import { providerFromSlug } from "@/services/oauth";

// 제공자 로그인 후 돌아오는 웹 콜백(/auth/oauth/:provider/callback?code=&state=).
// 네이티브 딥링크도 App.vue 가 이 라우트로 라우팅해 동일 경로로 처리된다.
const route = useRoute();
const router = useRouter();
const uiStore = useUIStore();
const { handleCallback } = useOAuth();

onMounted(() => {
  const slug = String(route.params.provider ?? "");
  const provider = providerFromSlug(slug);
  if (!provider) {
    uiStore.showToast("알 수 없는 로그인 경로예요.", "danger");
    router.replace("/auth/login");
    return;
  }
  void handleCallback(provider, {
    code: route.query.code as string | undefined,
    state: route.query.state as string | undefined,
    error: route.query.error as string | undefined,
    errorDescription: route.query.error_description as string | undefined,
  });
});
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="callback-content">
        <div class="glow glow-lime" aria-hidden="true" />
        <div class="state-block" aria-live="polite">
          <div class="breathing-dot" aria-label="로그인 처리 중" />
          <p class="state-title">로그인 중이에요</p>
          <p class="state-sub">잠시만 기다려주세요.</p>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.callback-content {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  position: relative;
}
.glow {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.25;
  pointer-events: none;
}
.glow-lime {
  background: var(--hold-lime);
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
}
.state-block {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.breathing-dot {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--hold-lime);
  animation: breathe 1.6s ease-in-out infinite;
  margin-bottom: 8px;
}
@keyframes breathe {
  0%, 100% { transform: scale(0.85); opacity: 0.6; }
  50%      { transform: scale(1.05); opacity: 1; }
}
.state-title {
  font-size: var(--fs-h2);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.015em;
  margin: 0;
}
.state-sub {
  font-size: var(--fs-body);
  color: var(--fg-muted);
  line-height: 1.6;
  margin: 0;
}
</style>
