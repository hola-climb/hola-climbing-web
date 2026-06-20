<script setup lang="ts">
import { onMounted } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import { useRoute } from "vue-router";
import { useOAuth } from "@/composables/useOAuth";

// 백엔드가 provider 처리를 마친 뒤 돌아오는 프론트 콜백(/oauth/callback?oauthCode=).
// 네이티브 딥링크(com.hola.climbing://oauth/callback)도 App.vue 가 이 라우트로 라우팅한다.
// oauthCode 는 1회용(TTL 1분)이라 마운트 시 즉시 한 번만 처리한다.
const route = useRoute();
const { handleCallback } = useOAuth();

onMounted(() => {
  void handleCallback({
    oauthCode: route.query.oauthCode as string | undefined,
    oauthError: route.query.oauthError as string | undefined,
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
