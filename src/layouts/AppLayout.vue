<script setup lang="ts">
import {
  IonPage,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonRouterOutlet,
  IonFab,
  IonFabButton,
  IonIcon,
  IonToast,
} from '@ionic/vue'
import { homeOutline, calendarOutline, compassOutline, personOutline, addOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import LoginBottomSheet from '@/components/common/LoginBottomSheet.vue'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

function handleUploadFab() {
  if (!authStore.isAuthenticated) {
    uiStore.openLoginSheet()
    return
  }
  router.push('/upload')
}

function guardedNav(path: string) {
  if (!authStore.isAuthenticated && path !== '/feed' && path !== '/explore') {
    uiStore.openLoginSheet()
    return
  }
  router.push(path)
}
</script>

<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />

      <IonTabBar slot="bottom">
        <IonTabButton tab="feed" href="/feed" aria-label="피드">
          <IonIcon :icon="homeOutline" />
          <span class="tab-label">피드</span>
        </IonTabButton>

        <IonTabButton tab="records" @click.prevent="guardedNav('/records')" aria-label="기록">
          <IonIcon :icon="calendarOutline" />
          <span class="tab-label">기록</span>
        </IonTabButton>

        <!-- FAB placeholder — keeps grid symmetry -->
        <IonTabButton tab="fab" disabled class="fab-slot" aria-hidden="true" />

        <IonTabButton tab="explore" href="/explore" aria-label="탐색">
          <IonIcon :icon="compassOutline" />
          <span class="tab-label">탐색</span>
        </IonTabButton>

        <IonTabButton tab="me" @click.prevent="guardedNav('/my')" aria-label="마이">
          <IonIcon :icon="personOutline" />
          <span class="tab-label">마이</span>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>

    <!-- Central upload FAB -->
    <IonFab slot="fixed" vertical="bottom" horizontal="center" class="upload-fab">
      <IonFabButton @click="handleUploadFab" aria-label="영상 업로드">
        <IonIcon :icon="addOutline" />
      </IonFabButton>
    </IonFab>

    <!-- Global toast -->
    <IonToast
      :is-open="uiStore.isToastOpen"
      :message="uiStore.toastMessage"
      :color="uiStore.toastColor"
      :duration="2500"
      position="top"
      @did-dismiss="uiStore.dismissToast"
    />

    <!-- Login bottom sheet -->
    <LoginBottomSheet
      :is-open="uiStore.showLoginSheet"
      @close="uiStore.closeLoginSheet"
    />
  </IonPage>
</template>

<style scoped>
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
