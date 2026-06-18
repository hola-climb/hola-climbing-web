<template>
  <ion-app>
    <ion-router-outlet />
    <!-- Global toast — must live here (always mounted) so toasts fired from
         auth/standalone pages outside AppLayout still render. -->
    <IonToast :is-open="uiStore.isToastOpen" :message="uiStore.toastMessage" :color="uiStore.toastColor" :duration="2500" position="top" @did-dismiss="uiStore.dismissToast" />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonToast } from '@ionic/vue';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
</script>
