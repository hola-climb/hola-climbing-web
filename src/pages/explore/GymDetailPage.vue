<script setup lang="ts">
import { IonPage, IonContent } from '@ionic/vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
import GymDetailView from './GymDetailView.vue'

const route = useRoute()
const gymId = route.params.id as string
</script>

<template>
  <IonPage>
    <AppHeader title="암장" />
    <IonContent>
      <GymDetailView :gym-id="gymId" />
    </IonContent>
  </IonPage>
</template>
