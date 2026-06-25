<script setup lang="ts">
// imports → state → methods → lifecycle
import { ref } from "vue";
import { IonPage, IonContent, IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent, onIonViewWillEnter } from "@ionic/vue";
import type { InfiniteScrollCustomEvent } from "@ionic/vue";
import AppHeader from "@/components/common/AppHeader.vue";
import GymCard from "@/components/gym/GymCard.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import { gymService } from "@/services/gym";
import { useUIStore } from "@/stores/ui";
import type { Gym } from "@/types/api";

const uiStore = useUIStore();

const items = ref<Gym[]>([]);
const page = ref(0);
const hasNext = ref(true);
const isLoading = ref(false);
const initialLoading = ref(true);

async function load(reset = false) {
  if (isLoading.value) return;
  if (reset) {
    page.value = 0;
    hasNext.value = true;
    items.value = [];
    initialLoading.value = true;
  }
  if (!hasNext.value) return;
  isLoading.value = true;
  try {
    const { data } = await gymService.getFavorites({ page: page.value, size: 20 });
    items.value.push(...data.content);
    hasNext.value = data.hasNext;
    page.value++;
  } catch (err: unknown) {
    if (import.meta.env.DEV) console.error(err);
    uiStore.showToast("즐겨찾기를 불러오지 못했어요.", "danger");
  } finally {
    isLoading.value = false;
    initialLoading.value = false;
  }
}

async function loadMore(event: InfiniteScrollCustomEvent) {
  await load();
  event.target.complete();
}

async function handleRefresh(event: CustomEvent) {
  await load(true);
  (event.target as HTMLIonRefresherElement).complete();
}

// Refresh each time the page is shown so unfavorited gyms drop off.
onIonViewWillEnter(() => load(true));
</script>

<template>
  <IonPage>
    <AppHeader title="즐겨찾기 암장" />

    <IonContent class="center-scroll">
      <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
        <IonRefresherContent />
      </IonRefresher>

      <div v-if="initialLoading" class="gym-list">
        <LoadingState variant="list" :count="5" label="즐겨찾기를 불러오는 중" />
      </div>

      <EmptyState
        v-else-if="items.length === 0"
        hold="cyan"
        title="즐겨찾기한 암장이 없어요"
        description="탐색에서 마음에 드는 암장을 저장해보세요."
      />

      <div v-else class="gym-list reveal-on-load">
        <GymCard v-for="gym in items" :key="gym.id" :gym="gym" />
      </div>

      <IonInfiniteScroll :disabled="!hasNext || items.length === 0" @ion-infinite="loadMore">
        <IonInfiniteScrollContent loading-spinner="crescent" />
      </IonInfiniteScroll>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.gym-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 40px;
}
</style>
