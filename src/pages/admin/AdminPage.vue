<script setup lang="ts">
import { IonPage, IonContent, IonHeader, IonToolbar } from '@ionic/vue'
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <div class="admin-bar">
          <span class="admin-label">ADMIN</span>
        </div>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div class="page-padding admin-content">
        <h1 class="admin-title">관리자</h1>
        <p class="admin-desc">관리자 기능은 추후 구현 예정입니다.</p>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.admin-bar {
  padding: 0 20px;
  height: 52px;
  display: flex;
  align-items: center;
}
.admin-label {
  font-size: var(--fs-micro);
  font-weight: var(--w-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.admin-content { padding-top: 20px; }
.admin-title {
  font-size: var(--fs-h1);
  font-weight: var(--w-extrabold);
  letter-spacing: -0.015em;
}
.admin-desc { color: var(--fg-muted); }
</style>
