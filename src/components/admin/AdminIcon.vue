<script setup lang="ts">
// 어드민 전용 아이콘 래퍼 — 앱 표준(ionicons)으로 통일. 짧은 이름 → ionicons 매핑.
// 크기는 부모 font-size 를 상속하거나 사용처에서 인라인 font-size 로 지정한다.
import { IonIcon } from "@ionic/vue";
import {
  gridOutline,
  peopleOutline,
  flagOutline,
  businessOutline,
  timeOutline,
  statsChartOutline,
  arrowBackOutline,
  desktopOutline,
  videocamOffOutline,
  personAddOutline,
  chevronBackOutline,
  chevronForwardOutline,
  searchOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  addOutline,
  cloudUploadOutline,
  star,
  createOutline,
  imageOutline,
  trashOutline,
  closeOutline,
  logOutOutline,
  openOutline,
} from "ionicons/icons";

const MAP: Record<string, string> = {
  dashboard: gridOutline,
  users: peopleOutline,
  flag: flagOutline,
  gym: businessOutline,
  history: timeOutline,
  metrics: statsChartOutline,
  back: arrowBackOutline,
  desktop: desktopOutline,
  clock: timeOutline,
  "video-off": videocamOffOutline,
  "user-plus": personAddOutline,
  "chevron-left": chevronBackOutline,
  "chevron-right": chevronForwardOutline,
  search: searchOutline,
  "check-circle": checkmarkCircleOutline,
  "x-circle": closeCircleOutline,
  plus: addOutline,
  upload: cloudUploadOutline,
  "file-upload": cloudUploadOutline,
  star,
  edit: createOutline,
  photo: imageOutline,
  trash: trashOutline,
  x: closeOutline,
  logout: logOutOutline,
  open: openOutline,
};

const props = defineProps<{ name: string; size?: number }>();

function resolve(): string {
  return MAP[props.name] ?? searchOutline;
}
</script>

<template>
  <IonIcon :icon="resolve()" :style="size ? { fontSize: `${size}px` } : undefined" aria-hidden="true" />
</template>
