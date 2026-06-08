<script setup lang="ts">
import { IonPage, IonContent, IonHeader, IonToolbar } from '@ionic/vue'
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div style="padding: 0 20px; height: 52px; display: flex; align-items: center;">
          <span style="font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted);">ADMIN</span>
        </div>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div class="page-padding" style="padding-top: 20px;">
        <h1 style="font-size: var(--fs-h1); font-weight: var(--w-extrabold);">관리자</h1>
        <p style="color: var(--fg-muted);">관리자 기능은 추후 구현 예정입니다.</p>
      </div>
    </IonContent>
  </IonPage>
</template>
