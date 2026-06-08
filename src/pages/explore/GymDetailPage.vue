<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonContent, IonIcon } from '@ionic/vue'
import { chevronBackOutline } from 'ionicons/icons'
import { useRoute, useRouter } from 'vue-router'
import GymDetailView from './GymDetailView.vue'

const route = useRoute()
const router = useRouter()
const gymId = route.params.id as string
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="toolbar-inner">
          <button class="back-btn" @click="router.back()" aria-label="뒤로">
            <IonIcon :icon="chevronBackOutline" />
          </button>
          <span class="toolbar-title">암장</span>
          <div />
        </div>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <GymDetailView :gym-id="gymId" />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.toolbar-inner {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  padding: 0 12px;
  height: 52px;
}
.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  font-size: 22px;
  display: grid;
  place-items: center;
  padding: 6px;
}
.toolbar-title {
  text-align: center;
  font-size: var(--fs-caption);
  font-weight: var(--w-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
