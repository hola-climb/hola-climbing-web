<script setup lang="ts">
// imports → props → methods
import { useRouter } from "vue-router";
import UserAvatar from "@/components/common/UserAvatar.vue";

const props = defineProps<{
  id: string;
  nickname: string;
  profileImageUrl?: string | null;
  subtitle?: string;
}>();

const router = useRouter();

function openProfile() {
  router.push(`/users/${props.id}`);
}
</script>

<template>
  <div class="user-item" role="button" tabindex="0" :aria-label="`${nickname} 프로필 보기`" @click="openProfile">
    <div class="avatar" aria-hidden="true">
      <UserAvatar :src="profileImageUrl" :nickname="nickname" />
    </div>

    <div class="user-meta">
      <div class="user-name">{{ nickname }}</div>
      <div v-if="subtitle" class="user-sub">{{ subtitle }}</div>
    </div>

    <div class="user-action" @click.stop>
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-state);
}
.user-item:active {
  background: var(--surface-soft);
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--tint-cyan);
  color: var(--on-tint-cyan);
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: var(--fs-body);
  font-weight: 700;
  flex-shrink: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-meta {
  flex: 1;
  min-width: 0;
}
.user-name {
  font-size: var(--fs-body);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-sub {
  font-size: var(--fs-caption);
  color: var(--fg-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-action {
  flex-shrink: 0;
}
</style>
