<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { IonPage, IonTabs, IonTabBar, IonTabButton, IonRouterOutlet, IonFab, IonFabButton, IonIcon, IonToast } from "@ionic/vue";
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

function guardedNav(path: string) {
  if (!authStore.isAuthenticated && path !== "/feed" && path !== "/explore") {
    uiStore.openLoginSheet();
    return;
  }
  router.push(path);
}

function handleTabBarScroll(event: Event) {
  const detail = (event as CustomEvent<{ scrolled: boolean }>).detail;
  isTabBarScrolled.value = Boolean(detail?.scrolled);
}

onMounted(() => {
  window.addEventListener("hola:tab-bar-scroll", handleTabBarScroll);
});

onBeforeUnmount(() => {
  window.removeEventListener("hola:tab-bar-scroll", handleTabBarScroll);
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

        <IonTabButton tab="records" href="/records" @click.prevent="guardedNav('/records')" aria-label="기록">
          <IonIcon :icon="calendarOutline" />
          <span class="tab-label">기록</span>
        </IonTabButton>

        <!-- FAB placeholder — keeps grid symmetry -->
        <IonTabButton tab="fab" disabled class="fab-slot" aria-hidden="true" />

        <IonTabButton tab="explore" href="/explore" aria-label="탐색">
          <IonIcon :icon="compassOutline" />
          <span class="tab-label">암장</span>
        </IonTabButton>

        <IonTabButton tab="me" href="/my" @click.prevent="guardedNav('/my')" aria-label="마이">
          <IonIcon :icon="personOutline" />
          <span class="tab-label">마이</span>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>

    <!-- Central FAB — 기록/업로드 선택 -->
    <IonFab slot="fixed" vertical="bottom" horizontal="center" class="upload-fab">
      <IonFabButton @click="handleUploadFab" aria-label="기록 또는 영상 업로드">
        <IonIcon :icon="addOutline" />
      </IonFabButton>
    </IonFab>

    <!-- FAB 선택 시트 -->
    <UploadChoiceSheet :open="showFabSheet" @select="handleFabChoice" @close="showFabSheet = false" />

    <!-- Global toast -->
    <IonToast :is-open="uiStore.isToastOpen" :message="uiStore.toastMessage" :color="uiStore.toastColor" :duration="2500" position="top" @did-dismiss="uiStore.dismissToast" />

    <!-- Login bottom sheet -->
    <LoginBottomSheet :is-open="uiStore.showLoginSheet" @close="uiStore.closeLoginSheet" />
  </IonPage>
</template>

<style scoped>
.main-tab-bar {
  --background: rgba(247, 247, 245, 0.78);
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
  --bottom: 12px;
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
