<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { IonPage, IonTabs, IonTabBar, IonTabButton, IonRouterOutlet, IonFab, IonFabButton, IonIcon } from "@ionic/vue";
import { homeOutline, calendarOutline, compassOutline, personOutline, addOutline } from "ionicons/icons";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import LoginBottomSheet from "@/components/common/LoginBottomSheet.vue";
import UploadChoiceSheet from "@/components/common/UploadChoiceSheet.vue";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const uiStore = useUIStore();

// FAB 선택 시트 — '영상 업로드' vs '클라이밍 기록'
const showFabSheet = ref(false);
const isTabBarScrolled = ref(false);
// 키보드가 열리면 FAB가 키보드 위로 떠오르므로 숨긴다
const isKeyboardOpen = ref(false);

function handleUploadFab() {
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet();
    return;
  }
  showFabSheet.value = true;
}

function handleFabChoice(choice: "upload" | "record") {
  showFabSheet.value = false;
  router.push(choice === "upload" ? "/upload" : "/climbing-log");
}

function handleTabBarScroll(event: Event) {
  const detail = (event as CustomEvent<{ scrolled: boolean }>).detail;
  isTabBarScrolled.value = Boolean(detail?.scrolled);
}

function handleKeyboardShow() {
  isKeyboardOpen.value = true;
}

function handleKeyboardHide() {
  isKeyboardOpen.value = false;
}

onMounted(() => {
  window.addEventListener("hola:tab-bar-scroll", handleTabBarScroll);
  window.addEventListener("ionKeyboardDidShow", handleKeyboardShow);
  window.addEventListener("ionKeyboardDidHide", handleKeyboardHide);
});

onBeforeUnmount(() => {
  window.removeEventListener("hola:tab-bar-scroll", handleTabBarScroll);
  window.removeEventListener("ionKeyboardDidShow", handleKeyboardShow);
  window.removeEventListener("ionKeyboardDidHide", handleKeyboardHide);
});

watch(
  () => route.path,
  () => {
    isTabBarScrolled.value = false;
  },
);
</script>

<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />

      <IonTabBar slot="bottom" class="main-tab-bar" :class="{ 'is-scrolled': isTabBarScrolled }">
        <IonTabButton tab="feed" href="/feed" aria-label="피드">
          <IonIcon :icon="homeOutline" />
          <span class="tab-label">피드</span>
        </IonTabButton>

        <IonTabButton tab="records" href="/records" aria-label="기록">
          <IonIcon :icon="calendarOutline" />
          <span class="tab-label">기록</span>
        </IonTabButton>

        <!-- FAB placeholder — keeps grid symmetry -->
        <IonTabButton tab="fab" disabled class="fab-slot" aria-hidden="true" />

        <IonTabButton tab="explore" href="/explore" aria-label="탐색">
          <IonIcon :icon="compassOutline" />
          <span class="tab-label">암장</span>
        </IonTabButton>

        <IonTabButton tab="me" href="/my" aria-label="마이">
          <IonIcon :icon="personOutline" />
          <span class="tab-label">마이</span>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>

    <!-- Central FAB — 기록/업로드 선택 -->
    <IonFab slot="fixed" vertical="bottom" horizontal="center" class="upload-fab" :class="{ 'is-hidden': isKeyboardOpen }">
      <IonFabButton @click="handleUploadFab" aria-label="기록 또는 영상 업로드">
        <IonIcon :icon="addOutline" />
      </IonFabButton>
    </IonFab>

    <!-- FAB 선택 시트 -->
    <UploadChoiceSheet :open="showFabSheet" @select="handleFabChoice" @close="showFabSheet = false" />

    <!-- Login bottom sheet -->
    <LoginBottomSheet :is-open="uiStore.showLoginSheet" @close="uiStore.closeLoginSheet" />
  </IonPage>
</template>

<style scoped>
.main-tab-bar {
  --background: rgba(247, 247, 245);
  border-top-color: rgba(231, 234, 240, 0.6);
  box-shadow: none;
  transition:
    --background var(--dur-base) var(--ease-state),
    border-color var(--dur-base) var(--ease-state),
    box-shadow var(--dur-base) var(--ease-state);
}
.main-tab-bar.is-scrolled {
  --background: rgba(247, 247, 245, 0.94);
  border-top-color: rgba(231, 234, 240, 0.9);
  box-shadow: 0 -6px 20px rgba(20, 22, 28, 0.08);
}
.tab-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-top: 2px;
}

.fab-slot {
  pointer-events: none;
  opacity: 0;
  min-width: 58px;
}

.upload-fab {
  /* ion-fab는 `--bottom` 변수를 지원하지 않고 bottom:10px가 하드코딩돼 있다.
     그래서 safe-area만큼 margin-bottom으로 끌어올려 탭바와 같은 높이에 맞춘다.
     (탭바의 padding-bottom: env(safe-area-inset-bottom)와 동일한 값) */
  margin-bottom: env(safe-area-inset-bottom);
}

/* 키보드가 열리면 FAB가 키보드 위로 떠오르므로 숨긴다 */
.upload-fab.is-hidden {
  display: none;
}

ion-fab-button {
  --background: var(--hold-dark);
  --background-activated: #333;
  --border-radius: 999px;
  --box-shadow: var(--shadow-float);
  width: 58px;
  height: 58px;
}
</style>
