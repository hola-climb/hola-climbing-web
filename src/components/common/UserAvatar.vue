<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  src?: string | null;
  nickname: string;
  /** 이미지 로드 실패 시 호출되는 콜백 (ex: fetchMe로 URL 갱신) */
  onImageError?: () => void;
}>();

const broken = ref(false);

// src가 바뀌면 broken 상태 리셋 (URL 갱신 후 재시도)
watch(() => props.src, () => { broken.value = false; });

function handleError() {
  broken.value = true;
  props.onImageError?.();
}
</script>

<template>
  <img
    v-if="src && !broken"
    :src="src"
    :alt="`${nickname} 프로필`"
    class="user-avatar-img"
    loading="lazy"
    @error="handleError"
  />
  <span v-else class="user-avatar-initial" aria-hidden="true">
    {{ nickname.charAt(0).toUpperCase() }}
  </span>
</template>

<style scoped>
.user-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.user-avatar-initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-weight: 700;
}
</style>
